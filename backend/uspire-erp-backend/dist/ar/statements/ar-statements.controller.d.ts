import type { Request } from 'express';
import { ArStatementsService } from './ar-statements.service';
export declare class ArStatementsController {
    private readonly statements;
    constructor(statements: ArStatementsService);
    get(req: Request, customerId: string, fromDate?: string, toDate?: string, asOfDate?: string): Promise<import("./ar-statements.service").ArStatementResponse>;
}
