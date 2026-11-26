import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import type { Database } from './database.types';

// Côté pg : les types numeric et date reviennent en string par défaut.
// On garde ce défaut — c'est ce que les services attendent pour éviter les
// pertes de précision (numeric) et les piège de fuseau horaire (date).
// Les timestamps (timestamptz) restent castés en Date — c'est ce qu'on veut.

// Configurable via DATABASE_URL ou via les PGHOST/PGUSER/… standards de pg.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL est requise (postgres://user:pass@host:port/db).');
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly db: Kysely<Database>;
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      // Limites conservatrices — la Managed DB DO Basic 1GB tient 22 connexions max.
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // SSL activé par défaut en prod. En local Docker on force à off via DB_SSL=false.
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });

    this.pool.on('error', (err) => {
      // Un client idle qui se fait dropper par le serveur est logué en warn, pas error.
      this.logger.warn(`pg pool client error: ${err.message}`);
    });

    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: this.pool }),
      log: process.env.DB_LOG_QUERIES === 'true'
        ? (event) => {
            if (event.level === 'error') {
              this.logger.error(`Query failed: ${event.error}`);
            } else if (event.level === 'query') {
              this.logger.debug(`Query (${event.queryDurationMillis.toFixed(1)}ms): ${event.query.sql}`);
            }
          }
        : undefined,
    });
  }

  async onModuleDestroy() {
    await this.db.destroy(); // ferme le pool proprement au shutdown NestJS
  }

  /** Smoke-test utilisé par le healthcheck. */
  async ping(): Promise<boolean> {
    try {
      await sql`SELECT 1`.execute(this.db);
      return true;
    } catch {
      return false;
    }
  }
}
