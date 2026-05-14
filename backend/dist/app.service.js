"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let AppService = AppService_1 = class AppService {
    httpService;
    configService;
    logger = new common_1.Logger(AppService_1.name);
    apiToken = '';
    tokenExpiresAt = 0;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
    }
    async onModuleInit() {
        await this.refreshToken();
    }
    async refreshToken() {
        try {
            const clientId = this.configService.get('API_42_CLIENT_ID');
            const clientSecret = this.configService.get('API_42_CLIENT_SECRET');
            const apiUrl = this.configService.get('API_42_URL') || 'https://api.intra.42.fr';
            this.logger.log('Solicitando novo token Access Client Credentials na 42...');
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.post(`${apiUrl}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }));
            this.apiToken = response.data.access_token;
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - (5 * 60 * 1000);
            this.logger.log('Token da API 42 obtido com sucesso.');
        }
        catch (error) {
            this.logger.error('Erro ao obter token da API 42:', error.response?.data || error.message);
        }
    }
    async ensureToken() {
        if (!this.apiToken || Date.now() > this.tokenExpiresAt) {
            await this.refreshToken();
        }
    }
    cachedOffers = [];
    lastFetchTime = 0;
    CACHE_TTL = 10 * 60 * 1000;
    fetchPromise = null;
    async getOffers(city, country, contract_type, expertise_id, target) {
        const currentTime = Date.now();
        if (this.cachedOffers.length === 0 || (currentTime - this.lastFetchTime) >= this.CACHE_TTL) {
            if (!this.fetchPromise) {
                this.fetchPromise = this.performFetch();
            }
            this.logger.log('Aguardando atualização do cache...');
            await this.fetchPromise;
        }
        else {
            this.logger.log('Usando ofertas do cache (Instantâneo)');
        }
        const countryMapping = {
            'FR': 'France', 'ES': 'Spain', 'PT': 'Portugal', 'BR': 'Brazil', 'AO': 'Angola',
            'BE': 'Belgium', 'DE': 'Germany', 'CH': 'Switzerland', 'IT': 'Italy', 'MA': 'Morocco',
            'LU': 'Luxembourg', 'UK': 'United Kingdom', 'US': 'United States'
        };
        let results = this.cachedOffers;
        if (country && country.trim() !== "") {
            const targetCountry = (countryMapping[country.trim().toUpperCase()] || country.trim()).toLowerCase();
            results = results.filter(offer => (offer.full_address || "").toLowerCase().includes(targetCountry));
        }
        if (city && city.trim() !== "") {
            const cityQuery = city.trim().toLowerCase();
            results = results.filter(offer => (offer.full_address || "").toLowerCase().includes(cityQuery) ||
                (offer.city || "").toLowerCase().includes(cityQuery));
        }
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
        return results.map((offer) => {
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
    async performFetch() {
        try {
            await this.ensureToken();
            const apiUrl = this.configService.get('API_42_URL') || 'https://api.intra.42.fr';
            const now = new Date();
            const baseUrl = `${apiUrl}/v2/offers?page[size]=100&sort=-created_at`;
            const fetchedOffers = [];
            let page = 1;
            let hasMore = true;
            while (hasMore && page <= 10) {
                const url = `${baseUrl}&page[number]=${page}`;
                this.logger.log(`Buscando 42 Intra página ${page}...`);
                const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, {
                    headers: { Authorization: `Bearer ${this.apiToken}` },
                }));
                const offers = Array.isArray(response.data) ? response.data : [];
                if (offers.length === 0) {
                    hasMore = false;
                    break;
                }
                const validOnes = offers.filter((offer) => {
                    if (!offer.invalid_at)
                        return true;
                    return new Date(offer.invalid_at) > now;
                });
                fetchedOffers.push(...validOnes);
                if (offers.length < 100)
                    hasMore = false;
                else
                    page++;
            }
            this.cachedOffers = fetchedOffers;
            this.lastFetchTime = Date.now();
            this.logger.log(`Cache atualizado: ${this.cachedOffers.length} vagas.`);
        }
        catch (error) {
            this.logger.error('Erro ao buscar na 42:', error.response?.data || error.message);
        }
        finally {
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
};
exports.AppService = AppService;
exports.AppService = AppService = AppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AppService);
//# sourceMappingURL=app.service.js.map