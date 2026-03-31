import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ObjectifsService } from './objectifs.service';

@Controller('objectifs')
export class ObjectifsController {
  constructor(private service: ObjectifsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>) { return this.service.findAll(filters); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
