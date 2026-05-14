import { AppService } from '../app.service';
import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private readonly appService;
    private readonly configService;
    private readonly logger;
    private supabase;
    constructor(appService: AppService, configService: ConfigService);
    handleCron(): Promise<void>;
    sendStatusEmail(email: string, login: string, enabled: boolean): Promise<void>;
    private sendEmail;
}
