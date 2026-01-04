"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNoUnsupportedDimensions = assertNoUnsupportedDimensions;
const common_1 = require("@nestjs/common");
const EXPLICITLY_UNSUPPORTED_DIMENSION_FIELDS = [
    'costCentreId',
    'costCenterId',
    'departmentId',
];
function assertNoUnsupportedDimensions(query, allowedKeys) {
    if (!query)
        return;
    for (const f of EXPLICITLY_UNSUPPORTED_DIMENSION_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(query, f)) {
            throw new common_1.BadRequestException(`Unsupported filter: ${f} (dimension not present on postings)`);
        }
    }
    const allowed = new Set(allowedKeys);
    for (const key of Object.keys(query)) {
        if (allowed.has(key))
            continue;
        if (/Id$/.test(key)) {
            throw new common_1.BadRequestException(`Unsupported filter: ${key} (dimension not present on postings)`);
        }
    }
}
//# sourceMappingURL=report-query.validator.js.map