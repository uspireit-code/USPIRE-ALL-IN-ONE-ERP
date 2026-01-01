export declare function buildDeterministicReportEntityId(params: {
    reportType: 'PL' | 'BS' | 'SOCE' | 'CF';
    from?: string;
    to?: string;
    compareFrom?: string;
    compareTo?: string;
    filters?: Record<string, any>;
}): {
    entityId: string;
    canonicalString: string;
    hash: string;
};
