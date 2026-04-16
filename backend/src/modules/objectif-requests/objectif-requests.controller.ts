import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import { ObjectifRequestsService } from './objectif-requests.service';

@Controller('objectif-requests')
export class ObjectifRequestsController {
  constructor(private service: ObjectifRequestsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    if (!req.user?.isAdmin) {
      return this.service.findAll({ ...filters, collaborateur_id: req.user.sub });
    }
    return this.service.findAll(filters);
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    return this.service.create({ ...dto, collaborateur_id: req.user.sub });
  }

  @Put(':id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Put(':id/refuse')
  refuse(@Param('id') id: string, @Body() dto: any) {
    return this.service.refuse(id, dto.motif_refus || '');
  }
}
