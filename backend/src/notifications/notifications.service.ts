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
        from: 'Find Internship <onboarding@resend.dev>',
        to: email,
        subject: `Notificações ${enabled ? 'Ativadas' : 'Desativadas'} - Find Internship`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Olá @${login}!</h2>
            <p>Este e-mail é para confirmar que as tuas notificações de novas vagas foram <strong>${enabled ? 'ATIVADAS' : 'DESATIVADAS'}</strong>.</p>
            ${enabled ? '<p>Vais receber um e-mail sempre que encontrarmos uma vaga que corresponda aos teus filtros!</p>' : '<p>Não vais receber mais e-mails automáticos por agora.</p>'}
            <hr />
            <p style="font-size: 12px; color: #666;">Find Internship - 42 Lisboa</p>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Erro do Resend ao enviar status para @${login}:`, error);
        return null;
      }

      this.logger.log(`E-mail de status enviado via Resend para @${login}: ${data.id}`);
      return data;
    } catch (e) {
      this.logger.error(`Erro fatal ao enviar e-mail via Resend: ${e.message}`);
      return null;
    }
  }

  private async sendEmail(offer: any, targetEmail: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Nova Vaga! <onboarding@resend.dev>',
        to: targetEmail,
        subject: `🚀 Nova Vaga: ${offer.title} em ${offer.company}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>🚀 Nova Oportunidade Encontrada!</h2>
            <p><strong>Empresa:</strong> ${offer.company}</p>
            <p><strong>Título:</strong> ${offer.title}</p>
            <p><strong>Local:</strong> ${offer.location}</p>
            <p><strong>Tipo:</strong> ${offer.contract_type}</p>
            <br />
            <a href="${offer.link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Vaga na Intra</a>
            <hr />
            <p style="font-size: 12px; color: #666;">Find Internship - 42 Lisboa</p>
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
