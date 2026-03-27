require('dotenv').config({ quiet: true });
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const apiId = 35255357;
const apiHash = '7df9f983aa6b2f1058182ea0ba71c85f';

(async () => {
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Teléfono: '),
    password: async () => await input.text('Contraseña 2FA (si tienes): '),
    phoneCode: async () => await input.text('Código recibido: '),
    onError: (err) => console.log(err),
  });

  console.log('Tu nueva sesión:');
  console.log(client.session.save());
  await client.disconnect();
})();
