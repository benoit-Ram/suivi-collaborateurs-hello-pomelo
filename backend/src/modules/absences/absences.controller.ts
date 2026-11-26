import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, NotFoundException } from '@nestjs/common';
import { AbsencesService } from './absences.service';
import { Roles } from '../auth/auth.guard';

@Controller('absences')
export class AbsencesController {
  constructor(private service: AbsencesService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    // Un non-admin ne voit QUE ses propres absences (pas celles des autres).
    // Un admin voit tout, ou peut filtrer via ?collaborateur_id=...
    if (!req.user?.isAdmin) {
      filters = { ...filters, collaborateur_id: req.user?.sub };
    }
    return this.service.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const abs = await this.service.findOne(id);
    if (!req.user?.isAdmin && abs.collaborateur_id !== req.user?.sub) {
      // Masque l'existence de l'absence plutôt que révéler 403
      throw new NotFoundException(`Absence ${id} introuvable`);
    }
    return abs;
  }

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
