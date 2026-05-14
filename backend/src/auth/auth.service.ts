import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { lastValueFrom } from 'rxjs';
import { createClient } from '@supabase/supabase-js';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
    );
  }

  getLoginUrl(): string {
    const clientId = this.configService.get<string>('API_42_CLIENT_ID');
    const redirectUri = this.configService.get<string>('OAUTH_REDIRECT_URI') || '';
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

    return `${apiUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=public&prompt=login`;
  }

  async validateUser(code: string) {
    const clientId = this.configService.get<string>('API_42_CLIENT_ID');
    const clientSecret = this.configService.get<string>('API_42_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('OAUTH_REDIRECT_URI') || '';
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

    try {
      this.logger.log(`Trocando código por token para: ${redirectUri}`);
      
      const tokenResponse = await lastValueFrom(
        this.httpService.post(`${apiUrl}/oauth/token`, {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
          // @ts-ignore
          family: 4 // Força IPv4 para estabilidade na rede
        }),
      );

      const accessToken = tokenResponse.data.access_token;

      const userResponse = await lastValueFrom(
        this.httpService.get(`${apiUrl}/v2/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 60000,
          // @ts-ignore
          family: 4
        }),
      );

      const userData = userResponse.data;

      // Persistir ou atualizar o utilizador no Supabase
      const userProfile = {
        external_id: userData.id,
        login: userData.login,
        email: userData.email,
        last_login: new Date().toISOString(),
      };

      const { data: dbUser } = await this.supabase
        .from('app_users')
        .upsert(userProfile, { onConflict: 'external_id' })
        .select()
        .single();

      const payload = { 
        userId: userData.id, 
        login: userData.login, 
        email: userData.email,
        image: userData.image?.link,
        notifications_enabled: dbUser?.notifications_enabled ?? true
      };
      
      return {
        access_token: this.jwtService.sign(payload),
        user: payload,
      };
    } catch (error) {
      this.logger.error('Erro na autenticação 42:', error.response?.data || error.message);
      throw error;
    }
  }

  async toggleNotifications(userId: number, enabled: boolean) {
    const { data, error } = await this.supabase
      .from('app_users')
      .update({ notifications_enabled: enabled })
      .eq('external_id', userId)
      .select()
      .single();

    if (data) {
      await this.notificationsService.sendStatusEmail(data.email, data.login, enabled);
      this.logger.log(`E-mail de confirmação enviado para @${data.login} (${enabled ? 'ON' : 'OFF'})`);
    }

    return data;
  }
}
