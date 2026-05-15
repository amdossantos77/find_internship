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
    const redirectUri = this.configService.get<string>('OAUTH_REDIRECT_URI') || 'http://localhost:5173/auth/callback';
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

    return `${apiUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=public`;
  }

  async validateUser(code: string) {
    const body = {
      grant_type: 'authorization_code',
      client_id: this.configService.get<string>('API_42_CLIENT_ID'),
      client_secret: this.configService.get<string>('API_42_CLIENT_SECRET'),
      code: code,
      redirect_uri: this.configService.get<string>('OAUTH_REDIRECT_URI') || '',
    };
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

    try {
      this.logger.log(`Trocando código por token para: ${body.redirect_uri}`);

      const tokenResponse = await lastValueFrom(
        this.httpService.post(`${apiUrl}/oauth/token`, body, {
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

      // 1. Verificar se o utilizador já existe
      const { data: existingUser } = await this.supabase
        .from('app_users')
        .select('*')
        .eq('external_id', userData.id)
        .single();

      let dbUser;

      if (!existingUser) {
        // 2. Se não existir, criar com notifications_enabled: false
        const { data: newUser } = await this.supabase
          .from('app_users')
          .insert([{ ...userProfile, notifications_enabled: false }])
          .select()
          .single();
        dbUser = newUser;
      } else {
        // 3. Se já existir, apenas atualizar o perfil (sem tocar nas notificações)
        const { data: updatedUser } = await this.supabase
          .from('app_users')
          .update(userProfile)
          .eq('external_id', userData.id)
          .select()
          .single();
        dbUser = updatedUser;
      }

      const payload = {
        userId: userData.id,
        login: userData.login,
        email: userData.email,
        image: userData.image?.link,
        notifications_enabled: dbUser?.notifications_enabled ?? false
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
    this.logger.log(`Solicitação de toggle para user_id: ${userId} -> ${enabled}`);
    const { data, error } = await this.supabase
      .from('app_users')
      .update({ notifications_enabled: enabled })
      .eq('external_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Erro ao atualizar no Supabase para user ${userId}:`, error.message);
    }

    if (data) {
      // Enviar e-mail em background
      this.notificationsService.sendStatusEmail(data.email, data.login, enabled)
        .then(info => {
          this.logger.log(`E-mail de confirmação enviado para @${data.login}: ${info?.id}`);
        })
        .catch(mailError => {
          this.logger.error(`Erro ao enviar e-mail de status para @${data.login}: ${mailError.message}`);
        });
    }

    return data;
  }
}
