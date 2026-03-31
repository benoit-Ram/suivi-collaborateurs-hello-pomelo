import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', methods: 'GET,PUT,POST,DELETE,OPTIONS', credentials: true });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 4000, '0.0.0.0');
  console.log(`Backend démarré sur http://0.0.0.0:${process.env.PORT || 4000}`);
}
bootstrap();
