import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend;
  private supabase;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL') || '',
      this.configService.get('SUPABASE_KEY') || ''
    );
  }

  async sendStatusEmail(email: string, login: string, enabled: boolean) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Find Internship <vagas@amarildodossantos.me>',
        to: email,
        subject: `🔔 Bot de Vagas: ${enabled ? 'ATIVADO - ✅ Ativado com Sucesso!' : 'DESATIVADO - ❌ Desativado'}`,
        html: `
          <div style="background-color: #121212; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #1e1e1e; border-radius: 16px; padding: 32px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div style="font-size: 64px; margin-bottom: 16px;">
                ${enabled ? '✅' : '❌'}
              </div>
              <h1 style="color: ${enabled ? '#4caf50' : '#f44336'}; margin-bottom: 8px; font-size: 28px;">
                ${enabled ? 'Ativado com Sucesso!' : 'Desativado'}
              </h1>
              <p style="font-size: 18px; color: #ccc;">Olá <strong>${login}</strong>,</p>
              <p style="font-size: 16px; line-height: 1.6; color: #bbb;">
                Confirmamos que o teu bot de notificações para novas vagas foi <strong>${enabled ? 'ligado' : 'desligado'}</strong>.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #bbb; margin-top: 24px;">
                ${enabled 
                  ? 'Agora vais receber alertas de vagas assim que forem publicadas na Intra!' 
                  : 'Não vais receber mais alertas automáticos por agora. Podes ligar novamente quando quiseres no dashboard.'}
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; font-size: 12px; color: #666;">
                Find Internship - 42 Luanda & Global
              </div>
            </div>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Erro ao enviar e-mail de status para ${login}: ${error.message}`);
        return null;
      }

      this.logger.log(`E-mail de status enviado via Resend para ${login}: ${data?.id}`);
      return data;
    } catch (e) {
      this.logger.error(`Erro fatal ao enviar e-mail via Resend: ${e.message}`);
      return null;
    }
  }

  private async sendEmail(offer: any, targetEmail: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Nova Vaga! <vagas@amarildodossantos.me>',
        to: targetEmail,
        subject: `🚀 Oportunidade Encontrada: ${offer.title}`,
        html: `
          <div style="background-color: #121212; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1e1e1e; border-radius: 16px; padding: 32px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <h1 style="color: #00bcd4; margin-bottom: 16px; font-size: 26px; text-align: center;">Oportunidade Encontrada!</h1>
              <p style="font-size: 16px; color: #ccc; margin-bottom: 24px; text-align: center;">
                O teu bot do Find Internship encontrou uma vaga que corresponde aos teus critérios:
              </p>
              
              <div style="background-color: #252525; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #444;">
                <p style="margin: 8px 0;"><strong style="color: #00bcd4;">Cargo:</strong> ${offer.title}</p>
                <p style="margin: 8px 0;"><strong style="color: #00bcd4;">Empresa:</strong> ${offer.company || 'Empresa Privada'}</p>
                <p style="margin: 8px 0;"><strong style="color: #00bcd4;">Local:</strong> ${offer.location}</p>
                <p style="margin: 8px 0;"><strong style="color: #00bcd4;">Tipo:</strong> ${offer.contract_type}</p>
              </div>

              <div style="text-align: center;">
                <a href="${offer.link}" style="background-color: #008080; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; transition: background-color 0.3s;">
                  Ver na Intra 42
                </a>
              </div>

              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; font-size: 11px; color: #555; text-align: center; line-height: 1.4;">
                Este é um alerta automático gerado pelo teu servidor Find Internship.<br/>
                Para deixar de receber estes e-mails, desativa as notificações no teu dashboard.
              </div>
            </div>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Erro do Resend ao enviar vaga para ${targetEmail}:`, error);
        return;
      }

      this.logger.log(`E-mail de vaga enviado via Resend para ${targetEmail}: ${data.id}`);
    } catch (e) {
      this.logger.error(`Erro ao enviar vaga via Resend: ${e.message}`);
    }
  }

  // O resto do código (handleCron, checkOffersForUser) continua igual...
  async handleCron() {
    this.logger.log('Iniciando busca de novas vagas para notificações...');
    
    const { data: users, error: userError } = await this.supabase
      .from('app_users')
      .select('*')
      .eq('notifications_enabled', true);

    if (userError) {
      this.logger.error('Erro ao buscar utilizadores para notificações:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      this.logger.log('Nenhum utilizador com notificações ativas.');
      return;
    }

    for (const user of users) {
      await this.checkOffersForUser(user);
    }
  }

  private async checkOffersForUser(user: any) {
    const filters = user.filters || {};
    const lastLogin = user.last_login;

    let query = this.supabase
      .from('internship_offers')
      .select('*')
      .gt('created_at', lastLogin);

    if (filters.contract_type && filters.contract_type !== 'all') {
      query = query.eq('contract_type', filters.contract_type);
    }

    const { data: offers, error: offerError } = await query;

    if (offerError) {
      this.logger.error(`Erro ao buscar vagas para ${user.login}:`, offerError.message);
      return;
    }

    if (offers && offers.length > 0) {
      this.logger.log(`Encontradas ${offers.length} novas vagas para @${user.login}. Enviando e-mails...`);
      for (const offer of offers) {
        await this.sendEmail(offer, user.email);
      }
    }
  }
}
