import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';

/** Module global exposant Kysely + pool pg à toute l'app.
 * Cohabite avec SupabaseModule pendant la migration ; une fois les 13 services
 * refactorés, SupabaseModule et son service seront supprimés. */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
