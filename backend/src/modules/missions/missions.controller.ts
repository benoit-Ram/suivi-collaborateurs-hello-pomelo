import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { Roles } from '../auth/auth.guard';

@Controller('missions')
export class MissionsController {
  constructor(private service: MissionsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>) { return this.service.findAll(filters); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Roles('admin')
  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
