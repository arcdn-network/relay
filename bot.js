const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Logger } = require('telegram/extensions');
const path = require('path');
const fs = require('fs');

const { SERVICES, SERVICES_MESSAGE } = require('./utils/constants.js');

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');
const resourcesPath = path.join(process.cwd(), 'resources');

if (!apiId || !apiHash || !process.env.TELEGRAM_SESSION) {
  throw new Error('Faltan variables TELEGRAM_API_ID, TELEGRAM_API_HASH o TELEGRAM_SESSION');
}

let clientInstance = null;
let currentUserId = null;

const duplicateMessages = new Map();
const DUPLICATE_WINDOW_MS = 4000;

function getServiceResponseById(id) {
  const service = SERVICES.find((item) => item.id === id);
  if (!service) return null;

  return {
    text: Array.isArray(service.message) ? service.message.join('\n') : '',
    image: service.img || '',
  };
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[1-9]️⃣/g, (match) => match[0])
    .trim();
}

function getCommandKey(text) {
  return normalizeText(text).split(' ')[0];
}

function shouldBlockDuplicate(senderId, text) {
  const normalized = normalizeText(text);
  if (!senderId || !normalized) return false;

  const now = Date.now();
  const last = duplicateMessages.get(senderId);

  if (last && last.text === normalized && now - last.at < DUPLICATE_WINDOW_MS) {
    return true;
  }

  duplicateMessages.set(senderId, {
    text: normalized,
    at: now,
  });

  return false;
}

function normalizeResponse(response) {
  if (!response) return [];

  if (typeof response === 'string') {
    return [{ text: response }];
  }

  if (Array.isArray(response)) {
    return response;
  }

  return [response];
}

function getResponseConfig(text) {
  const command = getCommandKey(text);

  if (command === '/menu' || command === '/info') {
    return {
      text: SERVICES_MESSAGE,
    };
  }

  const serviceResponse = getServiceResponseById(command);
  if (serviceResponse) {
    return serviceResponse;
  }

  if (command === '/apk') {
    return [
      {
        text: [
          '📦 Aquí tienes la aplicación.',
          '',
          'Instálala en tu dispositivo 📲',
          'Luego crea tu cuenta ✍️ dentro de la app.',
          '',
          'Cuando termines, envíame el correo con el que te registraste para activar tu licencia ✅',
        ].join('\n'),
      },
      {
        file: 'files/Yape_Fake.apk',
        text: null,
      },
    ];
  }

  if (command === '/pagar') {
    return [
      {
        image: 'qr.png',
        text: [
          '**DATOS DE PAGO**',
          '👤 **Titular:** Lguss',
          '',
          '**INSTRUCCIONES DE PAGO**',
          '1️⃣ Abre **Yape** o tu banca móvil',
          '2️⃣ Escanea o sube la imagen del QR',
          '3️⃣ Realiza el pago correspondiente',
          '4️⃣ Envía el **comprobante de pago** por este chat',
          '',
          '⏳ Una vez verificado el pago, procesaré tu solicitud.',
        ].join('\n'),
      },
    ];
  }

  return null;
}

function resolveResourcePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(resourcesPath, filePath);
}

async function sendNormalizedResponse(client, inputChat, response) {
  const messages = normalizeResponse(response);

  for (const msg of messages) {
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    const image = typeof msg.image === 'string' ? msg.image.trim() : '';
    const video = typeof msg.video === 'string' ? msg.video.trim() : '';
    const file = typeof msg.file === 'string' ? msg.file.trim() : '';

    const media = image || video || file;

    if (media) {
      const filePath = resolveResourcePath(media);

      if (fs.existsSync(filePath)) {
        await client.sendFile(inputChat, {
          file: filePath,
          caption: text || undefined,
          parseMode: 'markdown',
        });
        continue;
      }
    }

    if (text) {
      await client.sendMessage(inputChat, {
        message: text,
        parseMode: 'markdown',
      });
    }
  }
}
function cleanupDuplicateMessages() {
  const now = Date.now();

  for (const [senderId, value] of duplicateMessages.entries()) {
    if (now - value.at > DUPLICATE_WINDOW_MS * 3) {
      duplicateMessages.delete(senderId);
    }
  }
}

async function onNewMessage(event) {
  try {
    if (!clientInstance || !event?.message) return;
    if (!event.isPrivate) return;

    const message = event.message;
    if (message.out) return;
    if (!message.message) return;

    const senderId = message?.fromId?.userId ? Number(message.fromId.userId) : null;
    if (currentUserId && senderId === currentUserId) return;

    if (shouldBlockDuplicate(senderId, message.message)) {
      return;
    }

    const response = getResponseConfig(message.message);
    if (!response) return;

    const inputChat = event.inputChat || (await event.getInputChat());
    if (!inputChat) return;

    await sendNormalizedResponse(clientInstance, inputChat, response);
    cleanupDuplicateMessages();
  } catch (error) {
    console.error('[TELEGRAM] Error en handler:', error);
  }
}

async function startTelegramBot() {
  if (clientInstance) return clientInstance;

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    baseLogger: new Logger('error'),
  });

  await client.connect();

  const me = await client.getMe();
  currentUserId = Number(me.id);
  clientInstance = client;

  client.addEventHandler(onNewMessage, new NewMessage({ incoming: true }));
  console.log(`[TELEGRAM] Conectado como: ${me.username || 'sin_username'} id: ${currentUserId}`);

  return clientInstance;
}

module.exports = {
  startTelegramBot,
};
