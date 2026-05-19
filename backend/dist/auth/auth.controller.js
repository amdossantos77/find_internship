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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const config_1 = require("@nestjs/config");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
let AuthController = AuthController_1 = class AuthController {
    authService;
    configService;
    logger = new common_1.Logger(AuthController_1.name);
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    async login(res) {
        const url = this.authService.getLoginUrl();
        this.logger.log(`Redirecionando para login 42: ${url}`);
        return res.redirect(url);
    }
    async callback(code, res) {
        const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
        try {
            this.logger.log('Recebido callback da 42 com código.');
            const data = await this.authService.validateUser(code);
            const userStr = encodeURIComponent(JSON.stringify(data.user));
            return res.redirect(`${frontendUrl}?token=${data.access_token}&user=${userStr}`);
        }
        catch (error) {
            this.logger.error('Erro no callback de autenticação:', error.message);
            return res.redirect(`${frontendUrl}?error=auth_failed`);
        }
    }
    async toggleNotifications(req, body) {
        const userId = req.user.userId;
        return this.authService.toggleNotifications(userId, body.enabled);
    }
    async updateFilters(req, body) {
        const userId = req.user.userId;
        return this.authService.updateFilters(userId, body.filters);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('login'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "callback", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('notifications'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "toggleNotifications", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('filters'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateFilters", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map