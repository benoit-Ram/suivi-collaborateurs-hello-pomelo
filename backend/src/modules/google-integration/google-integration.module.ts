import { Module, Global } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { MailerService } from './mailer.service';
import { CalendarService } from './calendar.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  providers: [GoogleAuthService, MailerService, CalendarService, NotificationsService],
  exports: [NotificationsService, MailerService, CalendarService],
})
export class GoogleIntegrationModule {}
