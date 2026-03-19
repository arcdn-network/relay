require('dotenv').config({ quiet: true });
const { startTelegramBot } = require('./bot');

async function bootstrap() {
  try {
    await startTelegramBot();
    console.log('[TELEGRAM] Bot iniciado correctamente');
  } catch (error) {
    console.error('[TELEGRAM] Error al iniciar:', error);
    process.exit(1);
  }
}

bootstrap();
