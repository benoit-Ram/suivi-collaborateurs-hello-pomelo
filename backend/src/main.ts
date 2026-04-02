import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
  app.enableCors({ origin: allowedOrigins, methods: 'GET,PUT,POST,DELETE,OPTIONS', credentials: true });
  app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for SPA compatibility
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 4000, '0.0.0.0');
  console.log(`Backend démarré sur http://0.0.0.0:${process.env.PORT || 4000}`);
}
bootstrap();
