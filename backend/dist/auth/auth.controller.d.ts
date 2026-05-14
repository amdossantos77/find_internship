import { AuthService } from './auth.service';
import type { Response } from 'express';
export declare class AuthController {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthService);
    login(res: Response): Promise<void>;
    callback(code: string, res: Response): Promise<void>;
    toggleNotifications(body: {
        userId: number;
        enabled: boolean;
    }): Promise<any>;
}
