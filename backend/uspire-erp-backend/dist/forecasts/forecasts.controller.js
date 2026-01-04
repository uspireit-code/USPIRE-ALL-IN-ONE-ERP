"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForecastsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const create_forecast_dto_1 = require("./dto/create-forecast.dto");
const update_forecast_lines_dto_1 = require("./dto/update-forecast-lines.dto");
const forecasts_service_1 = require("./forecasts.service");
let ForecastsController = class ForecastsController {
    forecasts;
    constructor(forecasts) {
        this.forecasts = forecasts;
    }
    async createForecast(req, dto) {
        return this.forecasts.createForecast(req, dto);
    }
    async listForecasts(req, fiscalYear, limit, offset) {
        const fy = fiscalYear ? Number(fiscalYear) : undefined;
        const parsedLimit = limit === undefined ? undefined : Number(limit);
        const parsedOffset = offset === undefined ? undefined : Number(offset);
        return this.forecasts.listForecasts(req, {
            fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
            limit: parsedLimit !== undefined && Number.isFinite(parsedLimit)
                ? parsedLimit
                : undefined,
            offset: parsedOffset !== undefined && Number.isFinite(parsedOffset)
                ? parsedOffset
                : undefined,
        });
    }
    async getForecast(req, id) {
        return this.forecasts.getForecast(req, id);
    }
    async getForecastActuals(req, id) {
        return this.forecasts.getForecastActuals(req, id);
    }
    async getForecastVariance(req, id) {
        return this.forecasts.getForecastVariance(req, id);
    }
    async submitForecast(req, id) {
        return this.forecasts.submitForecast(req, id);
    }
    async approveForecast(req, id) {
        return this.forecasts.approveForecast(req, id);
    }
    async updateForecastLines(req, id, dto) {
        return this.forecasts.updateForecastLines(req, id, dto);
    }
};
exports.ForecastsController = ForecastsController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('forecast.create'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_forecast_dto_1.CreateForecastDto]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "createForecast", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('forecast.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('fiscalYear')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "listForecasts", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('forecast.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "getForecast", null);
__decorate([
    (0, common_1.Get)(':id/actuals'),
    (0, permissions_decorator_1.Permissions)('forecast.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "getForecastActuals", null);
__decorate([
    (0, common_1.Get)(':id/variance'),
    (0, permissions_decorator_1.Permissions)('forecast.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "getForecastVariance", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, permissions_decorator_1.Permissions)('forecast.submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "submitForecast", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, permissions_decorator_1.Permissions)('forecast.approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "approveForecast", null);
__decorate([
    (0, common_1.Patch)(':id/lines'),
    (0, permissions_decorator_1.Permissions)('forecast.edit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_forecast_lines_dto_1.UpdateForecastLinesDto]),
    __metadata("design:returntype", Promise)
], ForecastsController.prototype, "updateForecastLines", null);
exports.ForecastsController = ForecastsController = __decorate([
    (0, common_1.Controller)('forecasts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [forecasts_service_1.ForecastsService])
], ForecastsController);
//# sourceMappingURL=forecasts.controller.js.map