import { Controller, Get, Post, Put, Body, Param, Query, Req, ForbiddenException } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private service: TimeEntriesService) {}

  @Get()
  findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    // Non-admin can only see their own time entries
    if (!req.user?.isAdmin) {
      filters.collaborateur_id = req.user.sub;
    }
    return this.service.findAll(filters);
  }

  @Post()
  create(@Body() dto: any, @Req() req: any) {
    // Non-admin can only create for themselves
    if (!req.user?.isAdmin && dto.collaborateur_id !== req.user.sub) {
      throw new ForbiddenException('Vous ne pouvez creer des entrees que pour vous-meme');
    }
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    // Non-admin can only update their own entries
    if (!req.user?.isAdmin) {
      const entry = await this.service.findOne(id);
      if (entry.collaborateur_id !== req.user.sub) {
        throw new ForbiddenException('Vous ne pouvez modifier que vos propres entrees');
      }
    }
    return this.service.update(id, dto);
  }
}
