"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeterministicReportEntityId = buildDeterministicReportEntityId;
const crypto_1 = require("crypto");
function stableStringify(value) {
    if (value === null || value === undefined)
        return 'null';
    if (typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((v) => stableStringify(v)).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(',')}}`;
}
function buildDeterministicReportEntityId(params) {
    const canonical = [
        `reportType=${params.reportType}`,
        `from=${params.from ?? ''}`,
        `to=${params.to ?? ''}`,
        `compareFrom=${params.compareFrom ?? ''}`,
        `compareTo=${params.compareTo ?? ''}`,
        `filters=${stableStringify(params.filters ?? {})}`,
    ].join('\n');
    const hash = (0, crypto_1.createHash)('sha256').update(canonical).digest('hex');
    return {
        entityId: `${params.reportType}|${hash}`,
        canonicalString: canonical,
        hash,
    };
}
//# sourceMappingURL=report-id.util.js.map