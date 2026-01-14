import { PrismaService } from '../prisma/prisma.service';
export declare class ReadinessService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    checkDb(): Promise<'ok' | 'fail'>;
    checkStorage(): Promise<'ok' | 'fail'>;
}
