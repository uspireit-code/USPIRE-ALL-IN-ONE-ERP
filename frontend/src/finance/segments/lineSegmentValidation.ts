import { getSegmentVisibility, validateSegments } from './segmentRequirements';

export type SegmentLine = {
  accountId: string;
  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

export type SegmentAccount = {
  id: string;
  requiresDepartment?: boolean;
  requiresProject?: boolean;
  requiresFund?: boolean;
};

export type SegmentProject = {
  id: string;
  isRestricted?: boolean;
};

export function validateLineSegments(params: {
  line: SegmentLine;
  account: SegmentAccount | null | undefined;
  project: SegmentProject | null | undefined;
  legalEntityRequired?: boolean;
}): { legalEntity?: string; department?: string; project?: string; fund?: string } {
  const visibility = getSegmentVisibility({
    account: params.account,
    project: params.project,
    legalEntityRequired: params.legalEntityRequired,
  });

  return validateSegments({
    visibility,
    projectRestricted: Boolean(params.project?.isRestricted),
    values: {
      legalEntityId: params.line.legalEntityId ?? null,
      departmentId: params.line.departmentId ?? null,
      projectId: params.line.projectId ?? null,
      fundId: params.line.fundId ?? null,
    },
  });
}

export function validateLinesSegments(params: {
  lines: SegmentLine[];
  accountById: Map<string, SegmentAccount>;
  projectById?: Map<string, SegmentProject>;
  legalEntityRequired?: boolean;
}): Map<number, { legalEntity?: string; department?: string; project?: string; fund?: string }> {
  const out = new Map<
    number,
    { legalEntity?: string; department?: string; project?: string; fund?: string }
  >();

  params.lines.forEach((l, idx) => {
    const isNonEmpty = Boolean(l.accountId);
    if (!isNonEmpty) return;

    const account = params.accountById.get(l.accountId);
    const project = l.projectId && params.projectById ? params.projectById.get(l.projectId) : null;

    const errors = validateLineSegments({
      line: l,
      account,
      project,
      legalEntityRequired: params.legalEntityRequired,
    });

    if (errors.legalEntity || errors.department || errors.project || errors.fund) {
      out.set(idx, errors);
    }
  });

  return out;
}
