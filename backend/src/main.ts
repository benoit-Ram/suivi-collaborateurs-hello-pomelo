import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  // En prod : exiger FRONTEND_URL explicite pour éviter qu'une variable manquante
  // fasse tomber CORS sur localhost (auth cassée silencieusement pour tous les users).
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL requise en production (CORS). Ex: FRONTEND_URL=https://rh.pomelo-dev.fr');
  }
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
  app.enableCors({ origin: allowedOrigins, methods: 'GET,PUT,POST,DELETE,OPTIONS', credentials: true });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend running on http://0.0.0.0:${port} (CORS allowed: ${allowedOrigins.join(', ')})`);
}
bootstrap();
