import { Controller, Get, Query, Res, Logger, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('login')
  async login(@Res() res: Response) {
    const url = this.authService.getLoginUrl();
    this.logger.log(`Redirecionando para login 42: ${url}`);
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    try {
      this.logger.log('Recebido callback da 42 com código.');
      const data = await this.authService.validateUser(code);
      const userStr = encodeURIComponent(JSON.stringify(data.user));
      return res.redirect(`${frontendUrl}?token=${data.access_token}&user=${userStr}`);
    } catch (error) {
      this.logger.error('Erro no callback de autenticação:', error.message);
      return res.redirect(`${frontendUrl}?error=auth_failed`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications')
  async toggleNotifications(@Request() req, @Body() body: { enabled: boolean }) {
    const userId = req.user.userId;
    return this.authService.toggleNotifications(userId, body.enabled);
  }

  @UseGuards(JwtAuthGuard)
  @Post('filters')
  async updateFilters(@Request() req, @Body() body: { filters: any }) {
    const userId = req.user.userId;
    return this.authService.updateFilters(userId, body.filters);
  }
}
