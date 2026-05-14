import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHealth(): {
        status: string;
        apiConnected: boolean;
        cacheSize: number;
        cacheAgeSeconds: number;
    };
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
}
