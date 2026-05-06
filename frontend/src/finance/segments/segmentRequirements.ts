export type SegmentFlags = {
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
};

export type SegmentValues = {
  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

export type SegmentVisibility = {
  legalEntityVisible: boolean;
  legalEntityRequired: boolean;
  departmentVisible: boolean;
  departmentRequired: boolean;
  projectVisible: boolean;
  projectRequired: boolean;
  fundVisible: boolean;
  fundRequired: boolean;
};

export function getSegmentVisibility(params: {
  account: SegmentFlags | null | undefined;
  project?: { isRestricted?: boolean } | null | undefined;
  legalEntityRequired?: boolean;
}): SegmentVisibility {
  const account = params.account;
  const projectRestricted = Boolean(params.project?.isRestricted);
  const legalEntityRequired = params.legalEntityRequired !== false;

  const departmentRequired = Boolean(account?.requiresDepartment);
  const projectRequired = Boolean(account?.requiresProject) || Boolean(account?.requiresFund) || projectRestricted;
  const fundRequired = Boolean(account?.requiresFund) || projectRestricted;

  return {
    legalEntityVisible: true,
    legalEntityRequired,
    departmentVisible: departmentRequired,
    departmentRequired,
    projectVisible: projectRequired,
    projectRequired,
    fundVisible: fundRequired,
    fundRequired,
  };
}

export type SegmentValidationErrors = {
  legalEntity?: string;
  department?: string;
  project?: string;
  fund?: string;
};

export function validateSegments(params: {
  visibility: SegmentVisibility;
  values: SegmentValues;
  projectRestricted?: boolean;
}): SegmentValidationErrors {
  const { visibility, values } = params;
  const projectRestricted = Boolean(params.projectRestricted);

  const errors: SegmentValidationErrors = {};

  if (visibility.legalEntityRequired && !values.legalEntityId) {
    errors.legalEntity = 'Legal Entity is required.';
  }

  if (visibility.departmentRequired && !values.departmentId) {
    errors.department = 'Department is required.';
  }

  if (values.fundId && !values.projectId) {
    errors.project = 'Project must be selected before Fund.';
  } else if (visibility.projectRequired && !values.projectId) {
    errors.project = 'Project is required.';
  }

  if (visibility.fundRequired && !values.fundId) {
    errors.fund = projectRestricted
      ? 'Fund is required because the selected Project is restricted.'
      : 'Fund is required.';
  }

  return errors;
}
