import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
