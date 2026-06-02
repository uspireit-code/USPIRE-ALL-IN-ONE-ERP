import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../designTokens';
import { listDepartments, listFunds, listLegalEntities, listProjects, type DepartmentLookup, type FundLookup, type GlAccountLookup, type LegalEntityLookup, type ProjectLookup } from '../services/gl';
import { getSegmentVisibility, validateSegments } from '../finance/segments/segmentRequirements';

export function AccountContextPanel(props: {
  open: boolean;
  journalDate: string;
  account: GlAccountLookup | null;
  restrictLegalEntities?: boolean;
  authorizedLegalEntityIds?: string[];
  legalEntityAccessLoaded?: boolean;
  initialValues: {
    legalEntityId?: string | null;
    departmentId?: string | null;
    projectId?: string | null;
    fundId?: string | null;
  };
  onApply: (values: { legalEntityId: string; departmentId: string | null; projectId: string | null; fundId: string | null }) => void;
  onCancel: () => void;
  onProjectsLoaded?: (projects: ProjectLookup[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [legalEntities, setLegalEntities] = useState<LegalEntityLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [funds, setFunds] = useState<FundLookup[]>([]);

  const [departmentPicker, setDepartmentPicker] = useState('');
  const [projectPicker, setProjectPicker] = useState('');
  const [fundPicker, setFundPicker] = useState('');

  const authorizedLegalEntityIdSet = useMemo(() => {
    if (!Array.isArray(props.authorizedLegalEntityIds)) return null;
    const ids = props.authorizedLegalEntityIds;
    return new Set(ids.map((x) => String(x ?? '').trim()).filter(Boolean));
  }, [props.authorizedLegalEntityIds]);

  const disableLeFilter = useMemo(() => {
    if (!import.meta.env.DEV) return false;
    try {
      return (localStorage.getItem('disableLeFilter') ?? '').toString().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }, []);

  const legalEntitiesForPicker = useMemo(() => {
    if (disableLeFilter) return legalEntities;
    if (!props.restrictLegalEntities) return legalEntities;
    if (!props.legalEntityAccessLoaded) return legalEntities;
    if (!authorizedLegalEntityIdSet) return legalEntities;
    if (authorizedLegalEntityIdSet.size === 0) return [];
    return legalEntities.filter((e) => authorizedLegalEntityIdSet.has(String(e?.id ?? '').trim()));
  }, [authorizedLegalEntityIdSet, disableLeFilter, legalEntities, props.legalEntityAccessLoaded, props.restrictLegalEntities]);

  const departmentById = useMemo(() => new Map(departments.map((d) => [d.id, d] as const)), [departments]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p] as const)), [projects]);
  const fundById = useMemo(() => new Map(funds.map((f) => [f.id, f] as const)), [funds]);

  const [legalEntityId, setLegalEntityId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [fundId, setFundId] = useState<string | null>(null);

  const effectiveOn = (props.journalDate ?? '').slice(0, 10);

  useEffect(() => {
    if (!props.open) return;
    if (!props.account) return;

    let cancelled = false;

    setError(null);
    setLoading(true);

    setLegalEntityId(props.initialValues.legalEntityId ?? null);
    setDepartmentId(props.initialValues.departmentId ?? null);
    setProjectId(props.initialValues.projectId ?? null);
    setFundId(props.initialValues.fundId ?? null);

    setDepartmentPicker('');
    setProjectPicker('');
    setFundPicker('');

    Promise.all([
      listLegalEntities({ effectiveOn }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[ACP][listLegalEntities ERROR]', err);
        throw err;
      }),
      listDepartments({ effectiveOn }).catch(() => []),
    ])
      .then(([les, deps]) => {
        if (cancelled) return;

        console.assert(Array.isArray(les), 'legalEntities must always be an array');

        setLegalEntities(les);
        setDepartments(deps);
      })
      .catch(() => setError('Failed to load dimension lookups.'))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.account, props.initialValues.departmentId, props.initialValues.fundId, props.initialValues.legalEntityId, props.initialValues.projectId, props.open, effectiveOn]);

  useEffect(() => {
    if (!props.open) return;
    if (!props.legalEntityAccessLoaded) return;
    if (loading) return;
    if (legalEntityId) return;
    if (legalEntitiesForPicker.length !== 1) return;

    const only = legalEntitiesForPicker[0];
    if (!only?.id) return;
    setLegalEntityId(only.id);
    setDepartmentId(null);
    setProjectId(null);
    setFundId(null);
    setDepartmentPicker('');
    setProjectPicker('');
    setFundPicker('');
  }, [legalEntitiesForPicker, loading, legalEntityId, props.legalEntityAccessLoaded, props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (!props.account) return;
    if (!props.account.requiresProject) {
      setProjects([]);
      return;
    }
    if (projects.length > 0) return;

    listProjects({ effectiveOn })
      .then((ps) => {
        const arr = Array.isArray(ps) ? ps : [];
        setProjects(arr);
        props.onProjectsLoaded?.(arr);
      })
      .catch(() => undefined);
  }, [effectiveOn, props.account, props.onProjectsLoaded, props.open, projects.length]);

  const selectedProject = projectId ? projectById.get(projectId) : null;
  const visibility = useMemo(() => {
    return getSegmentVisibility({
      account: props.account,
      project: selectedProject,
      legalEntityRequired: true,
    });
  }, [props.account, selectedProject]);

  const dimensionRenderFlags = useMemo(() => {
    return {
      legalEntity: true,
      department: Boolean(visibility.departmentVisible || visibility.departmentRequired || props.account?.requiresDepartment),
      project: Boolean(visibility.projectVisible || visibility.projectRequired || props.account?.requiresProject),
      fund: Boolean(visibility.fundVisible || visibility.fundRequired || props.account?.requiresFund),
    };
  }, [props.account?.requiresDepartment, props.account?.requiresFund, props.account?.requiresProject, visibility.departmentRequired, visibility.departmentVisible, visibility.fundRequired, visibility.fundVisible, visibility.projectRequired, visibility.projectVisible]);

  const effectiveVisibility = useMemo(() => {
    return {
      ...visibility,
      departmentVisible: dimensionRenderFlags.department,
      departmentRequired: Boolean(visibility.departmentRequired || props.account?.requiresDepartment),
      projectVisible: dimensionRenderFlags.project,
      projectRequired: Boolean(visibility.projectRequired || props.account?.requiresProject),
      fundVisible: dimensionRenderFlags.fund,
      fundRequired: Boolean(visibility.fundRequired || props.account?.requiresFund),
    };
  }, [dimensionRenderFlags.department, dimensionRenderFlags.fund, dimensionRenderFlags.project, props.account?.requiresDepartment, props.account?.requiresFund, props.account?.requiresProject, visibility]);

  const segmentErrors = useMemo(() => {
    return validateSegments({
      visibility: effectiveVisibility,
      projectRestricted: Boolean(selectedProject?.isRestricted),
      values: {
        legalEntityId,
        departmentId,
        projectId,
        fundId,
      },
    });
  }, [departmentId, effectiveVisibility, fundId, legalEntityId, projectId, selectedProject?.isRestricted]);

  useEffect(() => {
    if (!props.open) return;
    if (!dimensionRenderFlags.department) {
      if (departmentId !== null) setDepartmentId(null);
      if (departmentPicker) setDepartmentPicker('');
    }
  }, [departmentId, departmentPicker, dimensionRenderFlags.department, props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (!dimensionRenderFlags.fund) {
      setFunds([]);
      return;
    }
    if (!projectId) {
      setFunds([]);
      return;
    }

    listFunds({ effectiveOn, projectId })
      .then((fs) => setFunds(Array.isArray(fs) ? fs : []))
      .catch(() => undefined);
  }, [dimensionRenderFlags.fund, effectiveOn, projectId, props.open]);

  const applyDisabled = useMemo(() => {
    if (!props.account) return true;
    if (segmentErrors.legalEntity) return true;
    if (segmentErrors.department) return true;
    if (segmentErrors.project) return true;
    if (segmentErrors.fund) return true;
    return false;
  }, [props.account, segmentErrors.department, segmentErrors.fund, segmentErrors.legalEntity, segmentErrors.project]);

  const missingRequiredDimensions = useMemo(() => {
    return [
      segmentErrors.legalEntity ? 'Legal Entity' : null,
      segmentErrors.department ? 'Department' : null,
      segmentErrors.project ? 'Project' : null,
      segmentErrors.fund ? 'Fund' : null,
    ].filter((x): x is string => Boolean(x));
  }, [segmentErrors.department, segmentErrors.fund, segmentErrors.legalEntity, segmentErrors.project]);

  const requirementBadge = (required: boolean) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 750,
        color: required ? '#9a3412' : tokens.colors.text.secondary,
        background: required ? '#ffedd5' : tokens.colors.surface.subtle,
        border: `1px solid ${required ? '#fed7aa' : tokens.colors.border.subtle}`,
      }}
    >
      {required ? 'Required' : 'Optional'}
    </span>
  );

  const validationMessage = (message: string) => (
    <div style={{ fontSize: 12, color: '#9a3412', fontWeight: 650 }}>{message}</div>
  );

  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!applyDisabled) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [applyDisabled, props.open]);

  if (!props.open || !props.account) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,12,30,0.52)',
          opacity: props.open ? 1 : 0,
          pointerEvents: props.open ? 'auto' : 'none',
          transition: `opacity ${tokens.transition.normal}`,
          zIndex: 80,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '6vh',
          left: '50%',
          transform: 'translate(-50%, 0)',
          width: 'min(760px, calc(100vw - 32px))',
          maxHeight: '88vh',
          overflow: 'hidden',
          background: tokens.colors.white,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
          zIndex: 81,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: tokens.spacing.x3,
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            background: 'linear-gradient(180deg, rgba(11,12,30,0.03), rgba(11,12,30,0))',
          }}
        >
          <div style={{ fontWeight: 850, fontSize: 16, color: tokens.colors.text.primary }}>Account Context</div>
          <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            Complete required dimensions for the selected account.
          </div>
        </div>

        <div style={{ padding: tokens.spacing.x3, overflow: 'auto', display: 'grid', gap: 12 }}>
          {error ? (
            <div style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(185, 28, 28, 0.25)', background: 'rgba(185, 28, 28, 0.06)', color: '#7f1d1d', fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Selected Account</div>
            <div style={{ fontSize: 14, fontWeight: 750, color: tokens.colors.text.primary }}>
              {props.account.code} — {props.account.name}
            </div>
            {missingRequiredDimensions.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {missingRequiredDimensions.map((dimension) => (
                  <span
                    key={dimension}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 750,
                      color: '#9a3412',
                      background: '#ffedd5',
                      border: '1px solid #fed7aa',
                    }}
                  >
                    Missing {dimension}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Legal Entity
              {requirementBadge(true)}
            </span>
            <select
              value={legalEntityId ?? ''}
              onChange={(e) => {
                const value = e.target.value;

                if (!value) {
                  setLegalEntityId(null);
                  setDepartmentId(null);
                  setProjectId(null);
                  setFundId(null);
                  setDepartmentPicker('');
                  setProjectPicker('');
                  setFundPicker('');
                  return;
                }

                const entity = legalEntitiesForPicker.find((x) => x.id === value);
                if (!entity) return;

                setLegalEntityId(entity.id);
                setDepartmentId(null);
                setProjectId(null);
                setFundId(null);
                setDepartmentPicker('');
                setProjectPicker('');
                setFundPicker('');
              }}
              style={{ width: '100%' }}
              disabled={loading}
            >
              <option value="">Select legal entity</option>
              {legalEntitiesForPicker.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
            {props.restrictLegalEntities && !props.legalEntityAccessLoaded ? (
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Loading legal entity access…</div>
            ) : null}
            {segmentErrors.legalEntity ? validationMessage('Legal Entity required for every journal line') : null}
          </label>

          {dimensionRenderFlags.department ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Department / Cost Centre
                {requirementBadge(effectiveVisibility.departmentRequired)}
              </span>
              <input
                list="acp-departments"
                value={
                  departmentId && departmentById.get(departmentId)
                    ? `${departmentById.get(departmentId)?.code} — ${departmentById.get(departmentId)?.name}`
                    : departmentPicker
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setDepartmentPicker(v);
                  const exact = departments.find((x) => `${x.code} — ${x.name}` === v);
                  if (exact) {
                    setDepartmentId(exact.id);
                    setProjectId(null);
                    setFundId(null);
                    setProjectPicker('');
                    setFundPicker('');
                  } else {
                    setDepartmentId(null);
                    setProjectId(null);
                    setFundId(null);
                  }
                }}
                onBlur={() => {
                  const label = (departmentPicker ?? '').trim();
                  const exact = departments.find((x) => `${x.code} — ${x.name}` === label);
                  if (!exact && !(departmentId && departmentById.get(departmentId))) {
                    setDepartmentPicker('');
                  }
                }}
                disabled={!legalEntityId || loading}
                placeholder={!legalEntityId ? 'Select Legal Entity first…' : loading ? 'Loading…' : 'Search department…'}
                style={{ width: '100%' }}
              />
              <datalist id="acp-departments">
                {departments.map((d) => (
                  <option key={d.id} value={`${d.code} — ${d.name}`} />
                ))}
              </datalist>
              {segmentErrors.department ? validationMessage('Department required for this account') : null}
            </label>
          ) : null}

          {dimensionRenderFlags.project ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Project
                {requirementBadge(effectiveVisibility.projectRequired)}
              </span>
              <input
                list="acp-projects"
                value={
                  projectId && projectById.get(projectId)
                    ? `${projectById.get(projectId)?.code} — ${projectById.get(projectId)?.name}`
                    : projectPicker
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setProjectPicker(v);
                  const exact = projects.find((x) => `${x.code} — ${x.name}` === v);
                  if (exact) {
                    setProjectId(exact.id);
                    setFundId(null);
                    setFundPicker('');
                  } else {
                    setProjectId(null);
                    setFundId(null);
                  }
                }}
                onBlur={() => {
                  const label = (projectPicker ?? '').trim();
                  const exact = projects.find((x) => `${x.code} — ${x.name}` === label);
                  if (!exact && !(projectId && projectById.get(projectId))) {
                    setProjectPicker('');
                  }
                }}
                disabled={(!legalEntityId || (visibility.departmentRequired ? !departmentId : false)) || loading}
                placeholder={
                  !legalEntityId
                    ? 'Select Legal Entity first…'
                    : visibility.departmentRequired
                      ? !departmentId
                        ? 'Select Department first…'
                        : loading
                          ? 'Loading…'
                          : 'Search project…'
                      : loading
                        ? 'Loading…'
                        : 'Search project…'
                }
                style={{ width: '100%' }}
              />
              <datalist id="acp-projects">
                {projects.map((p) => (
                  <option key={p.id} value={`${p.code} — ${p.name}`} />
                ))}
              </datalist>
              {segmentErrors.project ? validationMessage('Project required for this account') : null}
            </label>
          ) : null}

          {dimensionRenderFlags.fund ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Fund
                {requirementBadge(effectiveVisibility.fundRequired)}
              </span>
              <input
                list="acp-funds"
                value={
                  fundId && fundById.get(fundId)
                    ? `${fundById.get(fundId)?.code} — ${fundById.get(fundId)?.name}`
                    : fundPicker
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setFundPicker(v);
                  const exact = funds.find((x) => `${x.code} — ${x.name}` === v);
                  if (exact) {
                    setFundId(exact.id);
                  } else {
                    setFundId(null);
                  }
                }}
                onBlur={() => {
                  const label = (fundPicker ?? '').trim();
                  const exact = funds.find((x) => `${x.code} — ${x.name}` === label);
                  if (!exact && !(fundId && fundById.get(fundId))) {
                    setFundPicker('');
                  }
                }}
                disabled={!projectId || loading}
                placeholder={!projectId ? 'Select Project first…' : loading ? 'Loading…' : 'Search fund…'}
                style={{ width: '100%' }}
              />
              <datalist id="acp-funds">
                {funds.map((f) => (
                  <option key={f.id} value={`${f.code} — ${f.name}`} />
                ))}
              </datalist>
              {segmentErrors.fund ? validationMessage('Fund required for this account') : null}
            </label>
          ) : null}
        </div>

        <div
          style={{
            padding: tokens.spacing.x3,
            borderTop: `1px solid ${tokens.colors.border.subtle}`,
            background: tokens.colors.surface.subtle,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button onClick={props.onCancel} style={{ fontWeight: 650 }}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!props.account) return;
              if (applyDisabled) return;
              if (!legalEntityId) return;

              props.onApply({
                legalEntityId,
                departmentId: dimensionRenderFlags.department ? departmentId : null,
                projectId: dimensionRenderFlags.project ? projectId : null,
                fundId: dimensionRenderFlags.fund ? fundId : null,
              });
            }}
            disabled={applyDisabled}
            style={{ fontWeight: 750 }}
            title={missingRequiredDimensions.length > 0 ? `Resolve: ${missingRequiredDimensions.join(', ')}` : undefined}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
