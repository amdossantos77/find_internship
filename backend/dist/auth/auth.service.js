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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const rxjs_1 = require("rxjs");
const supabase_js_1 = require("@supabase/supabase-js");
const notifications_service_1 = require("../notifications/notifications.service");
let AuthService = AuthService_1 = class AuthService {
    httpService;
    configService;
    jwtService;
    notificationsService;
    logger = new common_1.Logger(AuthService_1.name);
    supabase;
    constructor(httpService, configService, jwtService, notificationsService) {
        this.httpService = httpService;
        this.configService = configService;
        this.jwtService = jwtService;
        this.notificationsService = notificationsService;
        this.supabase = (0, supabase_js_1.createClient)(this.configService.get('SUPABASE_URL') || '', this.configService.get('SUPABASE_KEY') || '');
    }
    getLoginUrl() {
        const clientId = this.configService.get('API_42_CLIENT_ID');
        const redirectUri = this.configService.get('OAUTH_REDIRECT_URI') || '';
        const apiUrl = this.configService.get('API_42_URL') || 'https://api.intra.42.fr';
        return `${apiUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public&prompt=login`;
    }
    async validateUser(code) {
        const clientId = this.configService.get('API_42_CLIENT_ID');
        const clientSecret = this.configService.get('API_42_CLIENT_SECRET');
        const redirectUri = this.configService.get('OAUTH_REDIRECT_URI') || '';
        const apiUrl = this.configService.get('API_42_URL') || 'https://api.intra.42.fr';
        try {
            this.logger.log(`Trocando código por token para: ${redirectUri}`);
            const tokenResponse = await (0, rxjs_1.lastValueFrom)(this.httpService.post(`${apiUrl}/oauth/token`, {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri,
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000,
                family: 4
            }));
            const accessToken = tokenResponse.data.access_token;
            const userResponse = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`${apiUrl}/v2/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 60000,
                family: 4
            }));
            const userData = userResponse.data;
            const userProfile = {
                external_id: userData.id,
                login: userData.login,
                email: userData.email,
                last_login: new Date().toISOString(),
            };
            const { data: dbUser } = await this.supabase
                .from('app_users')
                .upsert(userProfile, { onConflict: 'external_id' })
                .select()
                .single();
            const payload = {
                userId: userData.id,
                login: userData.login,
                email: userData.email,
                image: userData.image?.link,
                notifications_enabled: dbUser?.notifications_enabled ?? true
            };
            return {
                access_token: this.jwtService.sign(payload),
                user: payload,
            };
        }
        catch (error) {
            this.logger.error('Erro na autenticação 42:', error.response?.data || error.message);
            throw error;
        }
    }
    async toggleNotifications(userId, enabled) {
        const { data, error } = await this.supabase
            .from('app_users')
            .update({ notifications_enabled: enabled })
            .eq('external_id', userId)
            .select()
            .single();
        if (data) {
            await this.notificationsService.sendStatusEmail(data.email, data.login, enabled);
            this.logger.log(`E-mail de confirmação enviado para @${data.login} (${enabled ? 'ON' : 'OFF'})`);
        }
        return data;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        jwt_1.JwtService,
        notifications_service_1.NotificationsService])
], AuthService);
//# sourceMappingURL=auth.service.js.map