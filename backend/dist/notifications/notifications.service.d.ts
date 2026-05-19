import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private configService;
    private readonly logger;
    private resend;
    private supabase;
    constructor(configService: ConfigService);
    sendStatusEmail(email: string, login: string, enabled: boolean): Promise<import("resend").CreateEmailResponseSuccess | null>;
    private sendEmail;
    handleCron(): Promise<void>;
    private checkOffersForUser;
}
