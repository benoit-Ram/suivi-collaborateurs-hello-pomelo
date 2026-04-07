import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Roles } from '../auth/auth.guard';

@Controller('clients')
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>) { return this.service.findAll(filters); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Roles('admin')
  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
