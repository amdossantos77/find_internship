"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const app_service_1 = require("../app.service");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const supabase_js_1 = require("@supabase/supabase-js");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    appService;
    configService;
    logger = new common_1.Logger(NotificationsService_1.name);
    supabase;
    constructor(appService, configService) {
        this.appService = appService;
        this.configService = configService;
        const supabaseUrl = this.configService.get('SUPABASE_URL') || '';
        const supabaseKey = this.configService.get('SUPABASE_KEY') || '';
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    async handleCron() {
        this.logger.log('Iniciando verificação de novas oportunidades para todos os utilizadores...');
        const offers = await this.appService.getOffers();
        const luandaTarget = offers.filter(o => (o.address || '').toLowerCase().includes('angola') ||
            (o.address || '').toLowerCase().includes('luanda'));
        const freelanceTarget = offers.filter(o => (o.contract_type || '').toLowerCase().includes('freelance'));
        const remoteTarget = offers.filter(o => o.is_remote);
        const allTargets = [...new Set([...luandaTarget, ...freelanceTarget, ...remoteTarget])];
        if (allTargets.length === 0) {
            this.logger.log('Nenhuma vaga especial encontrada.');
            return;
        }
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
                const { data: alreadyNotified } = await this.supabase
                    .from('notified_offers')
                    .select('id')
                    .eq('offer_id', offer.id)
                    .single();
                if (!alreadyNotified) {
                    await this.sendEmail(offer, user.email);
                    await this.supabase.from('notified_offers').insert([{ offer_id: offer.id }]);
                    this.logger.log(`Notificação enviada para @${user.login}: ${offer.title}`);
                }
            }
        }
    }
    async sendStatusEmail(email, login, enabled) {
        const transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
        await transporter.sendMail({
            from: `"Find Internship Bot" <${this.configService.get('SMTP_USER')}>`,
            to: email,
            subject: `🔔 Bot de Vagas: ${enabled ? 'ATIVADO' : 'DESATIVADO'}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px; border-radius: 12px; text-align: center;">
          <h2 style="color: ${enabled ? '#10b981' : '#e11d48'};">${enabled ? '✅ Ativado com Sucesso!' : '❌ Desativado'}</h2>
          <p>Olá <strong>${login}</strong>,</p>
          <p>Confirmamos que o teu bot de notificações para novas vagas foi <strong>${enabled ? 'ligado' : 'desligado'}</strong>.</p>
          ${enabled
                ? '<p>Agora vais receber alertas de vagas em Angola, Remote e Freelance assim que forem publicadas!</p>'
                : '<p>Não vais receber mais alertas automáticos por agora. Podes ligar novamente quando quiseres no dashboard.</p>'}
          <div style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
            Find Internship - 42 Luanda & Global
          </div>
        </div>
      `,
        });
    }
    async sendEmail(offer, targetEmail) {
        const transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
        const formatDate = (dateStr) => {
            if (!dateStr)
                return 'Não definida';
            return new Intl.DateTimeFormat('pt-PT').format(new Date(dateStr));
        };
        const info = await transporter.sendMail({
            from: `"Find Internship Bot" <${this.configService.get('SMTP_USER')}>`,
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
};
exports.NotificationsService = NotificationsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_6_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "handleCron", null);
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map