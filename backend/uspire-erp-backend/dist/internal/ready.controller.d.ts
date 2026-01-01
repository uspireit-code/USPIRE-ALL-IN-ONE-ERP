import { ReadinessService } from './readiness.service';
export declare class ReadyController {
    private readonly readiness;
    constructor(readiness: ReadinessService);
    ready(): Promise<{
        status: string;
        checks: {
            db: "ok";
            storage: "ok";
        };
    }>;
}
