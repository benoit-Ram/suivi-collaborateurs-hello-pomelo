import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './config/database.module';
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
import { ObjectifRequestsModule } from './modules/objectif-requests/objectif-requests.module';
import { GoogleIntegrationModule } from './modules/google-integration/google-integration.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Deux throttlers : 'default' pour tout le monde (100/min), 'login' pour /auth/login (10/min).
    // Appliqué via @Throttle({ login: {...} }) sur le controller.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'login', ttl: 60_000, limit: 10 },
    ]),
    DatabaseModule,
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
    ObjectifRequestsModule,
    GoogleIntegrationModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
