import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(req: Request, dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
        tenant: {
            id: string;
            name: string;
        };
        permissions: string[];
    }>;
    refresh(req: Request, dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    me(req: Request): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            roles: string[];
        };
        tenant: {
            id: string;
            name: string;
        };
        permissions: string[];
    }>;
}
