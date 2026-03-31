import { Module } from '@nestjs/common';
import { PointsSuiviController } from './points-suivi.controller';
import { PointsSuiviService } from './points-suivi.service';

@Module({
  controllers: [PointsSuiviController],
  providers: [PointsSuiviService],
})
export class PointsSuiviModule {}
