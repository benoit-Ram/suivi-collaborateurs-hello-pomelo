import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { PointsSuiviService } from './points-suivi.service';
import { Roles } from '../auth/auth.guard';

@Controller('points-suivi')
export class PointsSuiviController {
  constructor(private service: PointsSuiviService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    return this.service.findAll(filters, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
