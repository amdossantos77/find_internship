import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export declare class AppService implements OnModuleInit {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private apiToken;
    private tokenExpiresAt;
    private supabase;
    constructor(httpService: HttpService, configService: ConfigService);
    onModuleInit(): Promise<void>;
    private refreshToken;
    private ensureToken;
    private cachedOffers;
    private lastFetchTime;
    private readonly CACHE_TTL;
    private fetchPromise;
    getOffers(city?: string, country?: string, contract_type?: string, expertise_id?: string, target?: string): Promise<{
        id: any;
        title: any;
        little_description: any;
        city: any;
        country: any;
        address: any;
        contract_type: any;
        salary: any;
        created_at: any;
        invalid_at: any;
        company_name: any;
        company_logo: any;
        is_remote: any;
    }[]>;
    private performFetch;
    syncOffersCron(): Promise<void>;
    getHealth(): {
        status: string;
        apiConnected: boolean;
        cacheSize: number;
        cacheAgeSeconds: number;
    };
}
