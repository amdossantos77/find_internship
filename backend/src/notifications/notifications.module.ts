import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RemoteWorkService } from '../remote-work/remote-work.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [NotificationsService, RemoteWorkService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
