import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private apiToken = '';
  private tokenExpiresAt = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refreshToken();
  }

  private async refreshToken() {
    try {
      const clientId = this.configService.get<string>('API_42_CLIENT_ID');
      const clientSecret = this.configService.get<string>('API_42_CLIENT_SECRET');
      const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';

      this.logger.log('Solicitando novo token Access Client Credentials na 42...');
      
      const response = await lastValueFrom(
        this.httpService.post(`${apiUrl}/oauth/token`, {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      );

      this.apiToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - (5 * 60 * 1000);
      
      this.logger.log('Token da API 42 obtido com sucesso.');
    } catch (error) {
      this.logger.error('Erro ao obter token da API 42:', error.response?.data || error.message);
    }
  }

  private async ensureToken() {
    if (!this.apiToken || Date.now() > this.tokenExpiresAt) {
      await this.refreshToken();
    }
  }

  private cachedOffers: any[] = [];
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutos
  private fetchPromise: Promise<void> | null = null;

  async getOffers(
    city?: string, 
    country?: string, 
    contract_type?: string,
    expertise_id?: string,
    target?: string
  ) {
    const currentTime = Date.now();

    // 1. Gerenciamento de Cache (Single Flight Pattern)
    if (this.cachedOffers.length === 0 || (currentTime - this.lastFetchTime) >= this.CACHE_TTL) {
      if (!this.fetchPromise) {
        this.fetchPromise = this.performFetch();
      }
      this.logger.log('Aguardando atualização do cache...');
      await this.fetchPromise;
    } else {
      this.logger.log('Usando ofertas do cache (Instantâneo)');
    }

    // 2. Filtragem Manual de Alta Precisão
    const countryMapping = {
      'FR': 'France', 'ES': 'Spain', 'PT': 'Portugal', 'BR': 'Brazil', 'AO': 'Angola',
      'BE': 'Belgium', 'DE': 'Germany', 'CH': 'Switzerland', 'IT': 'Italy', 'MA': 'Morocco',
      'LU': 'Luxembourg', 'UK': 'United Kingdom', 'US': 'United States'
    };

    let results = this.cachedOffers;

    // Filtro de País
    if (country && country.trim() !== "") {
      const targetCountry = (countryMapping[country.trim().toUpperCase()] || country.trim()).toLowerCase();
      results = results.filter(offer => 
        (offer.full_address || "").toLowerCase().includes(targetCountry)
      );
    }

    // Filtro de Cidade
    if (city && city.trim() !== "") {
      const cityQuery = city.trim().toLowerCase();
      results = results.filter(offer => 
        (offer.full_address || "").toLowerCase().includes(cityQuery) ||
        (offer.city || "").toLowerCase().includes(cityQuery)
      );
    }

    // Filtro de Skills (Inteligente via Keywords)
    if (expertise_id && expertise_id.trim() !== "") {
      const skillQuery = expertise_id.toLowerCase();
      
      const skillKeywords = {
        'java': ['java', 'spring', 'boot', 'jee', 'hibernate', 'maven'],
        'node': ['node', 'express', 'nest', 'typescript', 'js', 'javascript', 'backend'],
        'python': ['python', 'django', 'flask', 'ai', 'ia', 'data', 'intelligence', 'pandas'],
        'react': ['react', 'vue', 'frontend', 'angular', 'web', 'html', 'css', 'js'],
        'mobile': ['mobile', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin', 'react native'],
        'c++': ['c++', 'c ', 'embedded', 'kernel', 'unix', 'linux', 'system'],
        'security': ['security', 'cyber', 'pentest', 'network', 'réseau', 'sécurité'],
        'php': ['php', 'laravel', 'symfony', 'mysql'],
        'web': ['web', 'html', 'css', 'javascript', 'frontend']
      };

      const keywords = skillKeywords[skillQuery] || [skillQuery];
      results = results.filter(offer => {
        const content = `${offer.title} ${offer.little_description}`.toLowerCase();
        return keywords.some(kw => content.includes(kw));
      });
      this.logger.log(`Vagas filtradas por Skill (${skillQuery}): ${results.length}`);
    }

    // Filtro de Tipo de Contrato
    if (contract_type && contract_type.trim() !== "") {
      results = results.filter(offer => 
        (offer.contract_type || "").toLowerCase().includes(contract_type.toLowerCase())
      );
      this.logger.log(`Vagas filtradas por Contrato (${contract_type}): ${results.length}`);
    }

    // Filtro de Público (Target)
    if (target && target.trim() !== "") {
      results = results.filter(offer => {
        const content = `${offer.title} ${offer.little_description}`.toLowerCase();
        if (target === 'student') return content.includes('student') || content.includes('stagiaire');
        if (target === 'alumni') return content.includes('alumni') || content.includes('graduate');
        return true;
      });
      this.logger.log(`Vagas filtradas por Target (${target}): ${results.length}`);
    }

    return results.map((offer: any) => {
      const addressParts = (offer.full_address || "").split(',').map(p => p.trim());
      const extractedCountry = addressParts.length > 0 ? addressParts[addressParts.length - 1] : null;
      let extractedCity = offer.city;
      if (!extractedCity && addressParts.length > 1) {
        extractedCity = addressParts[addressParts.length - 2];
        if (extractedCity && /^[0-9\s-]+$/.test(extractedCity) && addressParts.length > 2) {
          extractedCity = addressParts[addressParts.length - 3];
        }
      }

      return {
        id: offer.id,
        title: offer.title,
        little_description: offer.little_description,
        city: offer.city || extractedCity,
        country: offer.country || extractedCountry,
        address: offer.full_address,
        contract_type: offer.contract_type,
        salary: offer.salary,
        created_at: offer.created_at,
        invalid_at: offer.invalid_at,
        company_name: offer.company?.name || 'Empresa Privada',
        company_logo: offer.company?.logo_url || null,
        is_remote: offer.little_description?.toLowerCase().includes('remote') || 
                   offer.title?.toLowerCase().includes('remote'),
      };
    });
  }

  private async performFetch(): Promise<void> {
    try {
      await this.ensureToken();
      const apiUrl = this.configService.get<string>('API_42_URL') || 'https://api.intra.42.fr';
      const now = new Date();
      
      const baseUrl = `${apiUrl}/v2/offers?page[size]=100&sort=-created_at`;
      const fetchedOffers: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) { 
        const url = `${baseUrl}&page[number]=${page}`;
        this.logger.log(`Buscando 42 Intra página ${page}...`);
        
        const response = await lastValueFrom(
          this.httpService.get(url, {
            headers: { Authorization: `Bearer ${this.apiToken}` },
          }),
        );

        const offers = Array.isArray(response.data) ? response.data : [];
        if (offers.length === 0) {
          hasMore = false;
          break;
        }

        const validOnes = offers.filter((offer: any) => {
          if (!offer.invalid_at) return true;
          return new Date(offer.invalid_at) > now;
        });

        fetchedOffers.push(...validOnes);
        
        if (offers.length < 100) {
          hasMore = false;
        } else {
          page++;
          // Pausa de 1 segundo entre páginas para evitar Rate Limit (429)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.cachedOffers = fetchedOffers;
      this.lastFetchTime = Date.now();
      this.logger.log(`Cache atualizado: ${this.cachedOffers.length} vagas.`);
    } catch (error) {
      this.logger.error('Erro ao buscar na 42:', error.response?.data || error.message);
    } finally {
      this.fetchPromise = null;
    }
  }

  getHealth() {
    return { 
      status: 'OK', 
      apiConnected: !!this.apiToken,
      cacheSize: this.cachedOffers.length,
      cacheAgeSeconds: Math.floor((Date.now() - this.lastFetchTime) / 1000)
    };
  }
}
