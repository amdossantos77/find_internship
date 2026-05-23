import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { lastValueFrom } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

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
    const redirectUri = this.configService.get<string>('OAUTH_REDIRECT_URI') || 'http://localhost:5173';
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

    return `${apiUrl}/oauth/authorize?prompt=login&approval_prompt=force&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=public`;
  }

  getLogoutUrl(): string {
    return 'https://auth.42.fr/auth/realms/students-42/protocol/openid-connect/logout';
  }

  async validateUser(code: string) {
    const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';
    const payload = {
      grant_type: 'authorization_code',
      client_id: this.configService.get<string>('API_42_CLIENT_ID'),
      client_secret: this.configService.get<string>('API_42_CLIENT_SECRET'),
      code,
      redirect_uri: this.configService.get<string>('OAUTH_REDIRECT_URI'),
    };

    try {
      const { data: tokens } = await lastValueFrom(
        this.httpService.post(`${apiUrl}/oauth/token`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
          // @ts-ignore
          family: 4 
        }),
      );

      const { data: profile } = await lastValueFrom(
        this.httpService.get(`${apiUrl}/v2/me`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          timeout: 15000,
          // @ts-ignore
          family: 4
        }),
      );

      const syncData = {
        external_id: profile.id,
        login: profile.login,
        email: profile.email,
        last_login: new Date().toISOString(),
      };

      const { data: existingUser } = await this.supabase
        .from('app_users')
        .select('*')
        .eq('external_id', profile.id)
        .single();

      let dbUser;

      if (!existingUser) {
        const { data: newUser } = await this.supabase
          .from('app_users')
          .insert([{ ...syncData, notifications_enabled: false }])
          .select()
          .single();
        dbUser = newUser;
      } else {
        const { data: updatedUser } = await this.supabase
          .from('app_users')
          .update(syncData)
          .eq('external_id', profile.id)
          .select()
          .single();
        dbUser = updatedUser;
      }

      const userSession = {
        userId: profile.id,
        login: profile.login,
        email: profile.email,
        image: profile.image?.link,
        notifications_enabled: dbUser?.notifications_enabled ?? false,
        filters: Array.isArray(dbUser?.filters) ? dbUser.filters : []
      };

      return {
        access_token: this.jwtService.sign(userSession),
        user: userSession,
      };
    } catch (error) {
      this.logger.error(`Validation failed: ${error.response?.data?.error || error.message}`);
      throw new HttpException('Auth provider error', HttpStatus.UNAUTHORIZED);
    }
  }

  async toggleNotifications(userId: number, enabled: boolean) {
    const { data, error } = await this.supabase
      .from('app_users')
      .update({ notifications_enabled: enabled })
      .eq('external_id', userId)
      .select()
      .single();

    if (error) {
      throw new HttpException('Storage synchronization failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (data) {
      this.notificationsService.sendStatusEmail(data.email, data.login, enabled)
        .catch(err => this.logger.error(`Mail dispatch failed: ${err.message}`));
    }

    return data;
  }

  async updateFilters(userId: number, filters: any) {
    const { data, error } = await this.supabase
      .from('app_users')
      .update({ filters })
      .eq('external_id', userId)
      .select()
      .single();

    if (error) {
      throw new HttpException('Filter persistence failed', HttpStatus.BAD_REQUEST);
    }

    return data;
  }
}
