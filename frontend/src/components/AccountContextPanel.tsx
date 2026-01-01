import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../designTokens';
import { listDepartments, listFunds, listLegalEntities, listProjects, type DepartmentLookup, type FundLookup, type GlAccountLookup, type LegalEntityLookup, type ProjectLookup } from '../services/gl';

export function AccountContextPanel(props: {
  open: boolean;
  journalDate: string;
  account: GlAccountLookup | null;
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

  const [legalEntityPicker, setLegalEntityPicker] = useState('');
  const [departmentPicker, setDepartmentPicker] = useState('');
  const [projectPicker, setProjectPicker] = useState('');
  const [fundPicker, setFundPicker] = useState('');

  const legalEntityById = useMemo(() => new Map(legalEntities.map((e) => [e.id, e] as const)), [legalEntities]);
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

    setError(null);
    setLoading(true);

    setLegalEntityId(props.initialValues.legalEntityId ?? null);
    setDepartmentId(props.initialValues.departmentId ?? null);
    setProjectId(props.initialValues.projectId ?? null);
    setFundId(props.initialValues.fundId ?? null);

    setLegalEntityPicker('');
    setDepartmentPicker('');
    setProjectPicker('');
    setFundPicker('');

    Promise.all([
      listLegalEntities({ effectiveOn }).catch(() => []),
      listDepartments({ effectiveOn }).catch(() => []),
    ])
      .then(([les, deps]) => {
        setLegalEntities(Array.isArray(les) ? les : []);
        setDepartments(Array.isArray(deps) ? deps : []);
      })
      .catch(() => setError('Failed to load dimension lookups.'))
      .finally(() => setLoading(false));
  }, [props.account, props.initialValues.departmentId, props.initialValues.fundId, props.initialValues.legalEntityId, props.initialValues.projectId, props.open, effectiveOn]);

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
  const fundVisible = Boolean(props.account?.requiresFund) || Boolean(selectedProject?.isRestricted);

  const departmentRequirement = useMemo(() => {
    const r = props.account?.departmentRequirement;
    if (r === 'REQUIRED' || r === 'OPTIONAL' || r === 'FORBIDDEN') return r;
    return 'REQUIRED' as const;
  }, [props.account?.departmentRequirement]);

  const departmentVisible = departmentRequirement !== 'FORBIDDEN';
  const departmentRequired = departmentRequirement === 'REQUIRED';

  useEffect(() => {
    if (!props.open) return;
    if (!departmentVisible) {
      if (departmentId !== null) setDepartmentId(null);
      if (departmentPicker) setDepartmentPicker('');
    }
  }, [departmentId, departmentPicker, departmentVisible, props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (!fundVisible) {
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
  }, [effectiveOn, fundVisible, projectId, props.open]);

  const projectVisible = Boolean(props.account?.requiresProject);

  const applyDisabled = useMemo(() => {
    if (!props.account) return true;
    if (!legalEntityId) return true;
    if (departmentRequired && !departmentId) return true;
    if (projectVisible && !projectId) return true;
    if (fundVisible && !fundId) return true;
    return false;
  }, [departmentId, departmentRequired, fundId, fundVisible, legalEntityId, projectId, projectVisible, props.account]);

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

  if (!props.open || !props.account) return null;

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
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            Legal Entity *
            <input
              list="acp-legal-entities"
              value={
                legalEntityId && legalEntityById.get(legalEntityId)
                  ? `${legalEntityById.get(legalEntityId)?.code} — ${legalEntityById.get(legalEntityId)?.name}`
                  : legalEntityPicker
              }
              onChange={(e) => {
                const v = e.target.value;
                setLegalEntityPicker(v);
                const exact = legalEntities.find((x) => `${x.code} — ${x.name}` === v);
                if (exact) {
                  setLegalEntityId(exact.id);
                  setDepartmentId(null);
                  setProjectId(null);
                  setFundId(null);
                  setDepartmentPicker('');
                  setProjectPicker('');
                  setFundPicker('');
                } else {
                  setLegalEntityId(null);
                  setDepartmentId(null);
                  setProjectId(null);
                  setFundId(null);
                }
              }}
              onBlur={() => {
                const label = (legalEntityPicker ?? '').trim();
                const exact = legalEntities.find((x) => `${x.code} — ${x.name}` === label);
                if (!exact && !(legalEntityId && legalEntityById.get(legalEntityId))) {
                  setLegalEntityPicker('');
                }
              }}
              placeholder={loading ? 'Loading…' : 'Search legal entity…'}
              style={{ width: '100%' }}
              disabled={loading}
            />
            <datalist id="acp-legal-entities">
              {legalEntities.map((e) => (
                <option key={e.id} value={`${e.code} — ${e.name}`} />
              ))}
            </datalist>
          </label>

          {departmentVisible ? (
            <label style={{ display: 'grid', gap: 6 }}>
              Department / Cost Centre{departmentRequired ? ' *' : ''}
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
            </label>
          ) : null}

          {projectVisible ? (
            <label style={{ display: 'grid', gap: 6 }}>
              Project *
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
                disabled={(!departmentVisible ? !legalEntityId : departmentRequired ? !departmentId : false) || loading}
                placeholder={
                  !departmentVisible
                    ? !legalEntityId
                      ? 'Select Legal Entity first…'
                      : loading
                        ? 'Loading…'
                        : 'Search project…'
                    : departmentRequired
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
            </label>
          ) : null}

          {fundVisible ? (
            <label style={{ display: 'grid', gap: 6 }}>
              Fund *
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
              if (!legalEntityId) return;
              if (departmentRequired && !departmentId) return;
              if (projectVisible && !projectId) return;
              if (fundVisible && !fundId) return;

              props.onApply({
                legalEntityId,
                departmentId: departmentVisible ? departmentId : null,
                projectId: projectVisible ? projectId : null,
                fundId: fundVisible ? fundId : null,
              });
            }}
            disabled={applyDisabled}
            style={{ fontWeight: 750 }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
