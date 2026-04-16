import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import { ObjectifRequestsService } from './objectif-requests.service';

@Controller('objectif-requests')
export class ObjectifRequestsController {
  constructor(private service: ObjectifRequestsService) {}

  @Get()
  async findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    if (req.user?.isAdmin) {
      // Admin sees all (or filtered)
      return this.service.findAll(filters);
    }
    // Non-admin: sees own requests + requests where they are manager
    const [own, asManager] = await Promise.all([
      this.service.findAll({ ...filters, collaborateur_id: req.user.sub }),
      this.service.findAll({ ...filters, manager_id: req.user.sub }),
    ]);
    // Merge and deduplicate
    const ids = new Set();
    const merged = [];
    for (const r of [...asManager, ...own]) {
      if (!ids.has(r.id)) { ids.add(r.id); merged.push(r); }
    }
    return merged;
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
