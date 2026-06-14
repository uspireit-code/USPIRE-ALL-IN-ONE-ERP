import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { CoaStatusBadge } from '../../components/CoaStatusBadge';
import { Input } from '../../components/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import type {
  BudgetControlMode,
  CoaAccount,
  CoaAccountType,
  CoaImportCommitResponse,
  CoaImportBatch,
  CoaImportBatchAccount,
  CoaImportValidationResponse,
  CoaImportValidationRow,
  CoaParentOption,
  IfrsNodeReferenceOption,
  NormalBalance,
} from '../../services/coa';
import {
  cancelCoaImportBatch,
  createCoaAccount,
  downloadCoaImportTemplate,
  downloadCoaIndustryImportTemplate,
  commitCoaImport,
  bulkSubmitCoaAccounts,
  getDraftCoaImportBatch,
  getCoaParentOptions,
  getMyCoaSubmissionsTree,
  listIfrsNodeReference,
  listCoaImportBatchAccounts,
  listCoaSubmissions,
  submitCoaImportBatch,
  submitCoaAccount,
  updateCoaAccount,
  validateCoaImport,
} from '../../services/coa';

import './CoaSubmissionsPage.css';

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
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{props.children}</div>
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

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 300);
}

function toErrorReportCsv(rows: CoaImportValidationRow[]) {
  const headers = ['Row', 'AccountCode', 'AccountName', 'ErrorMessage'];
  const esc = (v: any) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const errorRows = rows.filter((r) => r.status === 'ERROR');
  const lines = errorRows.map((r) =>
    [r.rowNumber, r.accountCode, r.accountName, r.message ?? ''].map(esc).join(','),
  );
  return [headers.join(','), ...lines].join('\n') + '\n';
}

export function CoaSubmissionsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.COA.VIEW);
  const canDraftCreate =
  hasPermission(PERMISSIONS.COA.DRAFT_CREATE) ||
  hasPermission(PERMISSIONS.COA.NEW_DRAFT_CREATE);

const canDraftEdit =
  hasPermission(PERMISSIONS.COA.DRAFT_EDIT) ||
  hasPermission(PERMISSIONS.COA.NEW_DRAFT_EDIT);

const canDraftSubmit =
  hasPermission(PERMISSIONS.COA.DRAFT_SUBMIT) ||
  hasPermission(PERMISSIONS.COA.NEW_DRAFT_SUBMIT);
  const canUnlock = hasPermission(PERMISSIONS.COA.UNLOCK);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [bulkSubmitBusy, setBulkSubmitBusy] = useState(false);
  const [bulkSubmitResult, setBulkSubmitResult] = useState<
    | null
    | {
        success: string[];
        failed: Array<{ id: string; message: string }>;
      }
  >(null);

  const [approvalMissingFields, setApprovalMissingFields] = useState<Array<{ field: string; message: string }>>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<
        | 'code'
        | 'name'
        | 'accountType'
        | 'normalBalance'
        | 'parentAccountId'
        | 'ifrsCode'
        | 'fsMappingLevel1'
        | 'fsMappingLevel2'
        | 'isBudgetRelevant'
        | 'budgetControlMode',
        string | string[]
      >
    >
  >({});

  const [items, setItems] = useState<CoaAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [parentOptions, setParentOptions] = useState<CoaParentOption[]>([]);

  const hasAutoSelectedBulkRef = useRef(false);
  const hasUserTouchedBulkSelectionRef = useRef(false);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Array<{ row: number; column: string; message: string }>>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [validationBusy, setValidationBusy] = useState(false);
  const [validation, setValidation] = useState<CoaImportValidationResponse | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const [commitResult, setCommitResult] = useState<CoaImportCommitResponse | null>(null);
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'VALID' | 'ERROR'>('ALL');

  const [batchFilter, setBatchFilter] = useState<'ALL' | 'READY' | 'INCOMPLETE' | 'ERROR'>('ALL');

  const [batchLoading, setBatchLoading] = useState(false);
  const [draftBatch, setDraftBatch] = useState<CoaImportBatch | null>(null);
  const [batchAccounts, setBatchAccounts] = useState<CoaImportBatchAccount[]>([]);
  const [batchActionBusy, setBatchActionBusy] = useState(false);

  const detailsPanelRef = useRef<HTMLDivElement | null>(null);

  const validationPanelRef = useRef<HTMLDivElement | null>(null);

  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const accountTypeRef = useRef<HTMLSelectElement | null>(null);
  const normalBalanceRef = useRef<HTMLSelectElement | null>(null);
  const parentAccountRef = useRef<HTMLSelectElement | null>(null);
  const ifrsNodeRef = useRef<HTMLSelectElement | null>(null);
  const fsMappingLevel1Ref = useRef<HTMLInputElement | null>(null);
  const fsMappingLevel2Ref = useRef<HTMLInputElement | null>(null);
  const budgetControlModeRef = useRef<HTMLSelectElement | null>(null);

  const [templateType, setTemplateType] = useState<'blank' | 'industry'>('blank');
  const [industry, setIndustry] = useState<'professional-services' | 'retail' | 'manufacturing' | 'nonprofit'>(
    'professional-services',
  );

  const [editMode, setEditMode] = useState<'view' | 'create' | 'edit'>('view');

  const [ifrsOptions, setIfrsOptions] = useState<IfrsNodeReferenceOption[]>([]);

  const [form, setForm] = useState<{
    code: string;
    name: string;
    accountType: CoaAccountType;
    normalBalance: NormalBalance;
    parentAccountId: string | null;
    isPostingAllowed: boolean;
    isControlAccount: boolean;
    ifrsCode: string;
    fsMappingLevel1: string;
    fsMappingLevel2: string;
    isBudgetRelevant: boolean;
    budgetControlMode: BudgetControlMode;
  }>({
    code: '',
    name: '',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    parentAccountId: null,
    isPostingAllowed: true,
    isControlAccount: false,
    ifrsCode: '',
    fsMappingLevel1: '',
    fsMappingLevel2: '',
    isBudgetRelevant: false,
    budgetControlMode: 'WARN',
  });

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const approvalState = String((selected as any)?.approvalState ?? selected?.status ?? 'DRAFT').toUpperCase();
  const isPending = approvalState === 'PENDING_APPROVAL';
  const isRejected = approvalState === 'REJECTED';
  const isDraftLike = approvalState === 'DRAFT' || isRejected;

  const failedIdSet = useMemo(
    () => new Set((bulkSubmitResult?.failed ?? []).map((f) => String(f.id))),
    [bulkSubmitResult],
  );

  const submittableItems = useMemo(
    () =>
      (items ?? []).filter((a) => {
        const st = String((a as any)?.approvalState ?? (a as any)?.status ?? '').toUpperCase();
        return st === 'DRAFT' || st === 'REJECTED';
      }),
    [items],
  );

  const groupFailures = (failed: Array<{ id: string; message: string }>) => {
    const map: Record<string, number> = {};
    for (const f of failed ?? []) {
      const msg = String(f?.message ?? '').trim() || 'Unknown error';
      map[msg] = (map[msg] ?? 0) + 1;
    }
    return map;
  };

  const lifecycleStatusUpper = String((selected as any)?.status ?? '').trim().toUpperCase();
  const isRetired = lifecycleStatusUpper === 'RETIRED';

  const submitPostingBlocked = Boolean(selected) && !canUnlock && (selected as any).isPosting === false;

  const clearFieldError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete (next as any)[key];
      return next;
    });
  };

  const formVisible = editMode === 'create' || Boolean(selected);

  const rejectedAt = (selected as any)?.latestRejectionAt ?? null;
  const rejectedReason = String((selected as any)?.latestRejectionReason ?? '').trim();

  const formatRejectionTimestamp = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d
      .toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      .replace(',', '');
  };

  const inputsDisabled = editMode === 'view' || saving || loading || isPending;

  const backendToUiFieldMap: Record<string, keyof typeof fieldErrors> = {
    code: 'code',
    accountCode: 'code',
    name: 'name',
    accountName: 'name',
    type: 'accountType',
    accountType: 'accountType',
    normalBalance: 'normalBalance',
    parentAccountId: 'parentAccountId',
    ifrsCode: 'ifrsCode',
    fsMappingLevel1: 'fsMappingLevel1',
    fsMappingLevel2: 'fsMappingLevel2',
    isBudgetRelevant: 'isBudgetRelevant',
    budgetControlMode: 'budgetControlMode',
  };

  const validateForm = (): { ok: true; trimmedCode: string; trimmedName: string } | { ok: false } => {
    const trimmedCode = String(form.code ?? '').trim();
    const trimmedName = String(form.name ?? '').trim();
    const type = String(form.accountType ?? '').trim();
    const parentId = String(form.parentAccountId ?? '').trim();
    const ifrs = String(form.ifrsCode ?? '').trim();
    const fs1 = String(form.fsMappingLevel1 ?? '').trim();

    const isPosting = canUnlock ? Boolean(form.isPostingAllowed) : true;

    const nextErrors: typeof fieldErrors = {};
    if (!trimmedCode) nextErrors.code = 'Account code is required.';
    if (!trimmedName) nextErrors.name = 'Account name is required.';
    if (!type) nextErrors.accountType = 'Account type is required.';
    if (!parentId) nextErrors.parentAccountId = 'Parent account is required.';
    if (isPosting && !ifrs) {
      nextErrors.ifrsCode = 'IFRS code is required for posting accounts';
    }
    if (!fs1) {
      nextErrors.fsMappingLevel1 = 'FS Mapping Level 1 is required';
    }

    setFieldErrors(nextErrors);
    return {
      ok: Object.keys(nextErrors).length === 0,
      trimmedCode,
      trimmedName,
    };
  };

  const focusFirstFieldError = (nextErrors: typeof fieldErrors) => {
    const focusOrder: Array<keyof typeof fieldErrors> = [
      'code',
      'name',
      'accountType',
      'normalBalance',
      'parentAccountId',
      'ifrsCode',
      'fsMappingLevel1',
      'fsMappingLevel2',
      'budgetControlMode',
    ];

    const firstKey = focusOrder.find((k) => Boolean((nextErrors as any)[k]));
    if (!firstKey) return;

    window.setTimeout(() => {
      const el =
        firstKey === 'code'
          ? codeInputRef.current
          : firstKey === 'name'
            ? nameInputRef.current
            : firstKey === 'accountType'
              ? accountTypeRef.current
              : firstKey === 'normalBalance'
                ? normalBalanceRef.current
                : firstKey === 'parentAccountId'
                  ? parentAccountRef.current
                  : firstKey === 'ifrsCode'
                    ? ifrsNodeRef.current
                    : firstKey === 'fsMappingLevel1'
                      ? fsMappingLevel1Ref.current
                      : firstKey === 'fsMappingLevel2'
                        ? fsMappingLevel2Ref.current
                        : firstKey === 'budgetControlMode'
                          ? budgetControlModeRef.current
                          : null;

      if (!el) return;
      try {
        (el as any).scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      } catch {
        // ignore
      }
      (el as any).focus?.();
    }, 0);
  };

  const applyBackendMessageToFieldErrors = (messageRaw: any) => {
    const msg = String(messageRaw ?? '').trim();
    if (!msg) return false;

    const upper = msg.toUpperCase();
    const nextErrors: typeof fieldErrors = {};

    if (upper.includes('ACCOUNT CODE IS REQUIRED')) {
      nextErrors.code = msg;
    }
    if (upper.includes('ACCOUNT NAME IS REQUIRED')) {
      nextErrors.name = msg;
    }
    if (upper.includes('PARENT ACCOUNT IS REQUIRED')) {
      nextErrors.parentAccountId = msg;
    }
    if (upper.includes('IFRS MAPPING IS REQUIRED') || upper.includes('IFRS CODE IS REQUIRED')) {
      nextErrors.ifrsCode = msg;
    }
    if (upper.includes('FS MAPPING LEVEL 1') || upper.includes('FSMAPPINGLEVEL1')) {
      nextErrors.fsMappingLevel1 = msg;
    }

    if (Object.keys(nextErrors).length === 0) return false;
    setFieldErrors(nextErrors);
    focusFirstFieldError(nextErrors);
    return true;
  };

  const applyBackendIssues = (body: any) => {
    const issues = Array.isArray(body?.issues) ? (body.issues as any[]) : [];
    if (issues.length === 0) return false;

    const nextErrors: typeof fieldErrors = {};
    for (const issue of issues) {
      const raw = String(issue?.field ?? '').trim();
      const key = backendToUiFieldMap[raw];
      if (!key) continue;
      const msg = String(issue?.message ?? '').trim() || 'Invalid value.';

      const prev = (nextErrors as any)[key];
      if (!prev) {
        (nextErrors as any)[key] = [msg];
      } else if (Array.isArray(prev)) {
        prev.push(msg);
      } else {
        (nextErrors as any)[key] = [String(prev), msg];
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      focusFirstFieldError(nextErrors);
      return true;
    }

    return false;
  };

  const loadSubmissions = async () => {
    const res = await listCoaSubmissions();
    const rows = (res.accounts ?? [])
      .slice()
      .sort((a: CoaAccount, b: CoaAccount) => a.code.localeCompare(b.code));
    setItems(rows);
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
    if (selectedId && !rows.some((r: CoaAccount) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
    return rows;
  };

  const refresh = async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      void getMyCoaSubmissionsTree().catch(() => undefined);
      const [_, parentRes] = await Promise.all([loadSubmissions(), getCoaParentOptions()]);
      setParentOptions(Array.isArray((parentRes as any)?.parents) ? ((parentRes as any).parents as any) : []);

      if (canDraftCreate) {
        setBatchLoading(true);
        try {
          const b = await getDraftCoaImportBatch();
          setDraftBatch((b as any)?.batch ?? null);
        } catch {
          setDraftBatch(null);
        } finally {
          setBatchLoading(false);
        }
      }
    } catch (e: any) {
      console.error(e);
      // Don't block the UI completely on refresh failure
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!draftBatch?.batchId) {
      setBatchAccounts([]);
      return;
    }

    (async () => {
      setBatchLoading(true);
      try {
        const res = await listCoaImportBatchAccounts(draftBatch.batchId);
        if (cancelled) return;
        setBatchAccounts(Array.isArray((res as any)?.accounts) ? ((res as any).accounts as any) : []);
      } catch {
        if (cancelled) return;
        setBatchAccounts([]);
      } finally {
        if (cancelled) return;
        setBatchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftBatch?.batchId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!selectedIds || selectedIds.length === 0) return;
    const allowed = new Set((items ?? []).map((x) => String(x.id)));
    setSelectedIds((prev) => [...new Set(prev.filter((id) => allowed.has(String(id))))]);
  }, [items]);

  useEffect(() => {
    if (!canDraftSubmit) return;
    if (hasAutoSelectedBulkRef.current) return;
    if (hasUserTouchedBulkSelectionRef.current) return;
    if ((selectedIds?.length ?? 0) > 0) return;
    if (!submittableItems || submittableItems.length === 0) return;

    setSelectedIds(submittableItems.map((a) => a.id));
    hasAutoSelectedBulkRef.current = true;
  }, [canDraftSubmit, selectedIds, submittableItems]);

  useEffect(() => {
    if (!selected) return;
    if (editMode !== 'view') return;

    const selectedIfrsCode = String((selected as any).ifrsCode ?? '').trim();
    const selectedFs1 = String((selected as any).fsMappingLevel1 ?? '').trim();

    setForm((prev) => {
      if (!selectedIfrsCode && String(prev.ifrsCode ?? '').trim()) return prev;
      if (!selectedFs1 && String(prev.fsMappingLevel1 ?? '').trim()) return prev;

      setApprovalMissingFields([]);
      setFieldErrors({});

      const nextCode = String((selected as any).code ?? '').trim();
      const nextName = String((selected as any).name ?? '').trim();
      const nextFs1 = String((selected as any).fsMappingLevel1 ?? '').trim();
      const nextFs2 = String((selected as any).fsMappingLevel2 ?? '').trim();

      return {
        ...prev,
        code: nextCode ? (selected as any).code ?? prev.code : prev.code,
        name: nextName ? (selected as any).name ?? prev.name : prev.name,
        accountType: (selected as any).accountType ?? (selected.type as any) ?? prev.accountType,
        parentAccountId: (selected as any).parentAccountId ?? prev.parentAccountId,
        normalBalance: (selected as any).normalBalance ?? prev.normalBalance,
        ifrsCode: selectedIfrsCode || prev.ifrsCode,
        fsMappingLevel1: nextFs1 || prev.fsMappingLevel1,
        fsMappingLevel2: nextFs2 || prev.fsMappingLevel2,
      };
    });
  }, [selected?.id]);

  useEffect(() => {
    if (editMode === 'view') return;

    if (form.accountType === 'EXPENSE') {
      setForm((prev) => ({ ...prev, normalBalance: 'DEBIT', isBudgetRelevant: true, budgetControlMode: 'BLOCK' }));
      return;
    }

    if (form.accountType === 'INCOME') {
      setForm((prev) => ({ ...prev, normalBalance: 'CREDIT', isBudgetRelevant: true, budgetControlMode: 'WARN' }));
      return;
    }

    if (form.accountType === 'ASSET') {
      setForm((prev) => ({ ...prev, normalBalance: 'DEBIT', isBudgetRelevant: false, budgetControlMode: 'NONE' }));
      return;
    }

    if (form.accountType === 'LIABILITY' || form.accountType === 'EQUITY') {
      setForm((prev) => ({ ...prev, normalBalance: 'CREDIT', isBudgetRelevant: false, budgetControlMode: 'NONE' }));
    }
  }, [form.accountType, editMode]);

  useEffect(() => {
    if (editMode === 'view') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listIfrsNodeReference();
        if (cancelled) return;
        setIfrsOptions(Array.isArray(res) ? res : []);
      } catch {
        if (cancelled) return;
        setIfrsOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.accountType, editMode]);

  useEffect(() => {
    if (editMode === 'view') return;
    setForm((prev) => ({ ...prev, ifrsCode: '' } as any));
    clearFieldError('ifrsCode');
  }, [form.accountType]);

  const officialGroupingParents = useMemo(() => {
    return (parentOptions ?? [])
      .filter((x) => String((x as any).id ?? '') !== String(selectedId ?? ''))
      .slice()
      .sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')));
  }, [parentOptions, selectedId]);

  const onStartCreate = () => {
    setError(null);
    setSuccess(null);
    setApprovalMissingFields([]);
    setFieldErrors({});
    setEditMode('create');
    setSelectedId(null);
    setForm((prev) => ({
      ...prev,
      code: '',
      name: '',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      parentAccountId: null,
      isPostingAllowed: true,
      isControlAccount: false,
      ifrsCode: '',
      fsMappingLevel1: '',
      fsMappingLevel2: '',
      isBudgetRelevant: false,
      budgetControlMode: 'NONE',
    }));
  };

  const onStartEdit = () => {
    if (!selected) return;
    if (!isDraftLike) return;
    if (isPending) return;
    setError(null);
    setSuccess(null);
    setEditMode('edit');
  };

  const onCancel = () => {
    setError(null);
    setSuccess(null);
    setApprovalMissingFields([]);
    setFieldErrors({});
    setEditMode('view');
  };

  const onSave = async (): Promise<string | null> => {
    if (editMode === 'create' && !canDraftCreate) return null;
    if (editMode === 'edit' && !canDraftEdit) return null;
    if (isPending) return null;

    const validated = validateForm();
    if (!validated.ok) {
      setError('Please fix the highlighted fields and try again.');
      return null;
    }

    setApprovalMissingFields([]);

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const enforcedPostingAllowed = canUnlock ? form.isPostingAllowed : true;
      const enforcedControlAccount = canUnlock ? form.isControlAccount : false;

      if (editMode === 'create') {
        const trimmedIfrsCode = String(form.ifrsCode ?? '').trim();
        const payload: any = {
          code: validated.trimmedCode,
          name: validated.trimmedName,
          accountType: form.accountType,
          normalBalance: form.normalBalance,
          parentAccountId: form.parentAccountId,
          isPostingAllowed: enforcedPostingAllowed,
          isControlAccount: enforcedControlAccount,
          ifrsCode: trimmedIfrsCode || undefined,
          fsMappingLevel1: String(form.fsMappingLevel1 ?? '').trim() || undefined,
          fsMappingLevel2: String(form.fsMappingLevel2 ?? '').trim() || undefined,
          isBudgetRelevant: form.isBudgetRelevant,
          budgetControlMode: form.budgetControlMode,
        };

        if (!canUnlock) {
          delete payload.isPosting;
          delete payload.isPostingAllowed;
          delete payload.isControlAccount;
        }

        const created = await createCoaAccount(payload);
        setSuccess('Draft created');
        setFieldErrors({});
        await refresh();
        setSelectedId(created.id);
        setEditMode('edit');
        return created.id;
      }

      if (editMode === 'edit' && selected) {
        const trimmedIfrsCode = String(form.ifrsCode ?? '').trim();
        const payload: any = {
          id: selected.id,
          code: validated.trimmedCode || undefined,
          name: validated.trimmedName || undefined,
          accountType: form.accountType,
          normalBalance: form.normalBalance,
          parentAccountId: form.parentAccountId,
          isPostingAllowed: enforcedPostingAllowed,
          isControlAccount: enforcedControlAccount,
          ifrsCode: trimmedIfrsCode || null,
          fsMappingLevel1: String(form.fsMappingLevel1 ?? '').trim() || undefined,
          fsMappingLevel2: String(form.fsMappingLevel2 ?? '').trim() || undefined,
          isBudgetRelevant: form.isBudgetRelevant,
          budgetControlMode: form.budgetControlMode,
        };

        if (!canUnlock) {
          delete payload.isPosting;
          delete payload.isPostingAllowed;
          delete payload.isControlAccount;
        }

        await updateCoaAccount(payload);
        setSuccess('Draft saved');
        setFieldErrors({});
        await refresh();
        setSelectedId(selected.id);
        setEditMode('edit');
        return selected.id;
      }
    } catch (e: any) {
      console.error('SAVE DRAFT FAILED:', e);
      console.error('BACKEND RESPONSE:', (e as any)?.response?.data);

      const body = (e as any)?.body ?? (e as any)?.response?.data ?? (e as any)?.data;
      const missing = Array.isArray(body?.missingFields) ? (body.missingFields as Array<{ field: string; message: string }>) : [];

      if (missing.length > 0) {
        const nextErrors: typeof fieldErrors = {};

        const translatedMissing: Array<{ field: string; message: string }> = [];
        const unknownMissing: Array<{ field: string; message: string }> = [];

        for (const m of missing) {
          const uiKey = backendToUiFieldMap[String(m.field)];
          if (uiKey) {
            nextErrors[uiKey] = m.message || 'Required';
            translatedMissing.push({ field: String(uiKey), message: m.message });
          } else {
            unknownMissing.push({ field: String(m.field), message: m.message || 'Required' });
          }
        }

        setApprovalMissingFields([...translatedMissing, ...unknownMissing]);
        setFieldErrors(nextErrors);
        focusFirstFieldError(nextErrors);
        setError(body?.message || 'Draft could not be saved. Please contact your System Administrator.');
        return null;
      }

      if (applyBackendIssues(body)) {
        setError(String(body?.message ?? 'Please fix the highlighted fields and try again.'));
        return null;
      }

      const backendMessage = typeof body?.message === 'string' ? body.message.trim() : '';
      if (backendMessage) {
        setError(backendMessage);
        return null;
      }

      const derived = getApiErrorMessage(e, '');
      if (derived && derived !== 'Error') {
        setError(derived);
        return null;
      }

      setError('Draft could not be saved. Please contact your System Administrator.');
      return null;
    } finally {
      setSaving(false);
    }

    return null;
  };

  const onSubmit = async () => {
    if (!selected && editMode !== 'create') return;
    if (!canDraftSubmit) return;
    if (!isDraftLike) return;
    if (isPending) return;

    const validated = validateForm();
    if (!validated.ok) {
      setError('Please fix the highlighted fields and try again.');
      return;
    }

    const saveBeforeSubmit = async (): Promise<string | null> => {
      if (editMode === 'create' || editMode === 'edit') return onSave();

      if (selected && canDraftEdit) {
        const payload: any = {
          id: selected.id,
          code: validated.trimmedCode || undefined,
          name: validated.trimmedName || undefined,
          accountType: form.accountType,
          normalBalance: form.normalBalance,
          parentAccountId: form.parentAccountId,
          isPostingAllowed: canUnlock ? form.isPostingAllowed : true,
          isControlAccount: canUnlock ? form.isControlAccount : false,
          ifrsCode: String(form.ifrsCode ?? '').trim() || null,
          fsMappingLevel1: String(form.fsMappingLevel1 ?? '').trim() || undefined,
          fsMappingLevel2: String(form.fsMappingLevel2 ?? '').trim() || undefined,
          isBudgetRelevant: form.isBudgetRelevant,
          budgetControlMode: form.budgetControlMode,
        };
        await updateCoaAccount(payload);
        return selected.id;
      }

      return selected?.id ?? null;
    };

    const submitId = await saveBeforeSubmit();
    if (!submitId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setApprovalMissingFields([]);
    setFieldErrors({});
    try {
      const res = await submitCoaAccount(submitId);
      if (res.alreadyPending) {
        setSuccess('Approval request is already pending');
      } else {
        setSuccess('Submitted for approval');
      }
      await refresh();
    } catch (e: any) {
      const body = (e as any)?.body ?? (e as any)?.response?.data ?? (e as any)?.data;
      const missing = Array.isArray(body?.missingFields) ? (body.missingFields as Array<{ field: string; message: string }>) : [];
      if (missing.length > 0) {
        const nextErrors: typeof fieldErrors = {};

        const translatedMissing: Array<{ field: string; message: string }> = [];
        const unknownMissing: Array<{ field: string; message: string }> = [];

        for (const m of missing) {
          const uiKey = backendToUiFieldMap[String(m.field)];
          if (uiKey) {
            nextErrors[uiKey] = m.message || 'Required';
            translatedMissing.push({ field: String(uiKey), message: m.message });
          } else {
            unknownMissing.push({ field: String(m.field), message: m.message || 'Required' });
          }
        }

        setApprovalMissingFields([...translatedMissing, ...unknownMissing]);
        setFieldErrors(nextErrors);
        focusFirstFieldError(nextErrors);
        setError(body?.message || 'Account is not ready for approval.');
      } else if (applyBackendIssues(body)) {
        setError(String(body?.message ?? 'Account approval failed due to naming conflicts.'));
      } else {
        const backendMessage = typeof body?.message === 'string' ? body.message.trim() : '';
        if (backendMessage && applyBackendMessageToFieldErrors(backendMessage)) {
          setError(backendMessage);
        } else {
          setError(getApiErrorMessage(e, 'Failed to submit for approval'));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!canDraftSubmit) return;
    if (!selectedIds || selectedIds.length === 0) return;

    if (bulkSubmitBusy) return;

    setBulkSubmitBusy(true);
    setError(null);
    setSuccess(null);
    setBulkSubmitResult(null);

    try {
      const res = await bulkSubmitCoaAccounts(selectedIds);
      setBulkSubmitResult(res);

      const okCount = (res?.success ?? []).length;
      const failCount = (res?.failed ?? []).length;
      setSuccess(`${okCount} submitted successfully${failCount > 0 ? `, ${failCount} failed` : ''}`);

      if (failCount > 0) {
        const grouped = groupFailures(res.failed ?? []);
        const msg = Object.entries(grouped)
          .map(([m, count]) => `${count} → ${m}`)
          .join('\n');
        setError(msg);
      }

      if (okCount > 0) {
        setItems((prev) =>
          (prev ?? []).map((a) =>
            (res.success ?? []).includes(String((a as any).id))
              ? ({
                  ...(a as any),
                  approvalState: 'PENDING_APPROVAL',
                } as any)
              : a,
          ),
        );
      }

      if (okCount > 0) {
        setSelectedIds((prev) => prev.filter((id) => !(res.success ?? []).includes(id)));
      }
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Bulk submit failed'));
    } finally {
      setBulkSubmitBusy(false);
    }
  };

  const resetUploadState = () => {
    setUploadError(null);
    setUploadErrors([]);
    setValidation(null);
    setCommitResult(null);
    setImportStep('upload');
  };

  const onValidateDrafts = async () => {
    if (!canDraftCreate) return;
    if (!uploadFile) {
      setUploadError('Please select a file first');
      return;
    }

    setValidationBusy(true);
    setUploadError(null);
    setUploadErrors([]);
    setCommitResult(null);
    setValidation(null);
    setValidationFilter('ALL');

    try {
      const res = await validateCoaImport(uploadFile);
      setValidation({
        ...(res as any),
        rows: Array.isArray((res as any)?.rows) ? [...((res as any).rows as any[])] : [],
      });

      setImportStep('preview');

      setShowBulkUpload(false);
      setTimeout(() => {
        try {
          validationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          // ignore
        }
      }, 0);
    } catch (e: any) {
      const body = (e as any)?.body;
      if (body && Array.isArray(body.errors)) {
        setUploadErrors(body.errors);
        setUploadError(body.message || 'Validation failed');
      } else {
        setUploadError(getApiErrorMessage(e, 'Validation failed'));
      }
    } finally {
      setValidationBusy(false);
    }
  };

  const onCommitDrafts = async () => {
    if (!canDraftCreate) return;
    if (!validation) return;
    if ((validation.validRows ?? 0) <= 0) return;

    setCommitBusy(true);
    setUploadError(null);

    try {
      const validOnly = validation.rows
        .filter((r) => String((r as any)?.status ?? '').toUpperCase() === 'VALID')
        .map((r) => ({
          rowNumber: r.rowNumber,
          accountCode: r.accountCode,
          accountName: r.accountName,
          parentCode: r.parentCode ?? null,
          accountType: r.accountType,
          normalBalance: r.normalBalance,
          ifrsCode: r.ifrsCode ?? null,
          fsMappingLevel1: r.fsMappingLevel1 ?? null,
          fsMappingLevel2: r.fsMappingLevel2 ?? null,
          status: 'VALID' as const,
          message: r.message ?? null,
        }));

      const res = await commitCoaImport({
        sourceFileName: validation.fileName ?? null,
        rows: validOnly.map((r) => ({
          ...r,
          ifrsCode: (r as any).ifrsCode ?? null,
        })),
      });
      const importedCount = (res as any)?.importedRows ?? (res as any)?.imported ?? 0;
      if (!res.batchId) {
        setSuccess('No accounts were imported. Please fix validation errors and try again.');
      } else if (importedCount === 0) {
        setSuccess('No accounts were imported. Please fix validation errors and try again.');
      } else {
        setSuccess(`${importedCount} draft accounts created successfully.`);
      }

      if (res.batchId) {
        setDraftBatch(null);
        setBatchAccounts([]);
        setBatchLoading(true);
        try {
          const b = await getDraftCoaImportBatch();
          setDraftBatch((b as any)?.batch ?? null);
        } catch {
          setDraftBatch(null);
        } finally {
          setBatchLoading(false);
        }
      }
      await refresh();
      // hard refresh: ensure submissions list updates even if the first refresh raced with state updates
      try {
        await loadSubmissions();
      } catch (e) {
        console.error(e);
      }

      if (res.batchId) {
        resetUploadState();
        setUploadFile(null);
        setValidation(null);
        setImportStep('upload');
      }
    } catch (e: any) {
      setUploadError(getApiErrorMessage(e, 'Import failed'));
    } finally {
      setCommitBusy(false);
    }
  };

  const onSubmitBatch = async () => {
    if (!draftBatch?.batchId) return;
    if (!canDraftSubmit) return;
    if (!batchAccounts || batchAccounts.length === 0) return;
    setBatchActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await submitCoaImportBatch(draftBatch.batchId);
      if ((res as any)?.alreadyPending) {
        setSuccess('Approval request is already pending');
      } else {
        setSuccess('Batch submitted for approval');
      }

      setDraftBatch(null);
      setBatchAccounts([]);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to submit batch'));
    } finally {
      setBatchActionBusy(false);
    }
  };

  const onCancelBatch = async () => {
    if (!draftBatch?.batchId) return;
    if (!canDraftCreate) return;
    setBatchActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await cancelCoaImportBatch(draftBatch.batchId);
      setSuccess('Batch cancelled');

      setDraftBatch(null);
      setBatchAccounts([]);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to cancel batch'));
    } finally {
      setBatchActionBusy(false);
    }
  };

  const onDownloadTemplate = async () => {
    setUploadError(null);
    try {
      const out =
        templateType === 'blank'
          ? await downloadCoaImportTemplate('xlsx')
          : await downloadCoaIndustryImportTemplate(industry);
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setUploadError(getApiErrorMessage(e, 'Failed to download template'));
    }
  };

  const filteredValidationRows =
    !validation || validationFilter === 'ALL'
      ? validation?.rows ?? []
      : validation.rows.filter((r) => r.status === validationFilter);

  const showUploadErrorBanner = Boolean(uploadError) &&
    !(
      (validation?.validRows ?? 0) > 0 &&
      (validation?.errorRows ?? 0) === 0 &&
      (uploadErrors?.length ?? 0) === 0
    );

  const validationTagForMessage = (msg: any) => {
    const s = String(msg ?? '').trim();
    if (!s) return null;

    const upper = s.toUpperCase();
    if (upper.includes('DUPLICATE') && upper.includes('UPLOAD')) {
      return { label: 'Duplicate in file', tone: 'warning' as const };
    }
    if (upper.includes('ALREADY EXISTS IN COA')) {
      return { label: 'Conflict with COA', tone: 'error' as const };
    }
    return null;
  };

  const validationWorkspaceActive = validationBusy || (importStep === 'preview' && !!validation);

  const batchWorkspaceActive = !validationWorkspaceActive && !!draftBatch && draftBatch.status === 'DRAFT';
  const batchIsEmpty = batchWorkspaceActive && (!batchAccounts || batchAccounts.length === 0);

  const batchReadinessSummary = useMemo(() => {
    const base = { READY: 0, INCOMPLETE: 0, ERROR: 0 };
    for (const a of batchAccounts ?? []) {
      const r = String((a as any)?.readiness ?? '').toUpperCase();
      if (r === 'READY' || r === 'INCOMPLETE' || r === 'ERROR') base[r] += 1;
    }
    return base;
  }, [batchAccounts]);

  const batchAllReady = useMemo(() => {
    if (!batchAccounts || batchAccounts.length === 0) return false;
    return batchAccounts.every((a) => String((a as any)?.readiness ?? '').toUpperCase() === 'READY');
  }, [batchAccounts]);

  const filteredBatchAccounts = useMemo(() => {
    if (batchFilter === 'ALL') return batchAccounts;
    return (batchAccounts ?? []).filter((a) => String((a as any)?.readiness ?? '').toUpperCase() === batchFilter);
  }, [batchAccounts, batchFilter]);

  const selectedBatchAccount = useMemo(() => {
    if (!selectedId) return null;
    return (batchAccounts ?? []).find((a) => String(a.id) === String(selectedId)) ?? null;
  }, [batchAccounts, selectedId]);

  useEffect(() => {
    if (!batchWorkspaceActive) return;
    if (!selectedBatchAccount) return;

    const issues = (selectedBatchAccount.issues ?? []).filter((i) => i && String((i as any).field ?? '').trim());
    if (issues.length === 0) return;

    const nextErrors: typeof fieldErrors = {};

    for (const issue of issues) {
      const raw = String((issue as any).field ?? '').trim();
      const key = backendToUiFieldMap[raw];
      if (!key) continue;
      const msg = String((issue as any).message ?? 'Required');

      const prev = (nextErrors as any)[key];
      if (!prev) {
        (nextErrors as any)[key] = [msg];
      } else if (Array.isArray(prev)) {
        prev.push(msg);
      } else {
        (nextErrors as any)[key] = [String(prev), msg];
      }
    }

    setFieldErrors(nextErrors);

    const focusOrder: Array<keyof typeof fieldErrors> = [
      'code',
      'name',
      'accountType',
      'normalBalance',
      'parentAccountId',
      'ifrsCode',
      'fsMappingLevel1',
      'fsMappingLevel2',
      'budgetControlMode',
    ];

    const firstKey = focusOrder.find((k) => Boolean((nextErrors as any)[k]));
    if (!firstKey) return;

    window.setTimeout(() => {
      const el =
        firstKey === 'code'
          ? codeInputRef.current
          : firstKey === 'name'
            ? nameInputRef.current
            : firstKey === 'accountType'
              ? accountTypeRef.current
              : firstKey === 'normalBalance'
                ? normalBalanceRef.current
                : firstKey === 'parentAccountId'
                  ? parentAccountRef.current
                  : firstKey === 'ifrsCode'
                    ? ifrsNodeRef.current
                    : firstKey === 'fsMappingLevel1'
                      ? fsMappingLevel1Ref.current
                      : firstKey === 'fsMappingLevel2'
                        ? fsMappingLevel2Ref.current
                        : firstKey === 'budgetControlMode'
                          ? budgetControlModeRef.current
                          : null;

      if (!el) return;
      try {
        (el as any).scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      } catch {
        // ignore
      }
      (el as any).focus?.();
    }, 0);
  }, [batchWorkspaceActive, selectedBatchAccount?.id]);

  const canSubmitClientSide = useMemo(() => {
    const trimmedCode = String(form.code ?? '').trim();
    const trimmedName = String(form.name ?? '').trim();
    const type = String(form.accountType ?? '').trim();
    const parentId = String(form.parentAccountId ?? '').trim();
    const ifrs = String(form.ifrsCode ?? '').trim();
    const fs1 = String(form.fsMappingLevel1 ?? '').trim();

    if (!trimmedCode) return false;
    if (!trimmedName) return false;
    if (!type) return false;
    if (!parentId) return false;
    if (!ifrs) return false;
    if (!fs1) return false;
    if (Object.keys(fieldErrors ?? {}).length > 0) return false;
    return true;
  }, [form, fieldErrors]);

  useEffect(() => {
    if (Object.keys(fieldErrors ?? {}).length === 0) {
      setError(null);
    }
  }, [fieldErrors]);

  return (
    <div className="financePage coaSubmissionsPage">
      <div className="coaSubmissionsHeader">
        <div>
          <div className="coaSubmissionsHeaderTitle">My COA Submissions</div>
          <div className="coaSubmissionsHeaderSubtitle">Drafts and governance workflow submissions.</div>
        </div>
        <div className="coaSubmissionsHeaderActions">
          {canDraftSubmit ? (
            <Button
              variant="primary"
              disabled={bulkSubmitBusy || loading || saving || selectedIds.length === 0}
              onClick={handleBulkSubmit}
            >
              {bulkSubmitBusy ? 'Submitting…' : `Submit Selected (${selectedIds.length})`}
            </Button>
          ) : null}
          {canDraftCreate ? (
            <>
              <Button onClick={onStartCreate} disabled={saving || loading}>
                Create draft
              </Button>
              <Button variant="secondary" onClick={() => setShowBulkUpload(true)} disabled={saving || loading}>
                Bulk Upload
              </Button>
            </>
          ) : null}
          <Button variant="secondary" onClick={refresh} disabled={saving || loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error" title="Error">{error}</Alert> : null}
      {success ? (
        <Alert tone="success" title="Success">
          {success}
        </Alert>
      ) : null}

      {bulkSubmitResult && (bulkSubmitResult.failed?.length ?? 0) > 0 ? (
        <Alert tone="warning" title="Bulk submit summary">
          <div style={{ display: 'grid', gap: 6, fontSize: 13, color: tokens.colors.text.secondary }}>
            <div>
              ✔ {(bulkSubmitResult.success ?? []).length} succeeded
            </div>
            <div>
              ❌ {(bulkSubmitResult.failed ?? []).length} failed
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {(() => {
                const grouped = groupFailures(bulkSubmitResult.failed ?? []);
                const entries = Object.entries(grouped);
                return (
                  <>
                    {entries.slice(0, 8).map(([msg, count]) => (
                      <div key={msg}>
                        - {count} → {msg}
                      </div>
                    ))}
                    {entries.length > 8 ? (
                      <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Showing first 8 failure groups.</div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        </Alert>
      ) : null}

      {approvalMissingFields.length > 0 ? (
        <Alert tone="warning" title="Approval readiness">
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>Missing fields:</div>
          <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
            {approvalMissingFields.map((f) => (
              <div key={f.field} style={{ fontSize: 13 }}>
                - {f.message}
              </div>
            ))}
          </div>
        </Alert>
      ) : null}

      {importStep === 'preview' && validationWorkspaceActive ? (
        <div style={{ marginTop: 14 }} key={validation?.totalRows || 0}>
          <div className="coaPanel" style={{ width: '100%' }} ref={validationPanelRef}>
            <div className="coaPanelHeader">COA Import Validation</div>
            <div className="coaPanelBody">
              {showUploadErrorBanner ? (
                <div style={{ marginBottom: 12 }}>
                  <Alert tone="error" title="Error">
                    {uploadError}
                  </Alert>
                </div>
              ) : null}

              {validationBusy && !validation ? (
                <div style={{ color: tokens.colors.text.muted, fontSize: 13 }}>Validating…</div>
              ) : null}

              {validation ? (
                <div className="coa-validation-container">
                  <div className="coa-validation-header">
                    <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                          <div style={{ fontWeight: 800, color: tokens.colors.text.primary }}>Total Rows</div>
                          <div>{validation.totalRows}</div>
                        </div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                          <div style={{ fontWeight: 800, color: tokens.colors.text.primary }}>Valid Rows</div>
                          <div>{validation.validRows}</div>
                        </div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                          <div style={{ fontWeight: 800, color: tokens.colors.text.primary }}>Errors</div>
                          <div>{validation.errorRows}</div>
                        </div>
                      </div>

                      {validation.errorRows > 0 ? (
                        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const csv = toErrorReportCsv(validation.rows);
                              triggerDownload(
                                new Blob([csv], { type: 'text/csv;charset=utf-8' }),
                                'coa_import_error_report.csv',
                              );
                            }}
                          >
                            Download Error Report
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Button
                        variant={validationFilter === 'ALL' ? 'primary' : 'secondary'}
                        onClick={() => setValidationFilter('ALL')}
                        disabled={validationBusy || commitBusy}
                      >
                        All
                      </Button>
                      <Button
                        variant={validationFilter === 'VALID' ? 'primary' : 'secondary'}
                        onClick={() => setValidationFilter('VALID')}
                        disabled={validationBusy || commitBusy}
                      >
                        Valid
                      </Button>
                      <Button
                        variant={validationFilter === 'ERROR' ? 'primary' : 'secondary'}
                        onClick={() => setValidationFilter('ERROR')}
                        disabled={validationBusy || commitBusy}
                      >
                        Errors
                      </Button>
                    </div>
                  </div>

                  <div className="coa-validation-table-wrapper">
                    <div
                      style={{
                        padding: 10,
                        fontWeight: 850,
                        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                        background: tokens.colors.surface.subtle,
                      }}
                    >
                      Preview
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: tokens.colors.surface.hover }}>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Account Code</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Account Name</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Parent Code</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Account Type</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Normal Balance</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>IFRS Mapping</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '8px 10px', width: '45%' }}>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredValidationRows.map((r) => (
                            <tr
                              key={r.rowNumber}
                              style={{
                                borderTop: `1px solid ${tokens.colors.border.subtle}`,
                                background: r.status === 'ERROR' ? 'rgba(220,38,38,0.06)' : undefined,
                              }}
                            >
                              <td
                                style={{
                                  padding: '8px 10px',
                                  fontFamily:
                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                }}
                              >
                                {r.accountCode}
                              </td>
                              <td style={{ padding: '8px 10px' }}>{r.accountName}</td>
                              <td style={{ padding: '8px 10px' }}>{r.parentCode ?? ''}</td>
                              <td style={{ padding: '8px 10px' }}>{r.accountType ?? ''}</td>
                              <td style={{ padding: '8px 10px' }}>{r.normalBalance ?? ''}</td>
                              <td style={{ padding: '8px 10px' }}>{(r as any).ifrsCode ?? ''}</td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  fontWeight: 800,
                                  color: r.status === 'VALID' ? '#16a34a' : '#dc2626',
                                }}
                              >
                                {r.status}
                              </td>
                              <td
                                style={{
                                  padding: '8px 10px',
                                  color: tokens.colors.text.secondary,
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {(() => {
                                  const tag = validationTagForMessage(r.message);
                                  return (
                                    <div style={{ display: 'grid', gap: 4 }}>
                                      {tag ? (
                                        <div>
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              padding: '2px 8px',
                                              borderRadius: 999,
                                              fontWeight: 850,
                                              fontSize: 11,
                                              border: `1px solid ${tokens.colors.border.subtle}`,
                                              background:
                                                tag.tone === 'error'
                                                  ? 'rgba(220,38,38,0.10)'
                                                  : 'rgba(217,119,6,0.12)',
                                              color: tag.tone === 'error' ? '#991b1b' : '#9a3412',
                                            }}
                                          >
                                            {tag.label}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div>{r.message ?? ''}</div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="coa-validation-footer">
                    <span className="summary-text">
                      {validation.totalRows} rows • {validation.validRows} valid • {validation.errorRows} errors
                    </span>
                    <div className="actions">
                      <Button
                        variant="secondary"
                        disabled={validationBusy || commitBusy}
                        onClick={() => {
                          resetUploadState();
                          setUploadFile(null);
                          setImportStep('upload');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="accent"
                        disabled={!canDraftCreate || validationBusy || commitBusy || (validation?.validRows ?? 0) <= 0}
                        onClick={onCommitDrafts}
                      >
                        {commitBusy ? 'Importing…' : 'Import Draft Accounts'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!validationWorkspaceActive ? (
        <div className="coaPageLayout">
          {batchWorkspaceActive ? (
            <div className="coaPanel coaQueueCard coaSubmissionsQueueCard">
              <div className="coaPanelHeader">COA Import Batch</div>
              <div className="coaPanelBody">
                <div style={{ display: 'grid', gap: 10 }}>
                  {batchIsEmpty ? (
                    <div
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        background: tokens.colors.surface.subtle,
                        padding: 10,
                        fontSize: 12,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      This batch contains no accounts.
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 850, color: tokens.colors.text.primary }}>Batch ID: {draftBatch?.batchId}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>
                        Status: {String(draftBatch?.status ?? '').replaceAll('_', ' ').toLowerCase()} • Accounts: {draftBatch?.accountCount ?? 0}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.secondary }}>
                        READY: {batchReadinessSummary.READY} • INCOMPLETE: {batchReadinessSummary.INCOMPLETE} • ERROR: {batchReadinessSummary.ERROR}
                      </div>
                      {!batchAllReady && !batchIsEmpty ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                          Batch cannot be submitted until all accounts are READY.
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button variant="secondary" onClick={onCancelBatch} disabled={batchActionBusy || batchLoading || saving || loading}>
                        Cancel batch
                      </Button>
                      <Button
                        variant="primary"
                        onClick={onSubmitBatch}
                        disabled={batchIsEmpty || !canDraftSubmit || !batchAllReady || batchActionBusy || batchLoading || saving || loading}
                      >
                        Submit batch for approval
                      </Button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                      variant={batchFilter === 'ALL' ? 'primary' : 'secondary'}
                      onClick={() => setBatchFilter('ALL')}
                      disabled={batchLoading || batchActionBusy}
                    >
                      All
                    </Button>
                    <Button
                      variant={batchFilter === 'READY' ? 'primary' : 'secondary'}
                      onClick={() => setBatchFilter('READY')}
                      disabled={batchLoading || batchActionBusy}
                    >
                      Ready
                    </Button>
                    <Button
                      variant={batchFilter === 'INCOMPLETE' ? 'primary' : 'secondary'}
                      onClick={() => setBatchFilter('INCOMPLETE')}
                      disabled={batchLoading || batchActionBusy}
                    >
                      Incomplete
                    </Button>
                    <Button
                      variant={batchFilter === 'ERROR' ? 'primary' : 'secondary'}
                      onClick={() => setBatchFilter('ERROR')}
                      disabled={batchLoading || batchActionBusy}
                    >
                      Errors
                    </Button>
                  </div>

                  <div style={{ height: 1, background: tokens.colors.border.subtle, opacity: 0.9 }} />

                  {batchLoading ? <div style={{ color: tokens.colors.text.muted, fontSize: 13 }}>Loading batch…</div> : null}

                  {!batchLoading ? (
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Batch drafts</div>
                      <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: 'left',
                                fontSize: 12,
                                padding: '8px 8px',
                                borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                              }}
                            >
                              Readiness
                            </th>
                            <th
                              style={{
                                textAlign: 'left',
                                fontSize: 12,
                                padding: '8px 8px',
                                borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                              }}
                            >
                              Code
                            </th>
                            <th
                              style={{
                                textAlign: 'left',
                                fontSize: 12,
                                padding: '8px 8px',
                                borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                              }}
                            >
                              Name
                            </th>
                            <th
                              style={{
                                textAlign: 'left',
                                fontSize: 12,
                                padding: '8px 8px',
                                borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                              }}
                            >
                              Issues
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(filteredBatchAccounts ?? []).length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: 10, fontSize: 12, color: tokens.colors.text.muted }}>
                                No accounts match this filter.
                              </td>
                            </tr>
                          ) : null}

                          {(filteredBatchAccounts ?? []).map((a) => {
                            const r = String((a as any).readiness ?? '').toUpperCase();
                            const isSelected = String(selectedId ?? '') === String(a.id);

                            const badgeColor = r === 'READY' ? '#16a34a' : r === 'INCOMPLETE' ? '#d97706' : '#dc2626';
                            const badgeBg = r === 'READY' ? 'rgba(22,163,74,0.12)' : r === 'INCOMPLETE' ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.10)';

                            return (
                              <tr
                                key={a.id}
                                onClick={() => {
                                  setSelectedId(a.id);
                                  setEditMode('view');
                                  window.setTimeout(() => {
                                    detailsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 0);
                                }}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? 'rgba(15,23,42,0.04)' : undefined,
                                }}
                              >
                                <td style={{ padding: '10px 8px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      borderRadius: 999,
                                      padding: '4px 10px',
                                      fontSize: 12,
                                      fontWeight: 850,
                                      background: badgeBg,
                                      color: badgeColor,
                                      border: `1px solid ${tokens.colors.border.subtle}`,
                                    }}
                                  >
                                    {r || '—'}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: '10px 8px',
                                    borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                                    fontFamily:
                                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    fontSize: 12,
                                  }}
                                >
                                  {a.code}
                                </td>
                                <td style={{ padding: '10px 8px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>
                                  {a.name}
                                </td>
                                <td
                                  style={{
                                    padding: '10px 8px',
                                    borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                                    fontSize: 12,
                                    color: tokens.colors.text.secondary,
                                  }}
                                >
                                  {(a.issues ?? []).length > 0
                                    ? (a.issues ?? []).map((x) => x.message).slice(0, 3).join(' • ')
                                    : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="coaPanel coaQueueCard coaSubmissionsQueueCard">
              <div className="coaPanelHeader">Queue</div>
              <div className="coaPanelBody">
                <div className="coaQueueScroll">
                  {loading ? <div style={{ color: tokens.colors.text.muted }}>Loading…</div> : null}
                  {!loading && items.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No drafts/submissions.</div> : null}

                  {!loading && items.length > 0 ? (
                    <div className="coaQueueGrid" role="table" aria-label="COA queue">
                      <div className="coaQueueGridHead" role="row">
                        <div className="coaQueueGridCell" role="columnheader">
                          <input
                            type="checkbox"
                            checked={submittableItems.length > 0 && selectedIds.length === submittableItems.length}
                            onChange={(e) => {
                              hasUserTouchedBulkSelectionRef.current = true;
                              if (e.target.checked) {
                                setSelectedIds(submittableItems.map((a) => a.id));
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="coaQueueGridCell" role="columnheader">
                          State
                        </div>
                        <div className="coaQueueGridCell" role="columnheader">
                          Account
                        </div>
                        <div className="coaQueueGridCell coaQueueGridCellUpdated" role="columnheader">
                          Updated
                        </div>
                      </div>

                      {items.map((r) => (
                        (() => {
                          const rowState = String((r as any)?.approvalState ?? (r as any)?.status ?? '').toUpperCase();
                          const rowCanSelect = rowState === 'DRAFT' || rowState === 'REJECTED';

                          return (
                        <div
                          key={r.id}
                          role="row"
                          className={`coaQueueGridRow${selectedId === r.id ? ' coaQueueGridRow--selected' : ''}${failedIdSet.has(String(r.id)) ? ' row-error' : ''}`}
                          onClick={() => setSelectedId(r.id)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(r.id);
                            }
                          }}
                        >
                          <div className="coaQueueGridCell" role="cell">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(r.id)}
                              disabled={!rowCanSelect}
                              onChange={(e) => {
                                hasUserTouchedBulkSelectionRef.current = true;
                                if (e.target.checked) {
                                  setSelectedIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
                                } else {
                                  setSelectedIds((prev) => prev.filter((id) => id !== r.id));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="coaQueueGridCell" role="cell">
                            <StatusBadge state={(r as any).approvalState ?? r.status ?? 'DRAFT'} />
                          </div>
                          <div className="coaQueueGridCell" role="cell">
                            <CoaStatusBadge status={(r as any).status ?? null} />
                          </div>
                          <div className="coaQueueGridCell" role="cell">
                            <div className="coaQueueAccountCode">{r.code}</div>

                            <div className="coaQueueAccountName">{r.name}</div>
                          </div>
                          <div className="coaQueueGridCell coaQueueGridCellUpdated" role="cell">
                            <span className="coaQueueUpdated">{String(r.updatedAt ?? '').slice(0, 19).replace('T', ' ')}</span>
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <div className="coaPanel coaPreviewCard coaSubmissionsPreviewCard" ref={detailsPanelRef}>
            <div className="coaDetailsHeader">
              <div className="coaDetailsHeaderLeft">
                <div className="coaDetailsHeadline">
                  {selected ? `${selected.code} — ${selected.name}` : 'Details'}
                </div>
                {selected ? (
                  <>
                    <div className="coaDetailsMeta">
                      <span>{selected.type}</span>
                      <span>•</span>
                      <span>{(selected as any).isPosting === false ? 'Non-posting' : 'Posting'}</span>
                      <span>•</span>
                      <span>{(selected as any).isControlAccount ? 'Control' : 'Non-control'}</span>
                    </div>
                    <div className="coaDetailsStatusLine">
                      Status: {String(approvalState ?? 'DRAFT').replaceAll('_', ' ').toLowerCase()}
                    </div>
                    <div className="coaDetailsStatusLine" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>Lifecycle:</span>
                      <CoaStatusBadge status={(selected as any).status ?? null} />
                    </div>
                  </>
                ) : null}
              </div>

              {canDraftEdit || canDraftSubmit ? (
                <div className="coaDetailsHeaderRight">
                  {editMode === 'view' ? (
                    selected ? (
                      <>
                        {canDraftEdit ? (
                          <Button variant="secondary" onClick={onStartEdit} disabled={saving || loading || isPending || !isDraftLike || isRetired}>
                            Edit
                          </Button>
                        ) : null}
                        {canDraftSubmit ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <Button
                              variant="primary"
                              onClick={onSubmit}
                              disabled={saving || loading || isPending || !isDraftLike || submitPostingBlocked || isRetired || !canSubmitClientSide}
                            >
                              Submit for approval
                            </Button>
                            {submitPostingBlocked ? (
                              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, maxWidth: 320, textAlign: 'right' }}>
                                Officer-created accounts must be posting accounts.
                              </div>
                            ) : null}
                            {isRetired ? (
                              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, maxWidth: 320, textAlign: 'right' }}>
                                Retired accounts cannot be edited or re-submitted.
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null
                  ) : (
                    <>
                      <Button variant="secondary" onClick={onCancel} disabled={saving || loading}>
                        Cancel
                      </Button>
                      <Button onClick={onSave} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save draft'}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

          <div className="coaPanelBody">
            <div className="coaPreviewScroll">
              {!formVisible ? <div style={{ color: tokens.colors.text.muted }}>Select a draft/submission.</div> : null}

              {batchWorkspaceActive && selectedBatchAccount && (selectedBatchAccount.issues ?? []).length > 0 ? (
                <Alert tone="warning" title="Batch issues">
                  <div style={{ display: 'grid', gap: 6, fontSize: 13, color: tokens.colors.text.secondary }}>
                    {(selectedBatchAccount.issues ?? []).slice(0, 8).map((i, idx) => (
                      <div key={idx}>
                        - {i.message}
                      </div>
                    ))}
                    {(selectedBatchAccount.issues ?? []).length > 8 ? (
                      <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Showing first 8 issues.</div>
                    ) : null}
                  </div>
                </Alert>
              ) : null}

              {selected && isPending ? (
                <div className="coaMicroNotice">
                  <span className="coaMicroNoticeIcon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </span>
                  <span>Awaiting approval. Editing is locked.</span>
                </div>
              ) : null}

              {selected && isRetired ? (
                <Alert tone="warning" title="Retired account">
                  This account is retired and cannot be edited or used for new postings.
                </Alert>
              ) : null}

              {formVisible ? (
                <div>
                  {selected && isRejected ? (
                    <div
                      style={{
                        borderLeft: '4px solid #e79e13',
                        background: 'rgba(231,158,19,0.08)',
                        padding: '12px 16px',
                        borderRadius: 8,
                        marginTop: 12,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: tokens.colors.text.primary }}>
                        Rejected by Finance Manager
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>
                        {formatRejectionTimestamp(rejectedAt) || '\u00A0'}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.text.primary, width: '100%' }}>
                        {rejectedReason || 'Rejected (no reason provided).'}
                      </div>
                    </div>
                  ) : null}

                  <div className="coaFormGrid">
                  <div className="coaField">
                    <div className="coaLabel">Account Code</div>
                    <div className="coaControl coaControl--tight">
                      <Input
                        ref={codeInputRef}
                        value={form.code}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, code: e.target.value }));
                          clearFieldError('code');
                        }}
                        disabled={inputsDisabled}
                        touched
                        error={fieldErrors.code}
                      />
                    </div>
                  </div>

                <div className="coaField">
                  <div className="coaLabel">Account Name</div>
                  <div className="coaControl coaControl--tight">
                    <Input
                      ref={nameInputRef}
                      value={form.name}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, name: e.target.value }));
                        clearFieldError('name');
                      }}
                      disabled={inputsDisabled}
                      touched
                      error={fieldErrors.name}
                    />
                  </div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">Account type</div>
                  <div className="coaControl coaControl--tight">
                    <select
                      ref={accountTypeRef}
                      value={form.accountType}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, accountType: e.target.value as CoaAccountType }));
                        clearFieldError('accountType');
                      }}
                      disabled={inputsDisabled}
                      className="coaSelect"
                      style={{
                        border: `1px solid ${fieldErrors.accountType ? '#ef4444' : tokens.colors.border.subtle}`,
                      }}
                    >
                      <option value="ASSET">ASSET</option>
                      <option value="LIABILITY">LIABILITY</option>
                      <option value="EQUITY">EQUITY</option>
                      <option value="INCOME">INCOME</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </select>
                  </div>
                  <div className={`coaInlineError${fieldErrors.accountType ? ' coaInlineError--active' : ''}`}>{fieldErrors.accountType ? fieldErrors.accountType : '\u00A0'}</div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">Normal balance</div>
                  <div className="coaControl coaControl--tight">
                    <select
                      ref={normalBalanceRef}
                      value={form.normalBalance}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, normalBalance: e.target.value as NormalBalance }));
                        clearFieldError('normalBalance');
                      }}
                      disabled={inputsDisabled}
                      className="coaSelect"
                      style={{
                        border: `1px solid ${fieldErrors.normalBalance ? '#ef4444' : tokens.colors.border.subtle}`,
                      }}
                    >
                      <option value="DEBIT">DEBIT</option>
                      <option value="CREDIT">CREDIT</option>
                    </select>
                  </div>
                  <div className={`coaInlineError${fieldErrors.normalBalance ? ' coaInlineError--active' : ''}`}>{fieldErrors.normalBalance ? fieldErrors.normalBalance : '\u00A0'}</div>
                </div>

                <div className="coaField coaField--full">
                  <div className="coaLabel">Parent Account</div>
                  <div className="coaControl coaControl--tight">
                    <select
                      ref={parentAccountRef}
                      value={form.parentAccountId ?? ''}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, parentAccountId: e.target.value ? e.target.value : null }));
                        clearFieldError('parentAccountId');
                      }}
                      disabled={inputsDisabled}
                      className="coaSelect"
                      style={{
                        border: `1px solid ${fieldErrors.parentAccountId ? '#ef4444' : tokens.colors.border.subtle}`,
                      }}
                    >
                      <option value="">Root Account</option>
                      {officialGroupingParents.map((x) => (
                        <option key={x.id} value={x.id}>
                          {`${x.code} - ${x.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`coaInlineError${fieldErrors.parentAccountId ? ' coaInlineError--active' : ''}`}>{fieldErrors.parentAccountId ? fieldErrors.parentAccountId : '\u00A0'}</div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">Posting Account</div>
                  {!canUnlock ? (
                    <div style={{ marginTop: 10, fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 750 }}>Yes (Auto)</div>
                  ) : (
                    <div className="coaCheckRow">
                      <input
                        type="checkbox"
                        checked={form.isPostingAllowed}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, isPostingAllowed: e.target.checked }));
                          clearFieldError('ifrsCode');
                        }}
                        disabled={inputsDisabled}
                      />
                      <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>{form.isPostingAllowed ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>

                <div className="coaField">
                  <div className="coaLabel">Control Account</div>
                  {!canUnlock ? (
                    <div style={{ marginTop: 10, fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 750 }}>No (Restricted)</div>
                  ) : (
                    <div className="coaCheckRow">
                      <input
                        type="checkbox"
                        checked={form.isControlAccount}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, isControlAccount: e.target.checked }));
                        }}
                        disabled={inputsDisabled}
                      />
                      <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>{form.isControlAccount ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>

                <div className="coaField coaField--full">
                  <div className="coaLabel">IFRS Mapping</div>
                  <div className="coaControl coaControl--tight">
                    <select
                      ref={ifrsNodeRef}
                      value={form.ifrsCode || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          ifrsCode: value,
                        }));
                        clearFieldError('ifrsCode');
                      }}
                      disabled={inputsDisabled}
                      className="coaSelect"
                      style={{
                        border: `1px solid ${(fieldErrors as any).ifrsCode ? '#ef4444' : tokens.colors.border.subtle}`,
                        background: (fieldErrors as any).ifrsCode ? '#fef2f2' : '#fff',
                      }}
                    >
                      <option value="">(Select)</option>
                      {ifrsOptions.map((o) => (
                        <option key={o.id} value={o.code}>
                          {o.code ? `${o.code} - ${o.name}` : o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {ifrsOptions.length === 0 ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                      No IFRS mapping structure configured
                    </div>
                  ) : null}

                  <div className={`coaInlineError${fieldErrors.ifrsCode ? ' coaInlineError--active' : ''}`}>{fieldErrors.ifrsCode ? fieldErrors.ifrsCode : '\u00A0'}</div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">FS Mapping Level 1</div>
                  <div className="coaControl coaControl--tight">
                    <Input
                      ref={fsMappingLevel1Ref}
                      value={form.fsMappingLevel1}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, fsMappingLevel1: e.target.value }));
                        clearFieldError('fsMappingLevel1');
                      }}
                      disabled={inputsDisabled}
                      touched
                      error={fieldErrors.fsMappingLevel1}
                    />
                  </div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">FS Mapping Level 2</div>
                  <div className="coaControl coaControl--tight">
                    <Input
                      ref={fsMappingLevel2Ref}
                      value={form.fsMappingLevel2}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, fsMappingLevel2: e.target.value }));
                        clearFieldError('fsMappingLevel2');
                      }}
                      disabled={inputsDisabled}
                      touched
                      error={fieldErrors.fsMappingLevel2}
                    />
                  </div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">Budget Relevant</div>
                  <div className="coaCheckRow">
                    <input
                      type="checkbox"
                      checked={form.isBudgetRelevant}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, isBudgetRelevant: e.target.checked }));
                        clearFieldError('isBudgetRelevant');
                      }}
                      disabled={inputsDisabled}
                    />
                    <div style={{ fontSize: 13, color: tokens.colors.text.secondary, fontWeight: 700 }}>
                      {form.isBudgetRelevant ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className={`coaInlineError${fieldErrors.isBudgetRelevant ? ' coaInlineError--active' : ''}`}>{fieldErrors.isBudgetRelevant ? fieldErrors.isBudgetRelevant : '\u00A0'}</div>
                </div>

                <div className="coaField">
                  <div className="coaLabel">Budget Control Mode</div>
                  <div className="coaControl coaControl--tight">
                    <select
                      ref={budgetControlModeRef}
                      value={form.budgetControlMode}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, budgetControlMode: e.target.value as BudgetControlMode }));
                        clearFieldError('budgetControlMode');
                      }}
                      disabled={inputsDisabled}
                      className="coaSelect"
                      style={{
                        border: `1px solid ${fieldErrors.budgetControlMode ? '#ef4444' : tokens.colors.border.subtle}`,
                      }}
                    >
                      <option value="NONE">NONE</option>
                      <option value="WARN">WARN</option>
                      <option value="BLOCK">BLOCK</option>
                    </select>
                  </div>
                  <div className={`coaInlineError${fieldErrors.budgetControlMode ? ' coaInlineError--active' : ''}`}>{fieldErrors.budgetControlMode ? fieldErrors.budgetControlMode : '\u00A0'}</div>
                </div>
              </div>
            </div>
        ) : null}
          </div>
        </div>
      </div>
    </div>
  ) : null}

      {showBulkUpload ? (
        <ModalShell
          title="Bulk Upload (Draft COA)"
          subtitle="Upload CSV or XLSX (single sheet named COA). Imported rows will appear in My COA Submissions as drafts."
          onClose={() => setShowBulkUpload(false)}
          width={720}
        >
          <div className="bulk-modal">
            <div className="bulk-modal-body">
              {!canDraftCreate ? (
                <Alert tone="error" title="Access denied">
                  You do not have permission to upload COA.
                </Alert>
              ) : null}

              {uploadError ? <div className="error-box">{uploadError}</div> : null}

              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 850, color: tokens.colors.text.primary }}>Step 1 — Download Template</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Template Type</div>
                    <select
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value as any)}
                      disabled={validationBusy || commitBusy}
                      className="coaSelect"
                      style={{ marginTop: 6, width: '100%', border: `1px solid ${tokens.colors.border.subtle}` }}
                    >
                      <option value="blank">Blank Template</option>
                      <option value="industry">Industry Starter Template</option>
                    </select>
                  </div>

                  {templateType === 'industry' ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Industry</div>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value as any)}
                        disabled={validationBusy || commitBusy}
                        className="coaSelect"
                        style={{ marginTop: 6, width: '100%', border: `1px solid ${tokens.colors.border.subtle}` }}
                      >
                        <option value="professional-services">Professional Services</option>
                        <option value="retail">Retail</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="nonprofit">Nonprofit</option>
                      </select>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Button variant="secondary" disabled={validationBusy || commitBusy} onClick={onDownloadTemplate}>
                    Download Template
                  </Button>
                </div>

                <div style={{ height: 1, background: tokens.colors.border.subtle, opacity: 0.9 }} />

                <div style={{ fontSize: 13, fontWeight: 850, color: tokens.colors.text.primary }}>Step 2 — Upload Completed Template</div>

                <div>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    disabled={validationBusy || commitBusy || !canDraftCreate}
                    onChange={(e) => {
                      resetUploadState();
                      const f = e.target.files?.[0] ?? null;
                      setUploadFile(f);
                      setValidation(null);
                      setImportStep('upload');
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>Accepted: .csv, .xlsx</div>
                </div>
              </div>

              {showUploadErrorBanner ? (
                <div style={{ marginTop: 10 }}>
                  <Alert
                    tone={uploadErrors.length > 0 ? 'warning' : 'error'}
                    title={uploadErrors.length > 0 ? 'Validation failed' : 'Error'}
                  >
                    {uploadError}
                  </Alert>
                </div>
              ) : null}

              {commitResult ? (
                <div style={{ marginTop: 10 }}>
                  <Alert tone="success" title="Import complete">
                    <div>{commitResult.imported} draft accounts created.</div>
                    <div>{commitResult.skipped} rows skipped due to validation errors.</div>
                    <div>Submission awaiting Manager approval.</div>
                  </Alert>
                </div>
              ) : null}

              {uploadErrors.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Errors</div>
                  <div style={{ marginTop: 8, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12 }}>
                    {uploadErrors.slice(0, 200).map((e, idx) => (
                      <div
                        key={idx}
                        style={{ padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}
                      >
                        <span style={{ fontWeight: 800 }}>Row {e.row ?? '?'}:</span>{' '}
                        <span
                          style={{
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          }}
                        >
                          {e.column ?? ''}
                        </span>{' '}
                        — {e.message}
                      </div>
                    ))}
                  </div>
                  {uploadErrors.length > 200 ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>Showing first 200 errors.</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="bulk-modal-footer">
              <Button variant="ghost" disabled={validationBusy || commitBusy} onClick={() => setShowBulkUpload(false)}>
                Cancel
              </Button>
              <Button disabled={validationBusy} onClick={onValidateDrafts}>
                {validationBusy ? 'Validating…' : 'Validate File'}
              </Button>
              <Button
                disabled={!canDraftCreate || validationBusy || commitBusy || !validation || (validation.validRows ?? 0) <= 0}
                onClick={onCommitDrafts}
                variant="accent"
              >
                {commitBusy ? 'Importing…' : 'Import Draft Accounts'}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}

    </div>
  );
}
