import { Controller, Get, Query, Res, Logger, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

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

  @Post('notifications')
  async toggleNotifications(@Body() body: { userId: number, enabled: boolean }) {
    return this.authService.toggleNotifications(body.userId, body.enabled);
  }
}
