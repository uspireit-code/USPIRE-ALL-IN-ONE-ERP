"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageProvider = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
const env_util_1 = require("../internal/env.util");
let LocalStorageProvider = class LocalStorageProvider {
    rootDir;
    constructor() {
        const base = (0, env_util_1.getFirstEnv)(['STORAGE_LOCAL_PATH']) ?? './storage';
        this.rootDir = path.join(process.cwd(), base, 'evidence');
    }
    resolvePath(key) {
        const normalized = key.replace(/\\/g, '/');
        return path.join(this.rootDir, normalized);
    }
    async put(key, body) {
        const fullPath = this.resolvePath(key);
        await node_fs_1.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await node_fs_1.promises.writeFile(fullPath, body);
    }
    async get(key) {
        const fullPath = this.resolvePath(key);
        return node_fs_1.promises.readFile(fullPath);
    }
    async exists(key) {
        const fullPath = this.resolvePath(key);
        try {
            await node_fs_1.promises.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.LocalStorageProvider = LocalStorageProvider;
exports.LocalStorageProvider = LocalStorageProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LocalStorageProvider);
//# sourceMappingURL=local-storage.provider.js.map