import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { CollaborateursService } from './collaborateurs.service';
import { Roles } from '../auth/auth.guard';

@Controller('collaborateurs')
export class CollaborateursController {
  constructor(private service: CollaborateursService) {}

  @Get()
  findAll(@Req() req: any) { return this.service.findAll(req.user); }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) { return this.service.findOne(id, req.user); }

  @Roles('admin')
  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
