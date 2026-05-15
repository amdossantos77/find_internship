import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppService } from '../app.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private supabase;

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY') || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Executa o bot a cada 6 horas por padrão
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    this.logger.log('Iniciando verificação de novas oportunidades para todos os utilizadores...');
    
    // 1. Busca todas as ofertas (aproveita o cache do AppService)
    const offers = await this.appService.getOffers();
    
    // 2. Filtra pelas preferências globais
    const luandaTarget = offers.filter(o => 
      (o.address || '').toLowerCase().includes('angola') || 
      (o.address || '').toLowerCase().includes('luanda')
    );
    
    const freelanceTarget = offers.filter(o => 
      (o.contract_type || '').toLowerCase().includes('freelance')
    );
    
    const remoteTarget = offers.filter(o => o.is_remote);

    const allTargets = [...new Set([...luandaTarget, ...freelanceTarget, ...remoteTarget])];
    
    if (allTargets.length === 0) {
      this.logger.log('Nenhuma vaga especial encontrada.');
      return;
    }

    // 3. Busca todos os utilizadores que aceitam notificações
    const { data: users } = await this.supabase
      .from('app_users')
      .select('external_id, email, login')
      .eq('notifications_enabled', true);

    if (!users || users.length === 0) {
      this.logger.log('Nenhum utilizador com notificações ativas encontrado.');
      return;
    }

    this.logger.log(`Processando ${allTargets.length} vagas para ${users.length} utilizadores.`);

    for (const offer of allTargets) {
      for (const user of users) {
        // Verifica se este utilizador já foi notificado desta vaga específica
        // Para simplificar, usamos uma chave composta no Supabase ou apenas verificamos
        const { data: alreadyNotified } = await this.supabase
          .from('notified_offers')
          .select('id')
          .eq('offer_id', offer.id)
          .eq('user_id', user.external_id)
          .single();

        if (!alreadyNotified) {
          await this.sendEmail(offer, user.email);
          await this.supabase.from('notified_offers').insert([{ 
            offer_id: offer.id, 
            user_id: user.external_id 
          }]);
          this.logger.log(`Notificação enviada para @${user.login}: ${offer.title}`);
        }
      }
    }
  }

  async sendStatusEmail(email: string, login: string, enabled: boolean) {
    const transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number(this.configService.get('SMTP_PORT')),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
      // @ts-ignore
      family: 4,
    });

    const info = await transporter.sendMail({
      from: this.configService.get('SMTP_USER'),
      to: email,
      subject: `🔔 Bot de Vagas: ${enabled ? 'ATIVADO' : 'DESATIVADO'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px; border-radius: 12px; text-align: center;">
          <h2 style="color: ${enabled ? '#10b981' : '#e11d48'};">${enabled ? '✅ Ativado com Sucesso!' : '❌ Desativado'}</h2>
          <p>Olá <strong>${login}</strong>,</p>
          <p>Confirmamos que o teu bot de notificações para novas vagas foi <strong>${enabled ? 'ligado' : 'desligado'}</strong>.</p>
          ${enabled 
            ? '<p>Agora vais receber alertas de vagas em Angola, Remote e Freelance assim que forem publicadas!</p>' 
            : '<p>Não vais receber mais alertas automáticos por agora. Podes ligar novamente quando quiseres no dashboard.</p>'
          }
          <div style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
            Find Internship - 42 Luanda & Global
          </div>
        </div>
      `,
    });
    return info;
  }

  private async sendEmail(offer: any, targetEmail: string) {
    const transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number(this.configService.get('SMTP_PORT')),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
      // @ts-ignore
      family: 4,
    });

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'Não definida';
      return new Intl.DateTimeFormat('pt-PT').format(new Date(dateStr));
    };

    const info = await transporter.sendMail({
      from: this.configService.get('SMTP_USER'),
      to: targetEmail,
      subject: `📢 Nova Vaga: ${offer.title} - ${offer.company_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #00BABC; font-size: 20px;">Oportunidade Encontrada! 🚀</h2>
          <p style="color: #666;">Olá! Encontrei uma vaga que se encaixa nos teus critérios (Angola, Remote ou Freelance):</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid #00BABC; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>🔥 Cargo:</strong> ${offer.title}</p>
            <p style="margin: 5px 0;"><strong>🏢 Empresa:</strong> ${offer.company_name}</p>
            <p style="margin: 5px 0;"><strong>📍 Local:</strong> ${offer.city}, ${offer.country}</p>
            <p style="margin: 5px 0;"><strong>💰 Salário:</strong> ${offer.salary || 'A combinar'}</p>
            <p style="margin: 5px 0;"><strong>📄 Contrato:</strong> ${offer.contract_type}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
            <p style="margin: 5px 0; font-size: 13px; color: #475569;"><strong>📅 Criada em:</strong> ${formatDate(offer.created_at)}</p>
            <p style="margin: 5px 0; font-size: 13px; color: #e11d48;"><strong>⚠ Candidatar até:</strong> ${formatDate(offer.invalid_at)}</p>
          </div>

          <p style="margin-top: 25px; text-align: center;">
            <a href="https://profile.intra.42.fr/offers/${offer.id}" 
               style="background-color: #00BABC; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
               Candidatar-se na Intra
            </a>
          </p>
          
          <p style="margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center;">
            Recebeste este e-mail porque as tuas notificações estão ligadas no Find Internship.<br>
            Podes desligá-las a qualquer momento no teu dashboard.
          </p>
        </div>
      `,
    });

    return info;
  }
}
