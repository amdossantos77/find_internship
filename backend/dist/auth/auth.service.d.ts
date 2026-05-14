import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications/notifications.service';
export declare class AuthService {
    private readonly httpService;
    private readonly configService;
    private readonly jwtService;
    private readonly notificationsService;
    private readonly logger;
    private supabase;
    constructor(httpService: HttpService, configService: ConfigService, jwtService: JwtService, notificationsService: NotificationsService);
    getLoginUrl(): string;
    validateUser(code: string): Promise<{
        access_token: string;
        user: {
            userId: any;
            login: any;
            email: any;
            image: any;
            notifications_enabled: any;
        };
    }>;
    toggleNotifications(userId: number, enabled: boolean): Promise<any>;
}
