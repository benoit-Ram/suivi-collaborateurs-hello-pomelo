import { Module } from '@nestjs/common';
import { StaffingRequestsController } from './staffing-requests.controller';
import { StaffingRequestsService } from './staffing-requests.service';

@Module({
  controllers: [StaffingRequestsController],
  providers: [StaffingRequestsService],
})
export class StaffingRequestsModule {}
