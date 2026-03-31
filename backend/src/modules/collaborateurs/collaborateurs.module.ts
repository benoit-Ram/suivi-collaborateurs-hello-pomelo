import { Module } from '@nestjs/common';
import { CollaborateursController } from './collaborateurs.controller';
import { CollaborateursService } from './collaborateurs.service';

@Module({
  controllers: [CollaborateursController],
  providers: [CollaborateursService],
  exports: [CollaborateursService],
})
export class CollaborateursModule {}
