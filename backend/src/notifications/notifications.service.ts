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
    const filterList = Array.isArray(user.filters) ? user.filters : (user.filters && Object.keys(user.filters).length > 0 ? [user.filters] : []);
    
    if (filterList.length === 0) return;

    // 1. Buscar IDs de vagas já notificadas para este utilizador
    const { data: notified } = await this.supabase
      .from('notified_offers')
      .select('offer_id')
      .eq('user_id', user.external_id);

    const notifiedIds = notified?.map(n => String(n.offer_id)) || [];

    // 2. Buscar novas vagas dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();

    const { data: offers, error: offerError } = await this.supabase
      .from('internship_offers')
      .select('*')
      .gt('created_at', dateStr);

    if (offerError) {
      this.logger.error(`Erro ao buscar vagas para ${user.login}:`, offerError.message);
      return;
    }

    const countryMapping = {
      'FR': 'France', 'ES': 'Spain', 'PT': 'Portugal', 'BR': 'Brazil', 'AO': 'Angola',
      'BE': 'Belgium', 'DE': 'Germany', 'CH': 'Switzerland', 'IT': 'Italy', 'MA': 'Morocco',
      'LU': 'Luxembourg', 'UK': 'United Kingdom', 'US': 'United States'
    };

    const skillKeywords = {
      'java': ['java', 'spring', 'boot', 'jee', 'hibernate', 'maven'],
      'node': ['node', 'express', 'nest', 'typescript', 'js', 'javascript', 'backend'],
      'python': ['python', 'django', 'flask', 'ai', 'ia', 'data', 'intelligence', 'pandas'],
      'react': ['react', 'vue', 'frontend', 'angular', 'web', 'html', 'css', 'js'],
      'mobile': ['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin'],
      'c++': ['c++', 'c ', 'embedded', 'kernel', 'unix', 'linux', 'system'],
      'security': ['security', 'cyber', 'pentest', 'network', 'réseau', 'sécurité'],
      'php': ['php', 'laravel', 'symfony', 'mysql'],
      'web': ['web', 'html', 'css', 'javascript', 'frontend']
    };

    // 3. Filtrar vagas baseadas na LISTA de alertas (Lógica OR entre alertas)
    const matchesAnyFilter = (offer: any) => {
      return filterList.some(filters => {
        // Filtro de País
        if (filters.country && filters.country.trim() !== "") {
          const targetCountry = (countryMapping[filters.country.trim().toUpperCase()] || filters.country.trim()).toLowerCase();
          if (!(offer.location || "").toLowerCase().includes(targetCountry)) return false;
        }

        // Filtro de Cidade
        if (filters.city && filters.city.trim() !== "") {
          const cityQuery = filters.city.trim().toLowerCase();
          if (!(offer.location || "").toLowerCase().includes(cityQuery)) return false;
        }

        // Filtro de Skill
        if (filters.expertise && filters.expertise.trim() !== "") {
          const skillQuery = filters.expertise.toLowerCase();
          const keywords = skillKeywords[skillQuery] || [skillQuery];
          const content = `${offer.title} ${offer.little_description || ''}`.toLowerCase();
          if (!keywords.some(kw => content.includes(kw))) return false;
        }

        // Filtro de Contrato
        if (filters.contract_type && filters.contract_type.trim() !== "") {
          if (!(offer.contract_type || "").toLowerCase().includes(filters.contract_type.toLowerCase())) return false;
        }

        // NOVO: Filtro Remoto
        if (filters.only_remote === true) {
          const content = `${offer.title} ${offer.little_description || ''} ${offer.location || ''}`.toLowerCase();
          if (!content.includes('remote') && !content.includes('télétravail') && !content.includes('remoto')) return false;
        }

        return true; // Passou em todos os critérios desta regra (AND interno)
      });
    };

    const newOffers = (offers || []).filter(offer => 
      !notifiedIds.includes(String(offer.id)) && matchesAnyFilter(offer)
    );

    if (newOffers.length > 0) {
      this.logger.log(`Encontradas ${newOffers.length} novas vagas reais para @${user.login} baseadas em sua lista de alertas.`);
      
      for (const offer of newOffers) {
        try {
          await this.sendEmail(offer, user.email);
          
          await this.supabase.from('notified_offers').insert([{
            offer_id: Number(offer.id),
            user_id: Number(user.external_id)
          }]);
        } catch (e) {
          this.logger.error(`Erro ao processar vaga ${offer.id} para ${user.login}:`, e.message);
        }
      }
    }
  }
}
