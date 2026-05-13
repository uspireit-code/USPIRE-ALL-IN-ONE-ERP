import {
  assertGovernanceMetadataComplete,
  buildGovernanceAuditMetadata,
  detectGovernanceDomainsFromPayload,
  assertNoCrossDomainMutation,
} from './governance-enforcement';

describe('governance-enforcement', () => {
  const oldEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...oldEnv };
  });

  it('detectGovernanceDomainsFromPayload returns unique domains for defined keys', () => {
    const domains = detectGovernanceDomainsFromPayload({
      payload: { a: 1, b: 2, c: undefined },
      keyToDomain: { a: 'SYSTEM_GOVERNANCE', b: 'FINANCIAL_GOVERNANCE', c: 'SYSTEM_GOVERNANCE' },
    });
    expect(domains.sort()).toEqual(['FINANCIAL_GOVERNANCE', 'SYSTEM_GOVERNANCE'].sort());
  });

  it('assertGovernanceMetadataComplete warns in non-strict mode', () => {
    process.env.GOVERNANCE_STRICT_MODE = 'false';
    expect(() => assertGovernanceMetadataComplete({} as any, 'TEST')).not.toThrow();
  });

  it('assertGovernanceMetadataComplete throws in strict mode', () => {
    process.env.GOVERNANCE_STRICT_MODE = 'true';
    expect(() => assertGovernanceMetadataComplete({} as any, 'TEST')).toThrow();
  });

  it('assertNoCrossDomainMutation blocks in strict mode', () => {
    process.env.GOVERNANCE_STRICT_MODE = 'true';
    expect(() =>
      assertNoCrossDomainMutation({
        actionType: 'SETTINGS_SYSTEM_GOVERNANCE_UPDATE',
        domainsTouched: ['SYSTEM_GOVERNANCE', 'FINANCIAL_GOVERNANCE'],
      }),
    ).toThrow();
  });

  it('buildGovernanceAuditMetadata includes requestId fallback', () => {
    process.env.GOVERNANCE_STRICT_MODE = 'true';
    const meta = buildGovernanceAuditMetadata({
      actionType: 'SETTINGS_SYSTEM_GOVERNANCE_UPDATE',
      permissionUsed: 'SYSTEM_CONFIG_UPDATE',
      actorUserId: 'u1',
      tenantId: 't1',
    });
    expect(meta.requestId).toBe('UNKNOWN_REQUEST');
    expect(meta.governanceDomain).toBe('SYSTEM_GOVERNANCE');
  });
});
