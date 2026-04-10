import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import { StaffingRequestsService } from './staffing-requests.service';
import { Roles } from '../auth/auth.guard';

@Controller('staffing-requests')
export class StaffingRequestsController {
  constructor(private service: StaffingRequestsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    // Non-admin: only see their own requests
    if (!req.user?.isAdmin) {
      return this.service.findAll({ ...filters, demandeur_id: req.user.sub });
    }
    return this.service.findAll(filters);
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    return this.service.create({ ...dto, demandeur_id: req.user.sub });
  }

  @Roles('admin')
  @Put(':id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Roles('admin')
  @Put(':id/refuse')
  refuse(@Param('id') id: string, @Body() dto: any) {
    return this.service.refuse(id, dto.motif_refus || '');
  }
}
