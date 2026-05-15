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
        from: 'Find Internship Bot <vagas@amarildodossantos.me>',
        to: email,
        subject: `🔔 Bot de Vagas: ${enabled ? 'ATIVADO' : 'DESATIVADO'}`,
        html: `
          <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f8fafc; text-align: center;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 48px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
              <h1 style="color: ${enabled ? '#22c55e' : '#ef4444'}; margin-bottom: 24px; font-size: 28px; font-weight: bold;">
                ${enabled ? '✅ Ativado com Sucesso!' : '❌ Desativado'}
              </h1>
              
              <p style="font-size: 18px; margin-bottom: 16px; color: #f1f5f9;">Olá <strong>${login}</strong>,</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 16px;">
                Confirmamos que o teu bot de notificações para novas vagas foi <strong>${enabled ? 'ligado' : 'desligado'}</strong>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">
                ${enabled 
                  ? 'Agora vais receber alertas de vagas em Angola, Remote e Freelance assim que forem publicadas!' 
                  : 'Não vais receber mais alertas automáticos por agora. Podes ligar novamente no dashboard.'}
              </p>
              
              <div style="margin-top: 48px; font-size: 13px; color: #64748b;">
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
          <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f8fafc;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
              <h1 style="color: #38bdf8; margin-bottom: 24px; font-size: 24px; font-weight: bold;">Oportunidade Encontrada!</h1>
              
              <p style="font-size: 15px; color: #94a3b8; margin-bottom: 24px;">
                O teu bot do Find Internship encontrou uma vaga que corresponde aos teus critérios:
              </p>
              
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #334155;">
                <p style="margin: 12px 0; font-size: 15px;"><strong style="color: #38bdf8;">Cargo:</strong> ${offer.title}</p>
                <p style="margin: 12px 0; font-size: 15px;"><strong style="color: #38bdf8;">Empresa:</strong> ${offer.company || 'Empresa Privada'}</p>
                <p style="margin: 12px 0; font-size: 15px;"><strong style="color: #38bdf8;">Local:</strong> ${offer.location}</p>
                <p style="margin: 12px 0; font-size: 15px;"><strong style="color: #38bdf8;">Salário:</strong> ${offer.salary || 'Não especificado'}</p>
                <p style="margin: 12px 0; font-size: 15px;"><strong style="color: #38bdf8;">Tipo:</strong> ${offer.contract_type}</p>
              </div>

              <div style="margin-bottom: 40px; text-align: center;">
                <a href="${offer.link}" style="background-color: #38bdf8; color: #0f172a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Ver na Intra 42
                </a>
              </div>

              <div style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: center;">
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
