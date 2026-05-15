import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { Cron } from '@nestjs/schedule';

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
        from: 'Find Internship Bot <vagas@amarildodossantos.me>',
        to: email,
        subject: `🔔 Bot de Vagas: ${enabled ? 'ATIVADO' : 'DESATIVADO'}`,
        html: `
          <div style="padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center;">
            <div style="max-width: 600px; margin: 0 auto; border: 1.5px solid #444; border-radius: 24px; padding: 48px; background: transparent;">
              <h1 style="color: #22c55e; margin-bottom: 24px; font-size: 32px; font-weight: bold;">
                ${enabled ? '✅ Ativado com Sucesso!' : '❌ Desativado'}
              </h1>
              
              <p style="font-size: 20px; margin-bottom: 16px;">Olá <strong>${login}</strong>,</p>
              
              <p style="font-size: 18px; line-height: 1.6; margin-bottom: 16px;">
                Confirmamos que o teu bot de notificações para novas vagas foi <strong>${enabled ? 'ligado' : 'desligado'}</strong>.
              </p>
              
              <p style="font-size: 18px; line-height: 1.6;">
                ${enabled 
                  ? 'Agora vais receber alertas de vagas em Angola, Remote e Freelance assim que forem publicadas!' 
                  : 'Não vais receber mais alertas automáticos por agora. Podes ligar novamente no dashboard.'}
              </p>
              
              <div style="margin-top: 48px; font-size: 14px; color: #666;">
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
        from: 'Find Internship Bot <vagas@amarildodossantos.me>',
        to: targetEmail,
        subject: `🚀 Nova Vaga: ${offer.title} - ${offer.company || 'Empresa Privada'}`,
        html: `
          <div style="padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; border: 1.5px solid #444; border-radius: 24px; padding: 40px; background: transparent;">
              <h1 style="color: #38bdf8; margin-bottom: 24px; font-size: 26px; font-weight: bold;">Oportunidade Encontrada!</h1>
              
              <p style="font-size: 16px; margin-bottom: 24px;">
                O teu bot do Find Internship encontrou uma vaga que corresponde aos teus critérios:
              </p>
              
              <div style="border: 1px solid #444; border-radius: 16px; padding: 24px; margin-bottom: 32px; background: transparent;">
                <p style="margin: 12px 0; font-size: 16px;"><strong style="color: #38bdf8;">Cargo:</strong> ${offer.title}</p>
                <p style="margin: 12px 0; font-size: 16px;"><strong style="color: #38bdf8;">Empresa:</strong> ${offer.company || 'Empresa Privada'}</p>
                <p style="margin: 12px 0; font-size: 16px;"><strong style="color: #38bdf8;">Local:</strong> ${offer.location}</p>
                <p style="margin: 12px 0; font-size: 16px;"><strong style="color: #38bdf8;">Salário:</strong> ${offer.salary || 'Não especificado'}</p>
                <p style="margin: 12px 0; font-size: 16px;"><strong style="color: #38bdf8;">Tipo:</strong> ${offer.contract_type}</p>
              </div>

              <div style="margin-bottom: 40px; text-align: center;">
                <a href="${offer.link}" style="background-color: #38bdf8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
                  Ver na Intra 42
                </a>
              </div>

              <div style="border-top: 1px solid #444; padding-top: 20px; font-size: 12px; color: #666; line-height: 1.6; text-align: center;">
                Este é um alerta automático gerado pelo teu servidor Find Internship.
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

  @Cron('0 * * * *') // Executa a cada hora
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
