import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { Roles } from '../auth/auth.guard';

function stripFinancials(data: any) {
  if (!data) return data;
  const items = Array.isArray(data) ? data : [data];
  return items.map(m => {
    const { tjm, budget_vendu, ...safe } = m;
    if (safe.assignments) {
      safe.assignments = safe.assignments.map((a: any) => {
        const { tjm: aTjm, ...safeA } = a;
        return safeA;
      });
    }
    return safe;
  });
}

@Controller('missions')
export class MissionsController {
  constructor(private service: MissionsService) {}

  @Get()
  async findAll(@Query() filters: Record<string, string>, @Req() req: any) {
    const data = await this.service.findAll(filters);
    return req.user?.isAdmin ? data : stripFinancials(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.findOne(id);
    return req.user?.isAdmin ? data : stripFinancials(data)[0];
  }

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
