import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { ApiError } from '../../services/api';
import {
  listReminderTemplates,
  upsertReminderTemplate,
  type ArReminderLevel,
  type ArReminderTemplate,
} from '../../services/arReminders';

export function ArRemindersTemplatesPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission('AR_REMINDER_VIEW') || hasPermission('FINANCE_VIEW_ALL') || hasPermission('SYSTEM_VIEW_ALL');
  const canConfigure = hasPermission('AR_REMINDER_CONFIGURE');

  const [templates, setTemplates] = useState<ArReminderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);

  const [level, setLevel] = useState<ArReminderLevel>('NORMAL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [active, setActive] = useState(true);

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
              ? 'Failed to load reminder templates.'
              : '';

  async function refresh() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await listReminderTemplates();
      setTemplates(res);
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

  const selectedTemplate = useMemo(() => templates.find((t) => t.level === level) ?? null, [level, templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject);
    setBody(selectedTemplate.body);
    setActive(selectedTemplate.active);
  }, [selectedTemplate?.id]);

  async function save() {
    if (!canConfigure) return;
    setError(null);

    if (!subject.trim()) {
      setError({ body: { message: 'Subject is required.' } });
      return;
    }
    if (!body.trim()) {
      setError({ body: { message: 'Body is required.' } });
      return;
    }

    setSaving(true);
    try {
      await upsertReminderTemplate({
        id: selectedTemplate?.id,
        level,
        subject,
        body,
        active,
      });
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
        <h2>AR Reminders — Templates</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/ar/reminders">Manual Trigger</Link>
          <Link to="/ar/reminders/rules">Rules</Link>
          <Link to="/ar">Back</Link>
        </div>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view AR Reminders.</div> : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value as any)} disabled={!canView || loading}>
            <option value="NORMAL">NORMAL</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="FINAL">FINAL</option>
          </select>
        </label>

        <button onClick={() => void refresh()} disabled={!canView || loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre> : null}

      {canView ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canConfigure || saving} />
          </label>

          <label>
            Body
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!canConfigure || saving}
              rows={8}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canConfigure || saving} />
            Active
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => void save()} disabled={!canConfigure || saving}>
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: '#666' }}>
            Templates are governed content. Editing requires AR_REMINDER_CONFIGURE.
          </div>
        </div>
      ) : null}
    </div>
  );
}
