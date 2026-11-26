import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { DatabaseService } from '../../config/database.service';

/** Endpoint healthcheck public — consommé par Docker HEALTHCHECK, Traefik probes,
 *  Alloy agent, Uptime Kuma sondes externes. N'expose aucune info sensible. */
@Controller('health')
export class HealthController {
  constructor(private database: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    const dbOk = await this.database.ping();
    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'ko',
      ts: new Date().toISOString(),
    };
  }
}
