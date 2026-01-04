"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTruthyEnv = isTruthyEnv;
exports.getFirstEnv = getFirstEnv;
function isTruthyEnv(value, defaultValue) {
    if (value === undefined)
        return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' ||
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === 'on')
        return true;
    if (normalized === '0' ||
        normalized === 'false' ||
        normalized === 'no' ||
        normalized === 'off')
        return false;
    return defaultValue;
}
function getFirstEnv(keys) {
    for (const key of keys) {
        const v = process.env[key];
        if (v !== undefined && v !== '')
            return v;
    }
    return undefined;
}
//# sourceMappingURL=env.util.js.map