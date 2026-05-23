import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cron } from '@nestjs/schedule';

const COUNTRY_MAPPING = {
  'FR': 'France', 'ES': 'Spain', 'PT': 'Portugal', 'BR': 'Brazil', 'AO': 'Angola',
  'BE': 'Belgium', 'DE': 'Germany', 'CH': 'Switzerland', 'IT': 'Italy', 'MA': 'Morocco',
  'LU': 'Luxembourg', 'UK': 'United Kingdom', 'US': 'United States'
};

const SKILL_KEYWORDS = {
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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL') || '',
      this.configService.get('SUPABASE_KEY') || ''
    );
  }

  async sendStatusEmail(email: string, login: string, enabled: boolean) {
    const statusLabel = enabled ? 'ATIVADO' : 'DESATIVADO';
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Find Internship Bot <vagas@amarildodossantos.me>',
        to: email,
        subject: `🔔 Bot de Vagas: ${statusLabel}`,
        html: this.getStatusTemplate(login, enabled),
      });

      if (error) throw error;
      return data;
    } catch (e) {
      this.logger.error(`Status email failed for ${login}: ${e.message}`);
      return null;
    }
  }

  @Cron('0 * * * *')
  async handleCron() {
    this.logger.debug('Starting notification cycle...');
    
    const { data: users, error } = await this.supabase
      .from('app_users')
      .select('*')
      .eq('notifications_enabled', true);

    if (error || !users?.length) return;

    for (const user of users) {
      await this.processUserAlerts(user);
    }
  }

  private async processUserAlerts(user: any) {
    const filters = Array.isArray(user.filters) ? user.filters : [];
    if (!filters.length) return;

    const { data: notified } = await this.supabase
      .from('notified_offers')
      .select('offer_id')
      .eq('user_id', user.external_id);

    const notifiedIds = new Set(notified?.map(n => String(n.offer_id)));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: offers } = await this.supabase
      .from('internship_offers')
      .select('*')
      .gt('created_at', sevenDaysAgo.toISOString());

    if (!offers?.length) return;

    const filterMatches = (offer: any) => {
      return filters.some(criteria => {
        if (criteria.country?.trim()) {
          const target = (COUNTRY_MAPPING[criteria.country.toUpperCase()] || criteria.country).toLowerCase();
          if (!offer.location?.toLowerCase().includes(target)) return false;
        }

        if (criteria.city?.trim() && !offer.location?.toLowerCase().includes(criteria.city.toLowerCase())) {
          return false;
        }

        if (criteria.expertise?.trim()) {
          const query = criteria.expertise.toLowerCase();
          const keywords = SKILL_KEYWORDS[query] || [query];
          const content = `${offer.title} ${offer.little_description || ''}`.toLowerCase();
          if (!keywords.some(kw => content.includes(kw))) return false;
        }

        if (criteria.contract_type?.trim() && !offer.contract_type?.toLowerCase().includes(criteria.contract_type.toLowerCase())) {
          return false;
        }

        if (criteria.only_remote === true) {
          const content = `${offer.title} ${offer.little_description || ''} ${offer.location || ''}`.toLowerCase();
          const remoteTerms = ['remote', 'télétravail', 'remoto'];
          if (!remoteTerms.some(term => content.includes(term))) return false;
        }

        return true;
      });
    };

    const targetOffers = offers.filter(o => !notifiedIds.has(String(o.id)) && filterMatches(o));

    for (const offer of targetOffers) {
      await this.dispatchOfferEmail(offer, user);
    }
  }

  private async dispatchOfferEmail(offer: any, user: any) {
    try {
      await this.resend.emails.send({
        from: 'Find Internship Bot <vagas@amarildodossantos.me>',
        to: user.email,
        subject: `🚀 Nova Vaga: ${offer.title} @ ${offer.company || 'Empresa'}`,
        html: this.getOfferTemplate(offer),
      });

      await this.supabase.from('notified_offers').insert({
        offer_id: Number(offer.id),
        user_id: Number(user.external_id)
      });
    } catch (e) {
      this.logger.error(`Dispatch failed for offer ${offer.id} to ${user.login}: ${e.message}`);
    }
  }

  private getStatusTemplate(login: string, enabled: boolean) {
    const color = enabled ? '#22c55e' : '#ef4444';
    return `
      <div style="padding: 40px; font-family: sans-serif; text-align: center;">
        <h1 style="color: ${color}; font-size: 24px;">Bot ${enabled ? 'Ativado' : 'Desativado'}</h1>
        <p>Olá <strong>${login}</strong>, o teu bot foi configurado com sucesso.</p>
        <p style="color: #666;">Find Internship Service</p>
      </div>
    `;
  }

  private getOfferTemplate(offer: any) {
    return `
      <div style="padding: 30px; font-family: sans-serif; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #38bdf8;">Oportunidade Encontrada!</h2>
        <p><strong>Cargo:</strong> ${offer.title}</p>
        <p><strong>Local:</strong> ${offer.location}</p>
        <p><strong>Tipo:</strong> ${offer.contract_type}</p>
        <a href="${offer.link}" style="background: #38bdf8; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px;">
          Ver na Intra
        </a>
      </div>
    `;
  }
}
