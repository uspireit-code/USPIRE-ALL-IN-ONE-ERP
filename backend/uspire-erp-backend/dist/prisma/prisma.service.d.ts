import { OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/index';
export declare class PrismaService extends PrismaClient implements OnModuleInit {
    private readonly logger;
    onModuleInit(): Promise<void>;
}
