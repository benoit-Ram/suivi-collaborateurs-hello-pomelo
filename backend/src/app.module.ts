import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './config/supabase.module';
import { CollaborateursModule } from './modules/collaborateurs/collaborateurs.module';
import { ObjectifsModule } from './modules/objectifs/objectifs.module';
import { AbsencesModule } from './modules/absences/absences.module';
import { PointsSuiviModule } from './modules/points-suivi/points-suivi.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    CollaborateursModule,
    ObjectifsModule,
    AbsencesModule,
    PointsSuiviModule,
    SettingsModule,
  ],
})
export class AppModule {}
