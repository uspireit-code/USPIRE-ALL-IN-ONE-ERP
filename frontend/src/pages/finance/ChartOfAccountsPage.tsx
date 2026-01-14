import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { tokens } from '../../designTokens';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import type { BudgetControlMode, CoaAccount, CoaAccountType, CoaTreeNode, NormalBalance } from '../../services/coa';
import {
  cleanupNonCanonical,
  createCoaAccount,
  downloadCoaImportTemplate,
  freezeCoa,
  getCoaTree,
  importCoa,
  listCoa,
  lockCoa,
  unfreezeCoa,
  unlockCoa,
  updateCoaAccount,
} from '../../services/coa';
import { getApiErrorMessage } from '../../services/api';

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
        zIndex: 50,
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

function AccountTypePill(props: { type: CoaAccountType }) {
  const map: Record<CoaAccountType, { bg: string; border: string; text: string }> = {
    ASSET: { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.18)', text: 'rgba(37,99,235,0.95)' },
    LIABILITY: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.18)', text: 'rgba(220,38,38,0.95)' },
    EQUITY: { bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.18)', text: 'rgba(126,34,206,0.95)' },
    INCOME: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', text: 'rgba(5,150,105,0.95)' },
    EXPENSE: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.20)', text: 'rgba(217,119,6,0.95)' },
  };

  const t = map[props.type];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        border: `1px solid ${t.border}`,
        fontSize: 11,
        fontWeight: 800,
        color: t.text,
      }}
    >
      {props.type}
    </span>
  );
}

function FlattenedOption(props: { a: CoaAccount; depth: number }) {
  return (
    <option value={props.a.id}>
      {`${'—'.repeat(Math.min(props.depth, 6))}${props.depth > 0 ? ' ' : ''}${props.a.code} ${props.a.name}`}
    </option>
  );
}

function flattenTree(tree: CoaTreeNode[]) {
  const out: Array<{ node: CoaTreeNode; depth: number }> = [];
  const walk = (n: CoaTreeNode, depth: number) => {
    out.push({ node: n, depth });
    for (const c of n.children) walk(c, depth + 1);
  };
  for (const r of tree) walk(r, 0);
  return out;
}

export function ChartOfAccountsPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.COA.VIEW);
  const canUpdate = hasPermission(PERMISSIONS.COA.UPDATE);
  const canUnlockCOA = hasPermission(PERMISSIONS.COA.UNLOCK);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [coaFrozen, setCoaFrozen] = useState(false);
  const [coaLockedAt, setCoaLockedAt] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [tree, setTree] = useState<CoaTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState<'view' | 'create' | 'edit'>('view');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<CoaAccountType>('ASSET');
  const [isPostingAllowed, setIsPostingAllowed] = useState(true);
  const [isControlAccount, setIsControlAccount] = useState(false);
  const [normalBalance, setNormalBalance] = useState<NormalBalance>('DEBIT');
  const [isActive, setIsActive] = useState(true);
  const [parentAccountId, setParentAccountId] = useState<string | null>(null);
  const [ifrsMappingCode, setIfrsMappingCode] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [fsMappingLevel1, setFsMappingLevel1] = useState('');
  const [fsMappingLevel2, setFsMappingLevel2] = useState('');
  const [isBudgetRelevant, setIsBudgetRelevant] = useState(false);
  const [budgetControlMode, setBudgetControlMode] = useState<BudgetControlMode>('WARN');

  const [confirmFreeze, setConfirmFreeze] = useState<null | 'freeze' | 'unfreeze'>(null);
  const [confirmLock, setConfirmLock] = useState<null | 'lock' | 'unlock'>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [search, setSearch] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Array<{ row: number; column: string; message: string }>>([]);
  const [uploadSuccess, setUploadSuccess] = useState<null | { fileName: string; canonicalHash: string; rowCount: number; created: number; updated: number; warnings: string[] }>(null);

  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupDryRun, setCleanupDryRun] = useState<null | {
    canonicalHash: string | null;
    wouldDeleteCount: number;
    wouldDelete: Array<{ accountCode: string; name: string; reason: string }>;
    blocked: Array<{ accountCode: string; name: string; referencedBy: string[] }>;
  }>(null);
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetUploadState = () => {
    setUploadError(null);
    setUploadErrors([]);
    setUploadSuccess(null);
  };

  const onDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    setUploadError(null);
    try {
      const out = await downloadCoaImportTemplate(format);
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setUploadError(getApiErrorMessage(e, 'Failed to download template'));
    }
  };

  const onUploadCanonical = async () => {
    if (!uploadFile) return;
    setUploadBusy(true);
    resetUploadState();
    try {
      const res = await importCoa(uploadFile);
      setUploadSuccess(res);
      await refresh();
    } catch (e: any) {
      const body = (e as any)?.body as any;
      if (body && Array.isArray(body.errors)) {
        setUploadErrors(body.errors);
        setUploadError(body.message || 'Validation failed');
      } else {
        setUploadError(getApiErrorMessage(e, 'Upload failed'));
      }
    } finally {
      setUploadBusy(false);
    }
  };

  const onRunCleanupDry = async () => {
    setCleanupBusy(true);
    setCleanupError(null);
    setCleanupDryRun(null);
    setCleanupConfirmed(false);
    try {
      const res = await cleanupNonCanonical({ dryRun: true });
      if ((res as any).dryRun) {
        setCleanupDryRun({
          canonicalHash: (res as any).canonicalHash ?? null,
          wouldDeleteCount: (res as any).wouldDeleteCount ?? 0,
          wouldDelete: (res as any).wouldDelete ?? [],
          blocked: (res as any).blocked ?? [],
        });
      }
    } catch (e: any) {
      setCleanupError(getApiErrorMessage(e, 'Cleanup dry run failed'));
    } finally {
      setCleanupBusy(false);
    }
  };

  const onExecuteCleanup = async () => {
    if (!cleanupDryRun) return;
    if (!cleanupConfirmed) return;
    setCleanupBusy(true);
    setCleanupError(null);
    try {
      await cleanupNonCanonical({ dryRun: false, canonicalHash: cleanupDryRun.canonicalHash ?? undefined });
      await refresh();
      setShowCleanup(false);
    } catch (e: any) {
      setCleanupError(getApiErrorMessage(e, 'Cleanup execution failed'));
    } finally {
      setCleanupBusy(false);
    }
  };

  const selected = useMemo(() => accounts.find((a) => a.id === selectedId) ?? null, [accounts, selectedId]);

  const flattened = useMemo(() => flattenTree(tree), [tree]);

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tree;

    const filterNode = (n: CoaTreeNode): CoaTreeNode | null => {
      const selfHit = `${n.code} ${n.name}`.toLowerCase().includes(q);
      const children = n.children
        .map((c) => filterNode(c))
        .filter((x): x is CoaTreeNode => Boolean(x));
      if (selfHit || children.length > 0) return { ...n, children };
      return null;
    };

    return tree
      .map((n) => filterNode(n))
      .filter((x): x is CoaTreeNode => Boolean(x));
  }, [tree, search]);

  const coaLocked = Boolean(coaLockedAt);
  const actionsDisabled = saving || loading || coaFrozen;
  const createDisabled = saving || loading || coaFrozen || coaLocked;

  const refresh = async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [list, t] = await Promise.all([listCoa(), getCoaTree()]);
      setCoaFrozen(Boolean(list.coaFrozen));
      setCoaLockedAt(list.coaLockedAt);
      setAccounts(list.accounts);
      setTree(t.tree);

      setExpanded((prev) => {
        const next = { ...prev };
        for (const root of t.tree) {
          if (next[root.id] === undefined) next[root.id] = true;
        }
        return next;
      });

      if (!selectedId && list.accounts.length > 0) {
        setSelectedId(list.accounts[0].id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load Chart of Accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!selected) return;

    setEditMode('view');
    setCode(selected.code);
    setName(selected.name);
    setAccountType(selected.type);
    setIsPostingAllowed(Boolean(selected.isPostingAllowed ?? selected.isPosting));
    setIsControlAccount(Boolean(selected.isControlAccount));
    setNormalBalance((selected.normalBalance as NormalBalance) ?? 'DEBIT');
    setIsActive(Boolean(selected.isActive));
    setParentAccountId(selected.parentAccountId);
    setIfrsMappingCode(selected.ifrsMappingCode ?? '');
    setIsBudgetRelevant(Boolean(selected.isBudgetRelevant));
    setBudgetControlMode((selected.budgetControlMode as BudgetControlMode) ?? 'WARN');
  }, [selected?.id]);

  const parentOptions = useMemo(() => {
    const depthById = new Map<string, number>();
    for (const it of flattened) depthById.set(it.node.id, it.depth);

    return accounts
      .map((a) => ({ a, depth: depthById.get(a.id) ?? 0 }))
      .filter((x) => x.a.id !== selectedId)
      .sort((x, y) => x.a.code.localeCompare(y.a.code));
  }, [accounts, flattened, selectedId]);

  const onStartCreate = () => {
    setError(null);
    setSuccess(null);
    setEditMode('create');
    setSelectedId(null);
    setCode('');
    setName('');
    setAccountType('ASSET');
    setIsPostingAllowed(true);
    setIsControlAccount(false);
    setNormalBalance('DEBIT');
    setIsActive(true);
    setParentAccountId(null);
    setSubCategory('');
    setFsMappingLevel1('');
    setFsMappingLevel2('');
    setIsBudgetRelevant(false);
    setBudgetControlMode('WARN');
  };

  const onStartEdit = () => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setEditMode('edit');
  };

  const onCancelEdit = () => {
    if (selected) {
      setEditMode('view');
      setCode(selected.code);
      setName(selected.name);
      setAccountType(selected.type);
      setIsPostingAllowed(Boolean(selected.isPostingAllowed));
      setIsControlAccount(Boolean(selected.isControlAccount));
      setNormalBalance((selected.normalBalance as NormalBalance) ?? 'DEBIT');
      setIsActive(Boolean(selected.isActive));
      setParentAccountId(selected.parentAccountId);
      setIfrsMappingCode(selected.ifrsMappingCode ?? '');
      setSubCategory(selected.subCategory ?? '');
      setFsMappingLevel1(selected.fsMappingLevel1 ?? '');
      setFsMappingLevel2(selected.fsMappingLevel2 ?? '');
      setIsBudgetRelevant(Boolean(selected.isBudgetRelevant));
      setBudgetControlMode((selected.budgetControlMode as BudgetControlMode) ?? 'WARN');
    } else {
      setEditMode('view');
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editMode === 'create') {
        const created = await createCoaAccount({
          code: code.trim(),
          name: name.trim(),
          accountType,
          subCategory: subCategory.trim() || undefined,
          fsMappingLevel1: fsMappingLevel1.trim() || undefined,
          fsMappingLevel2: fsMappingLevel2.trim() || undefined,
          parentAccountId,
          isPostingAllowed,
          isControlAccount,
          normalBalance,
          isActive,
          isBudgetRelevant,
          budgetControlMode,
        });
        setSuccess('Account created');
        await refresh();
        setSelectedId(created.id);
      }

      if (editMode === 'edit' && selected) {
        await updateCoaAccount({
          id: selected.id,
          code: code.trim() || undefined,
          name: name.trim() || undefined,
          accountType,
          subCategory: subCategory.trim() || undefined,
          fsMappingLevel1: fsMappingLevel1.trim() || undefined,
          fsMappingLevel2: fsMappingLevel2.trim() || undefined,
          parentAccountId,
          isPostingAllowed,
          isControlAccount,
          normalBalance,
          isActive,
          ifrsMappingCode: ifrsMappingCode.trim() || null,
          isBudgetRelevant,
          budgetControlMode,
        });
        setSuccess('Account updated');
        await refresh();
        setSelectedId(selected.id);
      }

      setEditMode('view');
    } catch (e: any) {
      setError(e?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (n: CoaTreeNode, depth: number) => {
    const isOpen = expanded[n.id] ?? false;
    const hasChildren = n.children.length > 0;
    const isSelected = selectedId === n.id;
    const isHovered = hoveredId === n.id;

    const isDisabled = !n.isActive;
    const isNonPosting = !n.isPostingAllowed;
    const isParent = n.children.length > 0;

    const rowBg = isSelected ? '#eef2f6' : isHovered ? '#f8fafc' : 'transparent';
    const rowBorder = isSelected ? 'rgba(15,23,42,0.10)' : 'transparent';
    const indentPx = depth * 16;

    return (
      <div key={n.id}>
        <div
          onClick={() => setSelectedId(n.id)}
          onMouseEnter={() => setHoveredId(n.id)}
          onMouseLeave={() => setHoveredId((prev) => (prev === n.id ? null : prev))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 44,
            padding: '10px 10px',
            paddingLeft: 12 + indentPx,
            borderRadius: 10,
            cursor: 'pointer',
            background: rowBg,
            border: `1px solid ${rowBorder}`,
            transition: 'background-color 120ms ease, border-color 120ms ease',
            color: isDisabled ? 'rgba(15,23,42,0.45)' : tokens.colors.text.primary,
          }}
        >
          <button
            type="button"
            aria-label={hasChildren ? (isOpen ? 'Collapse' : 'Expand') : 'No children'}
            disabled={!hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpanded(n.id);
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              border: '1px solid rgba(15,23,42,0.10)',
              background: hasChildren ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.35)',
              cursor: hasChildren ? 'pointer' : 'default',
              color: 'rgba(15,23,42,0.55)',
              fontWeight: 700,
              lineHeight: '16px',
              padding: 0,
              flex: '0 0 auto',
            }}
          >
            {hasChildren ? (isOpen ? '−' : '+') : '·'}
          </button>

          <div
            style={{
              minWidth: 60,
              fontWeight: 500,
              letterSpacing: 0.2,
              color: isDisabled ? 'rgba(15,23,42,0.35)' : 'rgba(100,116,139,1)',
              fontSize: 12,
            }}
          >
            {n.code}
          </div>

          <div style={{ flex: 1, fontWeight: isParent || isNonPosting ? 500 : 400 }}>
            {n.name}
          </div>
          {n.isControlAccount ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(71,85,105,1)',
                border: '1px solid rgba(148,163,184,0.70)',
                padding: '1px 7px',
                borderRadius: 999,
                background: 'rgba(241,245,249,1)',
              }}
            >
              CONTROL
            </span>
          ) : null}
          {isNonPosting ? (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(100,116,139,1)' }}>Group</span>
          ) : null}
        </div>

        {hasChildren && isOpen ? <div style={{ marginTop: 2 }}>{n.children.map((c) => renderNode(c, depth + 1))}</div> : null}
      </div>
    );
  };

  const onConfirmFreeze = async () => {
    if (!confirmFreeze) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (confirmFreeze === 'freeze') {
        await freezeCoa();
        setSuccess('COA frozen');
      } else {
        await unfreezeCoa();
        setSuccess('COA unfrozen');
      }
      setConfirmFreeze(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to update COA freeze state');
    } finally {
      setSaving(false);
    }
  };

  const onConfirmLock = async () => {
    if (!confirmLock) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (confirmLock === 'lock') {
        await lockCoa();
        setSuccess('COA locked');
      } else {
        const reason = unlockReason.trim();
        if (!reason) {
          setError('Reason is required to unlock the Chart of Accounts');
          return;
        }
        await unlockCoa({ reason });
        setSuccess('COA unlocked');
      }
      setConfirmLock(null);
      setUnlockReason('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to update COA lock state');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return <Alert tone="error" title="Access denied">You do not have permission to view the Chart of Accounts.</Alert>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {coaFrozen ? (
        <Alert tone="warning" title="Chart of Accounts is frozen">Chart of Accounts is frozen. Changes are not allowed.</Alert>
      ) : null}

      {coaLocked ? (
        <Alert tone="warning" title="Chart of Accounts is locked">
          COA is locked. Creating accounts, editing codes, and changing hierarchy are disabled until it is unlocked.
        </Alert>
      ) : null}

      {error ? <Alert tone="error" title="Error">{error}</Alert> : null}
      {success ? <Alert tone="success" title="Success">{success}</Alert> : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850, color: tokens.colors.text.primary }}>Chart of Accounts</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary, maxWidth: 900 }}>
            Manage tenant-scoped accounts with hierarchy and control-first maintenance. Non-posting accounts cannot be used in journals.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canUpdate ? (
            <>
              <Button variant="secondary" onClick={() => setShowBulkUpload(true)} disabled={saving || loading}>
                Bulk Upload
              </Button>
              <Button variant="secondary" onClick={() => setShowCleanup(true)} disabled={saving || loading}>
                Cleanup Non-Canonical
              </Button>
              <Button onClick={onStartCreate} disabled={createDisabled}>
                New Account
              </Button>
              <Button variant="ghost" onClick={() => setShowAdvanced(true)} disabled={saving || loading}>
                Advanced
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>Accounts</div>
              <div style={{ width: 180 }}>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              padding: 14,
              maxHeight: 'calc(100vh - 280px)',
              overflowY: 'auto',
              scrollBehavior: 'smooth',
            }}
          >
            {loading ? <div style={{ padding: 10, color: tokens.colors.text.secondary }}>Loading…</div> : null}
            {!loading ? filteredTree.map((n) => renderNode(n, 0)) : null}
          </div>
        </div>

        <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
          <div
            style={{
              padding: 14,
              borderBottom: `1px solid ${tokens.colors.border.subtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 850 }}>Account Details</div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {selected && editMode === 'view' ? <AccountTypePill type={selected.type} /> : null}

              {selected && editMode === 'view' && canUpdate ? (
                <Button variant="secondary" onClick={onStartEdit} disabled={actionsDisabled}>
                  Edit
                </Button>
              ) : null}
            </div>
          </div>

          <div style={{ padding: 14 }}>
            {editMode === 'view' && !selected ? (
              <div style={{ color: tokens.colors.text.secondary }}>Select an account from the tree to view details.</div>
            ) : null}

            {editMode !== 'view' ? (
              <Alert tone="info" title={editMode === 'create' ? 'Create account' : 'Edit account'}>
                {coaFrozen ? 'COA is frozen. Changes are not allowed.' : 'Save changes when ready.'}
              </Alert>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Code</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={
                      editMode === 'view' ||
                      actionsDisabled ||
                      (coaLocked && editMode === 'edit')
                    }
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Name</div>
                <div style={{ marginTop: 6 }}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} disabled={editMode === 'view' || actionsDisabled} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Account type</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as CoaAccountType)}
                    disabled={editMode === 'view' || actionsDisabled}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      padding: '0 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Parent account</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={parentAccountId ?? ''}
                    onChange={(e) => setParentAccountId(e.target.value ? e.target.value : null)}
                    disabled={editMode === 'view' || actionsDisabled || coaLocked}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      padding: '0 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="">(No parent)</option>
                    {parentOptions.map((x) => (
                      <FlattenedOption key={x.a.id} a={x.a} depth={x.depth} />
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Posting</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isPostingAllowed}
                    onChange={(e) => setIsPostingAllowed(e.target.checked)}
                    disabled={editMode === 'view' || actionsDisabled}
                  />
                  <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                    {isPostingAllowed ? 'Posting account' : 'Non-posting (group)'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Control account</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isControlAccount}
                    onChange={(e) => setIsControlAccount(e.target.checked)}
                    disabled={editMode === 'view' || actionsDisabled}
                  />
                  <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                    {isControlAccount ? 'CONTROL' : 'Not a control account'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Normal balance</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={normalBalance}
                    onChange={(e) => setNormalBalance(e.target.value as NormalBalance)}
                    disabled={editMode === 'view' || actionsDisabled}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      padding: '0 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="DEBIT">DEBIT</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Active</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={editMode === 'view' || actionsDisabled}
                  />
                  <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                    {isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>IFRS mapping</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    value={ifrsMappingCode}
                    onChange={(e) => setIfrsMappingCode(e.target.value)}
                    disabled={
                      editMode === 'view' ||
                      actionsDisabled ||
                      coaLocked ||
                      !canUpdate
                    }
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                  IFRS mapping can only be edited while COA is unlocked.
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Budget relevant</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isBudgetRelevant}
                    onChange={(e) => setIsBudgetRelevant(e.target.checked)}
                    disabled={editMode === 'view' || actionsDisabled || !canUpdate}
                  />
                  <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                    Budget Relevant
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Budget control mode</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={budgetControlMode}
                    onChange={(e) => setBudgetControlMode(e.target.value as BudgetControlMode)}
                    disabled={editMode === 'view' || actionsDisabled || !canUpdate}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      padding: '0 12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="WARN">WARN</option>
                    <option value="BLOCK">BLOCK</option>
                  </select>
                </div>
              </div>
            </div>

            {editMode !== 'view' ? (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" onClick={onCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={onSave} disabled={actionsDisabled || !canUpdate}>
                  Save
                </Button>
              </div>
            ) : null}

            {editMode === 'view' && selected ? (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Metadata</div>
                <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>
                  Created: {new Date(selected.createdAt).toLocaleString()} | Updated: {new Date(selected.updatedAt).toLocaleString()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {confirmFreeze ? (
        <ModalShell
          title={confirmFreeze === 'freeze' ? 'Freeze Chart of Accounts?' : 'Unfreeze Chart of Accounts?'}
          subtitle={
            confirmFreeze === 'freeze'
              ? 'This will block create/update actions for all users until unfrozen.'
              : 'This will re-enable create/update actions for users with permissions.'
          }
          onClose={() => setConfirmFreeze(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setConfirmFreeze(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant={confirmFreeze === 'freeze' ? 'destructive' : 'secondary'} onClick={onConfirmFreeze} disabled={saving}>
                Confirm
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            {confirmFreeze === 'freeze'
              ? 'Once frozen, the Chart of Accounts becomes read-only. Journal posting is not affected, but you cannot create or edit accounts.'
              : 'Unfreezing allows account maintenance again. Ensure controls and approvals are followed.'}
          </div>
        </ModalShell>
      ) : null}

      {confirmLock ? (
        <ModalShell
          title={confirmLock === 'lock' ? 'Lock Chart of Accounts?' : 'Unlock Chart of Accounts?'}
          subtitle={
            confirmLock === 'lock'
              ? 'This blocks account creation, code changes, and hierarchy changes.'
              : 'This re-enables account creation, code changes, and hierarchy changes.'
          }
          onClose={() => {
            setConfirmLock(null);
            setUnlockReason('');
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmLock(null);
                  setUnlockReason('');
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant={confirmLock === 'lock' ? 'destructive' : 'secondary'}
                onClick={onConfirmLock}
                disabled={saving || (confirmLock === 'unlock' && !unlockReason.trim())}
              >
                Confirm
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            {confirmLock === 'lock'
              ? 'Locking is a control step. It does not affect journal posting, but it prevents COA structural maintenance.'
              : 'Unlocking is a control step. Ensure approvals and controls are followed.'}
          </div>

          {confirmLock === 'unlock' ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Reason (required)</div>
              <div style={{ marginTop: 6 }}>
                <Input
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  disabled={saving}
                  placeholder="Enter reason for unlocking"
                />
              </div>
            </div>
          ) : null}
        </ModalShell>
      ) : null}

      {showAdvanced ? (
        <ModalShell
          title="Advanced COA Controls"
          subtitle="Freeze/lock are governance controls. Use with care."
          onClose={() => setShowAdvanced(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setShowAdvanced(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant={coaFrozen ? 'secondary' : 'destructive'}
              onClick={() => {
                setShowAdvanced(false);
                setConfirmFreeze(coaFrozen ? 'unfreeze' : 'freeze');
              }}
              disabled={!canUpdate || saving || loading}
            >
              {coaFrozen ? 'Unfreeze COA' : 'Freeze COA'}
            </Button>

            {!coaLocked && canUpdate ? (
              <Button
                variant="accent"
                onClick={() => {
                  setShowAdvanced(false);
                  setConfirmLock('lock');
                  setUnlockReason('');
                }}
                disabled={saving || loading}
              >
                Lock COA
              </Button>
            ) : null}

            {coaLocked && canUnlockCOA ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAdvanced(false);
                  setConfirmLock('unlock');
                  setUnlockReason('');
                }}
                disabled={saving || loading}
              >
                Unlock COA
              </Button>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {showBulkUpload ? (
        <ModalShell
          title="Bulk Upload (Canonical COA)"
          subtitle="Upload CSV or XLSX (single sheet named COA). Entire upload is rejected if any row is invalid."
          onClose={() => setShowBulkUpload(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="secondary" disabled={uploadBusy} onClick={() => onDownloadTemplate('csv')}>
                  Download CSV Template
                </Button>
                <Button variant="secondary" disabled={uploadBusy} onClick={() => onDownloadTemplate('xlsx')}>
                  Download XLSX Template
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" disabled={uploadBusy} onClick={() => setShowBulkUpload(false)}>
                  Cancel
                </Button>
                <Button disabled={!canUpdate || uploadBusy || !uploadFile} onClick={onUploadCanonical}>
                  {uploadBusy ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
            </div>
          }
          width={720}
        >
          {!canUpdate ? <Alert tone="error" title="Access denied">You do not have permission to upload COA.</Alert> : null}

          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={uploadBusy || !canUpdate}
            onChange={(e) => {
              resetUploadState();
              const f = e.target.files?.[0] ?? null;
              setUploadFile(f);
            }}
          />

          {uploadError ? <div style={{ marginTop: 10 }}><Alert tone={uploadErrors.length > 0 ? 'warning' : 'error'} title={uploadErrors.length > 0 ? 'Validation failed' : 'Error'}>{uploadError}</Alert></div> : null}

          {uploadSuccess ? (
            <div style={{ marginTop: 10 }}>
              <Alert tone="success" title="Upload successful">
                <div>File: {uploadSuccess.fileName}</div>
                <div>Rows: {uploadSuccess.rowCount}</div>
                <div>Created: {uploadSuccess.created} · Updated: {uploadSuccess.updated}</div>
                <div>Canonical hash: {uploadSuccess.canonicalHash}</div>
              </Alert>
            </div>
          ) : null}

          {uploadErrors.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Errors</div>
              <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12 }}>
                {uploadErrors.slice(0, 200).map((e, idx) => (
                  <div key={idx} style={{ padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>
                    <span style={{ fontWeight: 800 }}>Row {e.row ?? '?'}:</span> <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{e.column ?? ''}</span> — {e.message}
                  </div>
                ))}
              </div>
              {uploadErrors.length > 200 ? <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>Showing first 200 errors.</div> : null}
            </div>
          ) : null}
        </ModalShell>
      ) : null}

      {showCleanup ? (
        <ModalShell
          title="Cleanup Non-Canonical Accounts"
          subtitle="Dry run first. Only non-canonical AND unreferenced accounts are deletable."
          onClose={() => setShowCleanup(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="secondary" disabled={cleanupBusy || !canUpdate} onClick={onRunCleanupDry}>
                {cleanupBusy ? 'Running…' : 'Run Dry Run'}
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" disabled={cleanupBusy} onClick={() => setShowCleanup(false)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canUpdate || cleanupBusy || !cleanupDryRun || !cleanupConfirmed || (cleanupDryRun?.wouldDeleteCount ?? 0) === 0}
                  onClick={onExecuteCleanup}
                >
                  Execute Cleanup
                </Button>
              </div>
            </div>
          }
          width={820}
        >
          {!canUpdate ? <Alert tone="error" title="Access denied">You do not have permission to cleanup COA.</Alert> : null}
          {cleanupError ? <Alert tone="error" title="Error">{cleanupError}</Alert> : null}

          {cleanupDryRun ? (
            <div style={{ marginTop: 10 }}>
              <Alert tone="info" title="Dry run results">
                <div>Canonical hash: {cleanupDryRun.canonicalHash ?? '(none)'}</div>
                <div>Would delete: {cleanupDryRun.wouldDeleteCount}</div>
                <div>Blocked: {cleanupDryRun.blocked.length}</div>
              </Alert>

              <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={cleanupConfirmed}
                  onChange={(e) => setCleanupConfirmed(e.target.checked)}
                  disabled={!canUpdate || cleanupBusy}
                />
                <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                  I understand this will permanently delete the accounts listed under “Would delete”.
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: 10, fontWeight: 850, borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
                    Would delete ({cleanupDryRun.wouldDelete.length})
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {cleanupDryRun.wouldDelete.slice(0, 200).map((a) => (
                      <div key={a.accountCode} style={{ padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>
                        <div style={{ fontWeight: 800 }}>{a.accountCode} — {a.name}</div>
                        <div style={{ color: tokens.colors.text.muted }}>{a.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: 10, fontWeight: 850, borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
                    Blocked ({cleanupDryRun.blocked.length})
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {cleanupDryRun.blocked.slice(0, 200).map((a) => (
                      <div key={a.accountCode} style={{ padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>
                        <div style={{ fontWeight: 800 }}>{a.accountCode} — {a.name}</div>
                        <div style={{ color: tokens.colors.text.muted }}>{a.referencedBy.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: tokens.colors.text.secondary, fontSize: 13 }}>
              Run a dry run to see what would be deleted and what is blocked.
            </div>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}
