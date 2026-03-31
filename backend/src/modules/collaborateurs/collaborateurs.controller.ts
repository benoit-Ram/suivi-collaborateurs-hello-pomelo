import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CollaborateursService } from './collaborateurs.service';

@Controller('collaborateurs')
export class CollaborateursController {
  constructor(private service: CollaborateursService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
