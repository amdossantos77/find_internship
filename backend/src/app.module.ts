import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';
import { RemoteWorkService } from './remote-work/remote-work.service';

@Module({
  imports: [
    HttpModule, 
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService, RemoteWorkService],
})
export class AppModule {}
