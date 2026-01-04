"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsAny = exports.Permissions = exports.PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMISSIONS_KEY = 'permissions';
const Permissions = (...permissions) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions);
exports.Permissions = Permissions;
const PermissionsAny = (...permissions) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, {
    mode: 'any',
    permissions,
});
exports.PermissionsAny = PermissionsAny;
//# sourceMappingURL=permissions.decorator.js.map