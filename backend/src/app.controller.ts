import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { NotificationsService } from './notifications/notifications.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('offers')
  async getOffers(
    @Query('city') city?: string,
    @Query('country') country?: string,
    @Query('contract_type') contract_type?: string,
    @Query('expertise_id') expertise_id?: string,
    @Query('target') target?: string,
  ) {
    return this.appService.getOffers(city, country, contract_type, expertise_id, target);
  }

  @Get('trigger-bot')
  async triggerBot() {
    this.notificationsService.handleCron();
    return { status: 'Bot triggered' };
  }
}
