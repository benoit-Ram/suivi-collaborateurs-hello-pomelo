import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ObjectifsService } from './objectifs.service';

@Controller('objectifs')
export class ObjectifsController {
  constructor(private service: ObjectifsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>) { return this.service.findAll(filters); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  // Admin OR direct manager of the target collaborateur — enforced in service.
  @Post()
  create(@Body() dto: any, @Req() req: any) { return this.service.create(dto, req.user); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) { return this.service.update(id, dto, req.user); }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) { return this.service.delete(id, req.user); }
}
