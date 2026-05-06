import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../designTokens';
import {
  listDepartments,
  listFunds,
  listProjects,
  type DepartmentLookup,
  type FundLookup,
  type ProjectLookup,
} from '../../services/gl';
import { getSegmentVisibility } from './segmentRequirements';

export function LineSegmentFields(props: {
  effectiveOn: string;
  account: {
    id: string;
    requiresDepartment?: boolean;
    requiresProject?: boolean;
    requiresFund?: boolean;
  } | null;
  values: {
    departmentId?: string | null;
    projectId?: string | null;
    fundId?: string | null;
  };
  errors?: {
    department?: string;
    project?: string;
    fund?: string;
  };
  disabled?: boolean;
  onChange: (patch: { departmentId?: string | null; projectId?: string | null; fundId?: string | null }) => void;
}) {
  const effectiveOn = (props.effectiveOn ?? '').slice(0, 10);

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [funds, setFunds] = useState<FundLookup[]>([]);

  const departmentById = useMemo(
    () => new Map(departments.map((d) => [d.id, d] as const)),
    [departments],
  );
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p] as const)),
    [projects],
  );
  const fundById = useMemo(() => new Map(funds.map((f) => [f.id, f] as const)), [funds]);

  const selectedProject = props.values.projectId
    ? projectById.get(String(props.values.projectId))
    : null;

  const visibility = useMemo(() => {
    return getSegmentVisibility({
      account: props.account,
      project: selectedProject,
      legalEntityRequired: false,
    });
  }, [props.account, selectedProject]);

  useEffect(() => {
    if (!effectiveOn) return;

    let mounted = true;
    setLoading(true);

    Promise.all([
      visibility.departmentVisible ? listDepartments({ effectiveOn }).catch(() => []) : Promise.resolve([]),
      visibility.projectVisible ? listProjects({ effectiveOn }).catch(() => []) : Promise.resolve([]),
    ])
      .then(([deps, ps]) => {
        if (!mounted) return;
        setDepartments(Array.isArray(deps) ? deps : []);
        setProjects(Array.isArray(ps) ? ps : []);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [effectiveOn, visibility.departmentVisible, visibility.projectVisible]);

  useEffect(() => {
    if (!visibility.fundVisible) {
      setFunds([]);
      return;
    }
    const projectId = String(props.values.projectId ?? '').trim();
    if (!projectId) {
      setFunds([]);
      return;
    }

    listFunds({ effectiveOn, projectId })
      .then((fs) => setFunds(Array.isArray(fs) ? fs : []))
      .catch(() => undefined);
  }, [effectiveOn, props.values.projectId, visibility.fundVisible]);

  useEffect(() => {
    if (!visibility.departmentVisible && props.values.departmentId) {
      props.onChange({ departmentId: null });
    }
  }, [props.values.departmentId, visibility.departmentVisible]);

  useEffect(() => {
    if (!visibility.projectVisible && props.values.projectId) {
      props.onChange({ projectId: null, fundId: null });
    }
  }, [props.values.projectId, visibility.projectVisible]);

  useEffect(() => {
    if (!visibility.fundVisible && props.values.fundId) {
      props.onChange({ fundId: null });
    }
  }, [props.values.fundId, visibility.fundVisible]);

  const disabled = Boolean(props.disabled) || loading;

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 8,
    border: `1px solid ${tokens.colors.border.subtle}`,
  };

  const errorStyle: React.CSSProperties = { fontSize: 12, color: '#9a3412' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {visibility.departmentVisible ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.colors.text.secondary }}>
            Department{visibility.departmentRequired ? ' *' : ''}
          </div>
          <select
            value={props.values.departmentId ?? ''}
            onChange={(e) => props.onChange({ departmentId: e.target.value || null })}
            disabled={disabled}
            style={fieldStyle}
          >
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
          {props.errors?.department ? <div style={errorStyle}>{props.errors.department}</div> : null}
        </div>
      ) : (
        <div />
      )}

      {visibility.projectVisible ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.colors.text.secondary }}>
            Project{visibility.projectRequired ? ' *' : ''}
          </div>
          <select
            value={props.values.projectId ?? ''}
            onChange={(e) => props.onChange({ projectId: e.target.value || null, fundId: null })}
            disabled={disabled}
            style={fieldStyle}
          >
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          {props.errors?.project ? <div style={errorStyle}>{props.errors.project}</div> : null}
        </div>
      ) : (
        <div />
      )}

      {visibility.fundVisible ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.colors.text.secondary }}>
            Fund{visibility.fundRequired ? ' *' : ''}
          </div>
          <select
            value={props.values.fundId ?? ''}
            onChange={(e) => props.onChange({ fundId: e.target.value || null })}
            disabled={disabled || !props.values.projectId}
            style={fieldStyle}
          >
            <option value="">{props.values.projectId ? 'Select…' : 'Select Project first…'}</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.name}
              </option>
            ))}
          </select>
          {props.errors?.fund ? <div style={errorStyle}>{props.errors.fund}</div> : null}
        </div>
      ) : (
        <div />
      )}

      {loading ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: tokens.colors.text.muted }}>
          Loading segments…
        </div>
      ) : null}

      {props.values.departmentId && !departmentById.get(String(props.values.departmentId)) && visibility.departmentVisible ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9a3412' }}>
          Selected Department could not be loaded.
        </div>
      ) : null}

      {props.values.projectId && !projectById.get(String(props.values.projectId)) && visibility.projectVisible ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9a3412' }}>
          Selected Project could not be loaded.
        </div>
      ) : null}

      {props.values.fundId && !fundById.get(String(props.values.fundId)) && visibility.fundVisible ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9a3412' }}>
          Selected Fund could not be loaded.
        </div>
      ) : null}
    </div>
  );
}
