import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseModule } from './config/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { CollaborateursModule } from './modules/collaborateurs/collaborateurs.module';
import { ObjectifsModule } from './modules/objectifs/objectifs.module';
import { AbsencesModule } from './modules/absences/absences.module';
import { PointsSuiviModule } from './modules/points-suivi/points-suivi.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ClientsModule } from './modules/clients/clients.module';
import { MissionsModule } from './modules/missions/missions.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { TimeEntriesModule } from './modules/time-entries/time-entries.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { StaffingRequestsModule } from './modules/staffing-requests/staffing-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    SupabaseModule,
    AuthModule,
    CollaborateursModule,
    ObjectifsModule,
    AbsencesModule,
    PointsSuiviModule,
    SettingsModule,
    ClientsModule,
    MissionsModule,
    AssignmentsModule,
    TimeEntriesModule,
    ActivityLogModule,
    StaffingRequestsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
