import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AppService } from '../app.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [NotificationsService, AppService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
