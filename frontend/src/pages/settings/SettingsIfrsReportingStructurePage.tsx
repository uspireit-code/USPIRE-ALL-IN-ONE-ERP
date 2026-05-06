import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import { getCoaHealth } from '../../services/coaHealth';
import {
  createIfrsNode,
  deactivateIfrsNode,
  listIfrsNodesTree,
  type IfrsNodeTree,
  type IfrsNodesTreeResponse,
  type IfrsStatement,
  updateIfrsNode,
} from '../../services/coa';

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,12,30,0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 60,
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 560,
          maxWidth: '96vw',
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(11,12,30,0.08)',
          boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid rgba(11,12,30,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
            {props.subtitle ? <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{props.subtitle}</div> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>
        {props.footer ? (
          <div
            style={{
              padding: 16,
              borderTop: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 -8px 20px rgba(11,12,30,0.06)',
              background: '#fff',
            }}
          >
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function statementLabel(s: IfrsStatement) {
  if (s === 'BS') return 'Balance Sheet (BS)';
  if (s === 'PL') return 'Profit & Loss (PL)';
  return 'Cash Flow (CF)';
}

function computeHasActiveChildren(node: IfrsNodeTree): boolean {
  for (const c of node.children ?? []) {
    if (c.isActive) return true;
    if (computeHasActiveChildren(c)) return true;
  }
  return false;
}

export function SettingsIfrsReportingStructurePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [coaStructureFrozen, setCoaStructureFrozen] = useState(false);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [tree, setTree] = useState<IfrsNodesTreeResponse>({ BS: [], PL: [], CF: [] });

  const [createOpen, setCreateOpen] = useState(false);
  const [createStatement, setCreateStatement] = useState<IfrsStatement>('BS');
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState<string>('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState<string>('');

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string>('');
  const [deactivateHasActiveChildren, setDeactivateHasActiveChildren] = useState(false);

  async function refresh() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const [out, health] = await Promise.all([
        listIfrsNodesTree({ includeInactive }),
        getCoaHealth().catch(() => null),
      ]);
      setTree(out);
      setCoaStructureFrozen(Boolean((health as any)?.structureFreeze?.coaStructureFrozen));
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load IFRS reporting structure'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const flatParentsByStatement = useMemo(() => {
    const mk = (statement: IfrsStatement) => {
      const nodes = tree[statement] ?? [];
      const out: Array<{ id: string; label: string; depth: number; isActive: boolean }> = [];
      const walk = (n: IfrsNodeTree, depth: number) => {
        out.push({ id: n.id, label: n.name, depth, isActive: n.isActive });
        for (const c of n.children ?? []) walk(c, depth + 1);
      };
      for (const r of nodes) walk(r, 0);
      return out;
    };
    return {
      BS: mk('BS'),
      PL: mk('PL'),
      CF: mk('CF'),
    } as Record<IfrsStatement, Array<{ id: string; label: string; depth: number; isActive: boolean }>>;
  }, [tree]);

  const allNodesById = useMemo(() => {
    const map = new Map<string, { node: IfrsNodeTree; statement: IfrsStatement }>();
    const walk = (statement: IfrsStatement, nodes: IfrsNodeTree[]) => {
      for (const n of nodes) {
        map.set(n.id, { node: n, statement });
        walk(statement, n.children ?? []);
      }
    };
    walk('BS', tree.BS ?? []);
    walk('PL', tree.PL ?? []);
    walk('CF', tree.CF ?? []);
    return map;
  }, [tree]);

  function openCreate(statement: IfrsStatement, parentId?: string | null) {
    if (coaStructureFrozen) return;
    setCreateStatement(statement);
    setCreateName('');
    setCreateParentId(parentId ? String(parentId) : '');
    setCreateOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(id: string) {
    if (coaStructureFrozen) return;
    const hit = allNodesById.get(id);
    if (!hit) return;
    setEditId(id);
    setEditName(hit.node.name ?? '');
    setEditParentId(hit.node.parentId ?? '');
    setEditOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openDeactivate(id: string) {
    if (coaStructureFrozen) return;
    const hit = allNodesById.get(id);
    if (!hit) return;
    setDeactivateId(id);
    setDeactivateHasActiveChildren(computeHasActiveChildren(hit.node));
    setDeactivateOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function onCreate() {
    if (coaStructureFrozen) return;
    const name = createName.trim();
    if (!name) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createIfrsNode({
        name,
        statement: createStatement,
        parentId: createParentId.trim() ? createParentId.trim() : null,
      });
      setCreateOpen(false);
      setSuccess('IFRS node created');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to create IFRS node'));
    } finally {
      setSaving(false);
    }
  }

  async function onEditSave() {
    if (coaStructureFrozen) return;
    const name = editName.trim();
    if (!name) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateIfrsNode(editId, {
        name,
        parentId: editParentId.trim() ? editParentId.trim() : null,
      });
      setEditOpen(false);
      setSuccess('IFRS node updated');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to update IFRS node'));
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (coaStructureFrozen) return;
    if (deactivateHasActiveChildren) {
      setError('Cannot deactivate a node that has active children');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deactivateIfrsNode(deactivateId);
      setDeactivateOpen(false);
      setSuccess('IFRS node deactivated');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to deactivate IFRS node'));
    } finally {
      setSaving(false);
    }
  }

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  const StatementPanel = (props: { statement: IfrsStatement }) => {
    const statement = props.statement;
    const roots = tree[statement] ?? [];

    const renderNode = (node: IfrsNodeTree, depth: number) => {
      const hasActiveChildren = computeHasActiveChildren(node);
      const pad = depth * 18;
      const inactive = !node.isActive;
      return (
        <div key={node.id}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(11,12,30,0.06)',
              background: inactive ? 'rgba(148,163,184,0.10)' : '#fff',
              marginTop: 8,
              marginLeft: pad,
              opacity: inactive ? 0.7 : 1,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: tokens.colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </div>
                {!node.isActive ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(100,116,139,1)' }}>INACTIVE</span>
                ) : null}
              </div>
              <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>
                {node.code ? `Code: ${node.code}` : 'Code: —'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openCreate(statement, node.id)}
                disabled={!node.isActive || coaStructureFrozen || saving || loading}
              >
                Add child
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(node.id)} disabled={coaStructureFrozen || saving || loading}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openDeactivate(node.id)}
                disabled={!node.isActive || hasActiveChildren || coaStructureFrozen || saving || loading}
              >
                Deactivate
              </Button>
            </div>
          </div>

          {node.children?.map((c: IfrsNodeTree) => renderNode(c, depth + 1))}
        </div>
      );
    };

    return (
      <Card
        title={statementLabel(statement)}
        subtitle="Tenant-configurable IFRS reporting hierarchy"
        baseShadow={cardBaseShadow}
        hoverShadow={cardHoverShadow}
        interactive
        actions={
          <Button size="sm" onClick={() => openCreate(statement, null)} disabled={coaStructureFrozen || saving || loading}>
            New root node
          </Button>
        }
      >
        {roots.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
            No nodes yet.
          </div>
        ) : (
          <div>
            {roots.map((n) => renderNode(n, 0))}
          </div>
        )}
      </Card>
    );
  };

  const createParentOptions = flatParentsByStatement[createStatement] ?? [];
  const editStatement = allNodesById.get(editId)?.statement ?? 'BS';
  const editParentOptions = flatParentsByStatement[editStatement] ?? [];

  const canChangeStatementInEdit = useMemo(() => {
    const hit = allNodesById.get(editId);
    if (!hit) return false;
    const hasChildren = (hit.node.children ?? []).length > 0;
    return !hasChildren;
  }, [allNodesById, editId]);

  return (
    <div>
      <SettingsPageHeader
        title="IFRS Reporting Structure"
        subtitle="Configure the tenant’s IFRS reporting hierarchy used for Chart of Accounts mapping and reporting."
        rightSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge state={coaStructureFrozen ? 'BLOCKED' : 'ACTIVE'} label={coaStructureFrozen ? 'STRUCTURE FROZEN' : 'STRUCTURE UNFROZEN'} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.currentTarget.checked)}
              />
              Show inactive
            </label>
          </div>
        }
      />

      {coaStructureFrozen ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning" title="COA structure is frozen">
            COA structure is frozen. Submit a controlled change request to modify structure.
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Action failed">{error}</Alert>
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success" title="Success">{success}</Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        <StatementPanel statement="BS" />
        <StatementPanel statement="PL" />
        <StatementPanel statement="CF" />
      </div>

      {createOpen ? (
        <ModalShell
          title="Create IFRS node"
          subtitle="Create a new IFRS reporting node (root or child)."
          onClose={() => (saving ? undefined : setCreateOpen(false))}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => onCreate().catch(() => undefined)} disabled={saving || coaStructureFrozen}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Statement</div>
              <select
                value={createStatement}
                onChange={(e) => {
                  setCreateStatement(e.target.value as IfrsStatement);
                  setCreateParentId('');
                }}
                disabled={saving}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: '#fff',
                  padding: '0 12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="BS">Balance Sheet (BS)</option>
                <option value="PL">Profit & Loss (PL)</option>
                <option value="CF">Cash Flow (CF)</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Parent (optional)</div>
              <select
                value={createParentId}
                onChange={(e) => setCreateParentId(e.target.value)}
                disabled={saving}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: '#fff',
                  padding: '0 12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">(none — root)</option>
                {createParentOptions
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${'—'.repeat(Math.min(p.depth, 6))}${p.depth > 0 ? ' ' : ''}${p.label}`}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Name</div>
              <div style={{ marginTop: 6 }}>
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} disabled={saving} />
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {editOpen ? (
        <ModalShell
          title="Edit IFRS node"
          subtitle={canChangeStatementInEdit ? 'Update node details.' : 'Statement cannot be changed when a node has children.'}
          onClose={() => (saving ? undefined : setEditOpen(false))}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => onEditSave().catch(() => undefined)} disabled={saving || coaStructureFrozen}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Statement</div>
              <select
                value={editStatement}
                disabled
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: 'rgba(148,163,184,0.10)',
                  padding: '0 12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="BS">Balance Sheet (BS)</option>
                <option value="PL">Profit & Loss (PL)</option>
                <option value="CF">Cash Flow (CF)</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Parent (optional)</div>
              <select
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
                disabled={saving}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: '#fff',
                  padding: '0 12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">(none — root)</option>
                {editParentOptions
                  .filter((p) => p.isActive)
                  .filter((p) => p.id !== editId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${'—'.repeat(Math.min(p.depth, 6))}${p.depth > 0 ? ' ' : ''}${p.label}`}
                    </option>
                  ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                Note: You cannot move a node under a parent in a different statement.
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Name</div>
              <div style={{ marginTop: 6 }}>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={saving} />
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {deactivateOpen ? (
        <ModalShell
          title="Deactivate IFRS node"
          subtitle={deactivateHasActiveChildren ? 'This node has active children and cannot be deactivated.' : 'This will hide the node from mapping and future use.'}
          onClose={() => (saving ? undefined : setDeactivateOpen(false))}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setDeactivateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => onDeactivate().catch(() => undefined)} disabled={saving || deactivateHasActiveChildren || coaStructureFrozen}>
                {saving ? 'Deactivating…' : 'Deactivate'}
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
            Deactivation is reversible only by re-creating or backend intervention (no re-activate UI).
          </div>
        </ModalShell>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 16, fontSize: 13, color: tokens.colors.text.secondary }}>Loading…</div>
      ) : null}
    </div>
  );
}
