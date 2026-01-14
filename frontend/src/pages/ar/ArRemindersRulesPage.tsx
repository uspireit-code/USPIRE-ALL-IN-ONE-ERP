import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import {
  listReminderRules,
  upsertReminderRule,
  type ArReminderLevel,
  type ArReminderRule,
  type ArReminderTriggerType,
} from '../../services/arReminders';

export function ArRemindersRulesPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.AR.REMINDER.VIEW) ||
    hasPermission(PERMISSIONS.FINANCE.VIEW_ALL) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);
  const canConfigure = hasPermission(PERMISSIONS.AR.REMINDER.CONFIGURE);

  const [rules, setRules] = useState<ArReminderRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<ArReminderTriggerType>('AFTER_DUE');
  const [daysOffset, setDaysOffset] = useState('7');
  const [active, setActive] = useState(true);
  const [level, setLevel] = useState<ArReminderLevel>('NORMAL');

  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

  const errBody = (error as ApiError | any)?.body;
  const errMsg =
    typeof errBody?.message === 'string'
      ? errBody.message
      : typeof errBody === 'string'
        ? errBody
        : typeof errBody?.error === 'string'
          ? errBody.error
          : typeof errBody?.reason === 'string'
            ? errBody.reason
            : error
              ? 'Failed to load reminder rules.'
              : '';

  async function refresh() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await listReminderRules();
      setRules(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const clientValidationError = useMemo(() => {
    if (!canConfigure) return '';
    if (!name.trim()) return 'Rule name is required.';
    const n = Number(daysOffset);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Days offset must be an integer.';
    if (triggerType === 'BEFORE_DUE' && n >= 0) return 'BEFORE_DUE rules should have a negative daysOffset.';
    if (triggerType !== 'BEFORE_DUE' && n < 0) return 'ON_DUE/AFTER_DUE rules should have a non-negative daysOffset.';
    return '';
  }, [canConfigure, daysOffset, name, triggerType]);

  async function createRule() {
    if (!canConfigure) return;
    setError(null);

    const msg = clientValidationError;
    if (msg) {
      setError({ body: { message: msg } });
      return;
    }

    setSaving(true);
    try {
      await upsertReminderRule({
        name: name.trim(),
        triggerType,
        daysOffset: Number(daysOffset),
        active,
        escalationLevel: level,
      });
      setName('');
      setDaysOffset('7');
      setActive(true);
      setTriggerType('AFTER_DUE');
      setLevel('NORMAL');
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>AR Reminders — Rules</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/ar/reminders">Manual Trigger</Link>
          <Link to="/ar/reminders/templates">Templates</Link>
          <Link to="/ar">Back</Link>
        </div>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view AR Reminders.</div> : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canConfigure || saving} />
        </label>

        <label>
          Trigger type
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as any)} disabled={!canConfigure || saving}>
            <option value="BEFORE_DUE">BEFORE_DUE</option>
            <option value="ON_DUE">ON_DUE</option>
            <option value="AFTER_DUE">AFTER_DUE</option>
          </select>
        </label>

        <label>
          Days offset
          <input
            value={daysOffset}
            onChange={(e) => setDaysOffset(e.target.value)}
            disabled={!canConfigure || saving}
            style={{ width: 90 }}
          />
        </label>

        <label>
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value as any)} disabled={!canConfigure || saving}>
            <option value="NORMAL">NORMAL</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="FINAL">FINAL</option>
          </select>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canConfigure || saving} />
          Active
        </label>

        <button onClick={() => void createRule()} disabled={!canConfigure || saving}>
          {saving ? 'Saving…' : 'Create rule'}
        </button>

        <button onClick={() => void refresh()} disabled={!canView || loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre> : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Trigger</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Days</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Level</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Active</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.triggerType}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{r.daysOffset}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.escalationLevel}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Rules are governed configuration. Creating/updating rules requires AR_REMINDER_CONFIGURE.
      </div>
    </div>
  );
}
