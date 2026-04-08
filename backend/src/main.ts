import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
  app.enableCors({ origin: allowedOrigins, methods: 'GET,PUT,POST,DELETE,OPTIONS', credentials: true });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend running on http://0.0.0.0:${port}`);
}
bootstrap();
