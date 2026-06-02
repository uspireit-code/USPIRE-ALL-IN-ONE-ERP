export type SegmentFlags = {
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
  departmentRequirement?: 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN';
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

  /**
   * =========================
   * DEPARTMENT GOVERNANCE
   * =========================
   */

  const departmentRequired =
    Boolean(account?.requiresDepartment) ||
    account?.departmentRequirement === 'REQUIRED';

  const departmentForbidden =
    account?.departmentRequirement === 'FORBIDDEN';

  /**
   * Department visibility rules:
   *
   * REQUIRED  -> visible + required
   * OPTIONAL  -> visible + optional
   * FORBIDDEN -> hidden
   * undefined -> hidden
   */
  const departmentVisible =
    !departmentForbidden &&
    (
      account?.departmentRequirement === 'REQUIRED' ||
      account?.departmentRequirement === 'OPTIONAL' ||
      Boolean(account?.requiresDepartment)
    );

  /**
   * =========================
   * PROJECT GOVERNANCE
   * =========================
   */

  const projectRequired =
    Boolean(account?.requiresProject) ||
    Boolean(account?.requiresFund) ||
    projectRestricted;

  /**
   * Project visibility:
   * visible only when governed by account/project rules
   */
  const projectVisible =
    Boolean(account?.requiresProject) ||
    Boolean(account?.requiresFund) ||
    projectRestricted;

  /**
   * =========================
   * FUND GOVERNANCE
   * =========================
   */

  const fundRequired =
    Boolean(account?.requiresFund) ||
    projectRestricted;

  /**
   * Fund visibility:
   * visible only when governed by account/project rules
   */
  const fundVisible =
    Boolean(account?.requiresFund) ||
    projectRestricted;

  return {
    legalEntityVisible: true,
    legalEntityRequired,

    departmentVisible,
    departmentRequired,

    projectVisible,
    projectRequired,

    fundVisible,
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

  /**
   * =========================
   * LEGAL ENTITY VALIDATION
   * =========================
   */

  if (visibility.legalEntityRequired && !values.legalEntityId) {
    errors.legalEntity = 'Legal Entity is required.';
  }

  /**
   * =========================
   * DEPARTMENT VALIDATION
   * =========================
   */

  if (visibility.departmentRequired && !values.departmentId) {
    errors.department = 'Department is required for this account.';
  }

  /**
   * =========================
   * PROJECT VALIDATION
   * =========================
   */

  if (values.fundId && !values.projectId) {
    errors.project = 'Project must be selected before Fund.';
  } else if (visibility.projectRequired && !values.projectId) {
    errors.project = 'Project is required for this account.';
  }

  /**
   * =========================
   * FUND VALIDATION
   * =========================
   */

  if (visibility.fundRequired && !values.fundId) {
    errors.fund = projectRestricted
      ? 'Fund is required because the selected Project is restricted.'
      : 'Fund is required for this account.';
  }

  return errors;
}