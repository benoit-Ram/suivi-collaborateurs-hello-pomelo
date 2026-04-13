import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { AbsencesService } from './absences.service';
import { Roles } from '../auth/auth.guard';

@Controller('absences')
export class AbsencesController {
  constructor(private service: AbsencesService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>) { return this.service.findAll(filters); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    // Non-admin can only create for themselves
    if (!req.user?.isAdmin && dto.collaborateur_id !== req.user?.sub) {
      dto.collaborateur_id = req.user?.sub;
    }
    // Non-admin creates as 'en_attente'
    if (!req.user?.isAdmin) {
      dto.statut = 'en_attente';
      delete dto.approved_by;
      delete dto.approved_at;
    }
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    // Non-admin can only update their own pending absences (cancel request)
    if (!req.user?.isAdmin) {
      // Only allow statut change to 'annulation_demandee' for own absences
      return this.service.updateForCollab(id, dto, req.user?.sub);
    }
    return this.service.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
