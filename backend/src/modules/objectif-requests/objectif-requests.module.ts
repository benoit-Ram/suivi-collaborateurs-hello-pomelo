import { Module } from '@nestjs/common';
import { ObjectifRequestsController } from './objectif-requests.controller';
import { ObjectifRequestsService } from './objectif-requests.service';

@Module({
  controllers: [ObjectifRequestsController],
  providers: [ObjectifRequestsService],
})
export class ObjectifRequestsModule {}
