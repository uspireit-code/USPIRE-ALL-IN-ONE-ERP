import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import {
  createCoaRootCategory,
  disableCoaRootCategory,
  listCoaRootCategories,
  setupDefaultCoaRootCategories,
  updateCoaRootCategory,
  type CoaRootCategory,
} from '../../services/coaRootCategories';

export function SettingsCoaRootCategoriesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.COA.UNLOCK);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rows, setRows] = useState<CoaRootCategory[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createAccountType, setCreateAccountType] = useState<CoaRootCategory['accountType']>('ASSET');
  const [createIfrsMappingCode, setCreateIfrsMappingCode] = useState('');
  const [createFsMappingLevel1, setCreateFsMappingLevel1] = useState('');
  const [createFsMappingLevel2, setCreateFsMappingLevel2] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => rows.find((r) => r.id === editingId) ?? null, [rows, editingId]);

  const [editName, setEditName] = useState('');
  const [editIfrsMappingCode, setEditIfrsMappingCode] = useState('');
  const [editFsMappingLevel1, setEditFsMappingLevel1] = useState('');
  const [editFsMappingLevel2, setEditFsMappingLevel2] = useState('');

  const sorted = useMemo(() => {
    return [...(rows ?? [])].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [rows]);

  const resetCreate = () => {
    setCreateCode('');
    setCreateName('');
    setCreateAccountType('ASSET');
    setCreateIfrsMappingCode('');
    setCreateFsMappingLevel1('');
    setCreateFsMappingLevel2('');
  };

  const startEdit = (r: CoaRootCategory) => {
    setEditingId(r.id);
    setEditName(r.name ?? '');
    setEditIfrsMappingCode(r.ifrsMappingCode ?? '');
    setEditFsMappingLevel1(r.fsMappingLevel1 ?? '');
    setEditFsMappingLevel2(r.fsMappingLevel2 ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditIfrsMappingCode('');
    setEditFsMappingLevel1('');
    setEditFsMappingLevel2('');
  };

  async function load() {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCoaRootCategories();
      setRows(Array.isArray(res?.rootCategories) ? res.rootCategories : []);
    } catch (e: any) {
      setRows([]);
      setError(getApiErrorMessage(e, 'Failed to load COA root categories'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  async function onCreate() {
    if (!canManage) return;
    const code = createCode.trim();
    const name = createName.trim();
    if (!code || !name) {
      setError('Code and Name are required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createCoaRootCategory({
        code,
        name,
        accountType: createAccountType,
        ifrsMappingCode: createIfrsMappingCode.trim() || null,
        fsMappingLevel1: createFsMappingLevel1.trim() || null,
        fsMappingLevel2: createFsMappingLevel2.trim() || null,
      });
      setSuccess('Root category created');
      setCreateOpen(false);
      resetCreate();
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Create failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit() {
    if (!canManage || !editing) return;
    const name = editName.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCoaRootCategory({
        id: editing.id,
        name,
        ifrsMappingCode: editIfrsMappingCode.trim() || null,
        fsMappingLevel1: editFsMappingLevel1.trim() || null,
        fsMappingLevel2: editFsMappingLevel2.trim() || null,
      });
      setSuccess('Changes saved');
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onDisable(r: CoaRootCategory) {
    if (!canManage) return;
    const confirmMsg = r.isActive
      ? `Disable root category ${r.code} - ${r.name}? This will also BLOCK the linked root account.`
      : `Root category ${r.code} - ${r.name} is already disabled.`;

    if (!r.isActive) return;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await disableCoaRootCategory({ id: r.id });
      setSuccess('Root category disabled');
      if (editingId === r.id) cancelEdit();
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Disable failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onSetupDefault() {
    if (!canManage) return;
    if (!window.confirm('Create missing default root categories (10000..80000) if they do not already exist?')) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await setupDefaultCoaRootCategories();
      setSuccess(`Defaults applied. Created ${res.createdCount}, skipped ${res.skippedCount}.`);
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Setup default failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div>
        <SettingsPageHeader
          title="COA Root Categories"
          subtitle="Configure top-level Chart of Accounts categories."
        />
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to manage COA root categories.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="COA Root Categories"
        subtitle="Configure top-level Chart of Accounts categories. These are special non-posting root accounts."
        rightSlot={
          <>
            <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={onSetupDefault} disabled={loading || saving}>
              Setup Default
            </Button>
            <Button onClick={() => setCreateOpen((v) => !v)} disabled={saving}>
              {createOpen ? 'Close' : 'New Root Category'}
            </Button>
          </>
        }
      />

      {success ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="success" title="Success">
            {success}
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {createOpen ? (
        <div style={{ marginTop: 14, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>New Root Category</div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center', maxWidth: 920 }}>
            <div>Code</div>
            <Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} disabled={saving} />

            <div>Name</div>
            <Input value={createName} onChange={(e) => setCreateName(e.target.value)} disabled={saving} />

            <div>Account Type</div>
            <select value={createAccountType} onChange={(e) => setCreateAccountType(e.target.value as any)} disabled={saving} style={{ height: 40, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, padding: '0 12px' }}>
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>

            <div>IFRS Mapping</div>
            <Input value={createIfrsMappingCode} onChange={(e) => setCreateIfrsMappingCode(e.target.value)} disabled={saving} />

            <div>FS Mapping L1</div>
            <Input value={createFsMappingLevel1} onChange={(e) => setCreateFsMappingLevel1(e.target.value)} disabled={saving} />

            <div>FS Mapping L2</div>
            <Input value={createFsMappingLevel2} onChange={(e) => setCreateFsMappingLevel2(e.target.value)} disabled={saving} />

            <div />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => { setCreateOpen(false); resetCreate(); setError(null); }} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void onCreate()} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>Root Categories</div>
        <div style={{ padding: 14 }}>
          {loading ? <div style={{ color: tokens.colors.text.muted }}>Loading…</div> : null}

          {!loading ? (
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>Code</DataTable.Th>
                  <DataTable.Th>Name</DataTable.Th>
                  <DataTable.Th>Type</DataTable.Th>
                  <DataTable.Th>Status</DataTable.Th>
                  <DataTable.Th>{' '}</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {sorted.map((r, idx) => (
                  <DataTable.Row key={r.id} zebra index={idx}>
                    <DataTable.Td style={{ fontWeight: 800 }}>{r.code}</DataTable.Td>
                    <DataTable.Td>
                      {editingId === r.id ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={saving} />
                      ) : (
                        <div style={{ fontWeight: 650 }}>{r.name}</div>
                      )}
                    </DataTable.Td>
                    <DataTable.Td>{r.accountType}</DataTable.Td>
                    <DataTable.Td>
                      <span style={{ fontWeight: 700, color: r.isActive ? '#166534' : '#991b1b' }}>{r.isActive ? 'ACTIVE' : 'DISABLED'}</span>
                    </DataTable.Td>
                    <DataTable.Td style={{ textAlign: 'right' }}>
                      {editingId === r.id ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                            Cancel
                          </Button>
                          <Button onClick={() => void onSaveEdit()} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <Button variant="secondary" onClick={() => startEdit(r)} disabled={saving}>
                            Edit
                          </Button>
                          <Button variant="destructive" onClick={() => void onDisable(r)} disabled={saving || !r.isActive}>
                            Disable
                          </Button>
                        </div>
                      )}
                    </DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div style={{ marginTop: 14, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
            Edit Details ({editing.code})
          </div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center', maxWidth: 920 }}>
            <div>IFRS Mapping</div>
            <Input value={editIfrsMappingCode} onChange={(e) => setEditIfrsMappingCode(e.target.value)} disabled={saving} />

            <div>FS Mapping L1</div>
            <Input value={editFsMappingLevel1} onChange={(e) => setEditFsMappingLevel1(e.target.value)} disabled={saving} />

            <div>FS Mapping L2</div>
            <Input value={editFsMappingLevel2} onChange={(e) => setEditFsMappingLevel2(e.target.value)} disabled={saving} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
