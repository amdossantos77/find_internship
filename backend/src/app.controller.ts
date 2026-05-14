import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
