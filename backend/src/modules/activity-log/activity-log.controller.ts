import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

@Controller('activity-log')
export class ActivityLogController {
  constructor(private service: ActivityLogService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.service.findAll(limit ? parseInt(limit) : 50);
  }

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }
}
