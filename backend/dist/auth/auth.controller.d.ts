import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    private readonly logger;
    constructor(authService: AuthService, configService: ConfigService);
    login(res: Response): Promise<void>;
    callback(code: string, res: Response): Promise<void>;
    toggleNotifications(req: any, body: {
        enabled: boolean;
    }): Promise<any>;
    updateFilters(req: any, body: {
        filters: any;
    }): Promise<any>;
}
