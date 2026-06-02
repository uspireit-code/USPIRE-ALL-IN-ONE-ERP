type SegmentFlags = {
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
};

type SegmentValues = {
  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

function resolveRequirements(account: SegmentFlags) {
  return {
    legalEntityRequired: true,
    departmentRequired: Boolean(account.requiresDepartment),
    projectRequired: Boolean(account.requiresProject) || Boolean(account.requiresFund),
    fundRequired: Boolean(account.requiresFund),
  };
}

function validate(account: SegmentFlags, values: SegmentValues) {
  const requirements = resolveRequirements(account);
  const errors: Record<string, string> = {};

  if (requirements.legalEntityRequired && !values.legalEntityId) {
    errors.legalEntity = 'Legal Entity is required.';
  }
  if (requirements.departmentRequired && !values.departmentId) {
    errors.department = 'Department required for this account';
  }
  if (requirements.projectRequired && !values.projectId) {
    errors.project = 'Project required for this account';
  }
  if (requirements.fundRequired && !values.fundId) {
    errors.fund = 'Fund required for this account';
  }

  return errors;
}

describe('dimension governance regression', () => {
  it('allows a legal-entity-only account without department/project/fund', () => {
    expect(validate({}, { legalEntityId: 'le-1' })).toEqual({});
  });

  it('requires department for department-governed accounts', () => {
    expect(validate({ requiresDepartment: true }, { legalEntityId: 'le-1' })).toEqual({
      department: 'Department required for this account',
    });
  });

  it('requires project for project-governed accounts', () => {
    expect(validate({ requiresProject: true }, { legalEntityId: 'le-1' })).toEqual({
      project: 'Project required for this account',
    });
  });

  it('requires fund and project for fund-governed accounts', () => {
    expect(validate({ requiresFund: true }, { legalEntityId: 'le-1' })).toEqual({
      project: 'Project required for this account',
      fund: 'Fund required for this account',
    });
  });

  it('requires all configured dimensions for mixed-dimension accounts', () => {
    expect(
      validate(
        { requiresDepartment: true, requiresProject: true, requiresFund: true },
        { legalEntityId: 'le-1' },
      ),
    ).toEqual({
      department: 'Department required for this account',
      project: 'Project required for this account',
      fund: 'Fund required for this account',
    });
  });
});
