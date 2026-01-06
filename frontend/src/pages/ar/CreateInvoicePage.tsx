import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useBranding } from '../../branding/BrandingContext';
import type { AccountLookup, Customer, InvoiceCategory } from '../../services/ar';
import { createInvoice, listEligibleAccounts, listCustomers, listInvoiceCategories } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';
import type { TaxRate } from '../../services/tax';
import { listTaxRates } from '../../services/tax';
import { formatMoney } from '../../money';
import { listDepartments, listProjects, listFunds, type DepartmentLookup, type ProjectLookup, type FundLookup } from '../../services/gl';

type Line = {
  accountId: string;
  accountSearch: string;
  accountPickerOpen: boolean;
  taxRateId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  departmentId?: string;
  projectId?: string;
  fundId?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateInvoicePage() {
  const { hasPermission } = useAuth();
  const { effective } = useBranding();
  const navigate = useNavigate();

  const canCreate = hasPermission('AR_INVOICE_CREATE');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<AccountLookup[]>([]);
  const [invoiceCategories, setInvoiceCategories] = useState<InvoiceCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [funds, setFunds] = useState<FundLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const tenantDefaultCurrency = String(effective?.defaultCurrency ?? '').trim();
  const currencyOptions = useMemo(() => {
    const base = String(tenantDefaultCurrency ?? '').trim().toUpperCase();
    const common = ['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN', 'GHS', 'UGX', 'TZS', 'AED', 'SAR', 'INR', 'AUD', 'CAD'];
    const all = [...new Set([base, ...common].filter(Boolean))];
    return all.length > 0 ? all : ['USD'];
  }, [tenantDefaultCurrency]);

  const [currency, setCurrency] = useState(tenantDefaultCurrency || 'USD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [reference, setReference] = useState('');
  const [invoiceNote, setInvoiceNote] = useState('');
  const [headerProjectId, setHeaderProjectId] = useState<string>('');
  const [headerFundId, setHeaderFundId] = useState<string>('');
  const [headerDepartmentId, setHeaderDepartmentId] = useState<string>('');
  const [invoiceCategoryId, setInvoiceCategoryId] = useState<string>('');
  const [discountsEnabled, setDiscountsEnabled] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    {
      accountId: '',
      accountSearch: '',
      accountPickerOpen: false,
      taxRateId: '',
      description: '',
      quantity: '1',
      unitPrice: '',
      discountPercent: '',
      discountAmount: '',
    },
  ]);

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);

    Promise.all([listCustomers(), listEligibleAccounts(), listInvoiceCategories(), listTaxRates(), listDepartments(), listProjects(), listFunds()])
      .then(([custs, accs, cats, tax, deps, projs, fnds]) => {
        if (!mounted) return;
        setCustomers((custs.items ?? []).filter((c) => c.status === 'ACTIVE'));
        setAccounts(accs);
        setInvoiceCategories((cats ?? []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))));
        setTaxRates((tax ?? []).filter((t) => t.isActive && String(t.type) === 'OUTPUT'));
        setDepartments(deps);
        setProjects(projs);
        setFunds(fnds);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load lookups'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantDefaultCurrency) return;
    setCurrency((prev) => prev || tenantDefaultCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantDefaultCurrency]);

  useEffect(() => {
    const normalized = String(currency ?? '').trim().toUpperCase();
    if (!normalized) {
      setCurrency(currencyOptions[0] ?? 'USD');
      return;
    }
    if (!currencyOptions.includes(normalized)) {
      setCurrency(currencyOptions[0] ?? 'USD');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyOptions]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId) ?? null;
  }, [customerId, customers]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const code = String(selectedCustomer.customerCode ?? '').trim();
    setCustomerSearch(code ? `${code} - ${selectedCustomer.name}` : selectedCustomer.name);
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const q = String(customerSearch ?? '').trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = String(c.name ?? '').toLowerCase();
      const code = String(c.customerCode ?? '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [customerSearch, customers]);

  const normalizedCurrency = useMemo(() => String(currency ?? '').trim().toUpperCase(), [currency]);
  const normalizedBase = useMemo(() => String(tenantDefaultCurrency ?? '').trim().toUpperCase(), [tenantDefaultCurrency]);
  const isBaseCurrency = Boolean(normalizedBase && normalizedCurrency && normalizedCurrency === normalizedBase);

  useEffect(() => {
    if (isBaseCurrency) setExchangeRate('1');
  }, [isBaseCurrency]);

  const exchangeRateNum = useMemo(() => Number(exchangeRate), [exchangeRate]);
  const exchangeRateInvalid = useMemo(() => {
    if (isBaseCurrency) return false;
    return !(exchangeRateNum > 0);
  }, [exchangeRateNum, isBaseCurrency]);

  const exchangeRateError = useMemo(() => {
    if (!exchangeRateInvalid) return null;
    return 'Exchange rate is required when invoice currency differs from base currency';
  }, [exchangeRateInvalid]);

  const selectedInvoiceCategory = useMemo(() => {
    return invoiceCategories.find((c) => c.id === invoiceCategoryId) ?? null;
  }, [invoiceCategories, invoiceCategoryId]);

  const selectableInvoiceCategories = useMemo(() => {
    return (invoiceCategories ?? []).filter((c) => c.isActive);
  }, [invoiceCategories]);

  const requiresHeaderProject = useMemo(() => Boolean(selectedInvoiceCategory?.requiresProject), [selectedInvoiceCategory?.requiresProject]);
  const requiresHeaderFund = useMemo(() => Boolean(selectedInvoiceCategory?.requiresFund), [selectedInvoiceCategory?.requiresFund]);
  const requiresHeaderDepartment = useMemo(() => Boolean(selectedInvoiceCategory?.requiresDepartment), [selectedInvoiceCategory?.requiresDepartment]);

  const isLineValid = useMemo(() => {
    return (l: Line) => {
      const qty = Number(l.quantity);
      const unitPrice = Number(l.unitPrice);
      const desc = String(l.description ?? '').trim();
      return Boolean(l.accountId && desc && qty > 0 && unitPrice > 0);
    };
  }, []);

  const accountById = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a] as const));
  }, [accounts]);

  const hasAnyValidLine = useMemo(() => lines.some((l) => isLineValid(l)), [isLineValid, lines]);
  const allLinesValid = useMemo(() => lines.every((l) => isLineValid(l)), [isLineValid, lines]);
  const canAddLine = useMemo(() => {
    const last = lines[lines.length - 1];
    if (!last) return false;
    return isLineValid(last);
  }, [isLineValid, lines]);

  const computed = useMemo(() => {
    const grossTotals = lines.map((l) => {
      const qty = Number(l.quantity) || 0;
      const unitPrice = Number(l.unitPrice) || 0;
      return round2(qty * unitPrice);
    });

    const discountTotals = lines.map((l, idx) => {
      const gross = grossTotals[idx] || 0;
      const pct = Number(l.discountPercent) || 0;
      const amt = Number(l.discountAmount) || 0;
      if (pct > 0) return round2(gross * (pct / 100));
      if (amt > 0) return round2(amt);
      return 0;
    });

    const lineTotals = grossTotals.map((g, idx) => round2(g - (discountTotals[idx] || 0)));
    const grossSubtotal = round2(grossTotals.reduce((s, v) => s + v, 0));
    const discountTotal = round2(discountTotals.reduce((s, v) => s + v, 0));
    const subtotal = round2(lineTotals.reduce((s, v) => s + v, 0));
    const rateById = new Map((taxRates ?? []).map((t) => [t.id, Number(t.rate ?? 0)] as const));
    const lineTaxTotals = lines.map((l, idx) => {
      const net = Number(lineTotals[idx] ?? 0);
      const taxRateId = String((l as any).taxRateId ?? '').trim();
      const rate = taxRateId ? Number(rateById.get(taxRateId) ?? 0) : 0;
      return round2(net * (rate / 100));
    });
    const taxAmount = round2(lineTaxTotals.reduce((s, v) => s + (Number(v) || 0), 0));
    const totalAmount = round2(subtotal + taxAmount);
    const hasDiscount = discountTotal > 0;
    const isTaxable = lineTaxTotals.some((v) => Number(v) > 0) || lines.some((l: any) => Boolean(String(l.taxRateId ?? '').trim()));
    return { grossTotals, discountTotals, lineTotals, lineTaxTotals, grossSubtotal, discountTotal, subtotal, taxAmount, totalAmount, hasDiscount, isTaxable };
  }, [lines, taxRates]);

  const showDiscountUi = discountsEnabled || computed.hasDiscount;

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (!last || !isLineValid(last)) return prev;
      return [
        ...prev,
        {
          accountId: '',
          accountSearch: '',
          accountPickerOpen: false,
          taxRateId: '',
          description: '',
          quantity: '1',
          unitPrice: '',
          discountPercent: '',
          discountAmount: '',
        },
      ];
    });
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    if (!customerId || !invoiceDate || !dueDate || !currency) {
      setError('Missing required fields');
      return;
    }

    if (!invoiceCategoryId) {
      setError('Invoice category is required');
      return;
    }

    if (!selectedInvoiceCategory || !selectedInvoiceCategory.isActive) {
      setError('Selected invoice category is inactive. Please choose an active category.');
      return;
    }

    if (requiresHeaderProject && !headerProjectId) {
      setError('Project is required for this invoice category');
      return;
    }

    if (requiresHeaderFund && !headerFundId) {
      setError('Fund is required for this invoice category');
      return;
    }

    if (requiresHeaderDepartment && !headerDepartmentId) {
      setError('Department is required for this invoice category');
      return;
    }

    if (new Date(dueDate) < new Date(invoiceDate)) {
      setError('Due date cannot be earlier than invoice date');
      return;
    }

    if (exchangeRateInvalid) {
      setError('Exchange rate is required when invoice currency differs from base currency');
      return;
    }

    if (!hasAnyValidLine) {
      setError('Invoice must have at least 1 valid line');
      return;
    }

    if (!allLinesValid) {
      setError('Each line requires revenue account, description, quantity and unit price');
      return;
    }

    for (const l of lines) {
      const pct = Number(l.discountPercent) || 0;
      const amt = Number(l.discountAmount) || 0;
      if (pct > 0 && amt > 0) {
        setError('Discount percent and discount amount are mutually exclusive per line');
        return;
      }
      if (pct < 0 || pct > 100) {
        setError('Discount percent must be between 0 and 100');
        return;
      }
      if (amt < 0) {
        setError('Discount amount must be >= 0');
        return;
      }

      const qty = Number(l.quantity) || 0;
      const unitPrice = Number(l.unitPrice) || 0;
      const gross = round2(qty * unitPrice);
      const discountTotal = pct > 0 ? round2(gross * (pct / 100)) : amt > 0 ? round2(amt) : 0;
      if (discountTotal > gross) {
        setError('Discount cannot exceed gross line amount');
        return;
      }
    }

    setSaving(true);
    try {
      const created = await createInvoice({
        customerId,
        invoiceDate,
        dueDate,
        currency: currency.trim(),
        exchangeRate: isBaseCurrency ? 1 : Number(exchangeRate),
        reference: reference.trim() || undefined,
        invoiceNote: invoiceNote.trim() || undefined,
        invoiceCategoryId: invoiceCategoryId || undefined,
        projectId: headerProjectId || undefined,
        fundId: headerFundId || undefined,
        departmentId: headerDepartmentId || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          taxRateId: String((l as any).taxRateId ?? '').trim() || undefined,
          departmentId: l.departmentId || undefined,
          projectId: (l.projectId || headerProjectId) || undefined,
          fundId: l.fundId || undefined,
          description: String(l.description ?? '').trim(),
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          discountPercent: showDiscountUi ? Number(l.discountPercent) || undefined : undefined,
          discountAmount: showDiscountUi ? Number(l.discountAmount) || undefined : undefined,
        })),
      });

      navigate(`/finance/ar/invoices/${created.id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create invoice';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Create Customer Invoice</h2>

      {!canCreate ? <div style={{ color: 'crimson' }}>You do not have permission to create invoices.</div> : null}

      {loadingLookups ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
        <label>
          Customer
          <div style={{ position: 'relative' }}>
            <input
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerId('');
                setCustomerPickerOpen(true);
              }}
              onFocus={() => setCustomerPickerOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setCustomerPickerOpen(false), 150);
              }}
              placeholder="Search by customer name or code..."
              style={{ width: '100%' }}
              required
            />
            {customerPickerOpen ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid rgba(11,12,30,0.15)',
                  borderRadius: 10,
                  boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                  maxHeight: 260,
                  overflowY: 'auto',
                  zIndex: 10,
                }}
              >
                {filteredCustomers.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 13, color: '#666' }}>No matches</div>
                ) : (
                  filteredCustomers.slice(0, 50).map((c) => {
                    const code = String(c.customerCode ?? '').trim();
                    const label = code ? `${code} - ${c.name}` : c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCustomerId(c.id);
                          setCustomerSearch(label);
                          setCustomerPickerOpen(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{label}</div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={showDiscountUi}
            onChange={(e) => setDiscountsEnabled(e.target.checked)}
          />
          Add discount fields
        </label>

        <label>
          Invoice Number
          <input value="(auto-generated)" readOnly style={{ width: '100%' }} />
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Invoice Date
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Due Date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Invoice Category
            <select
              value={invoiceCategoryId}
              onChange={(e) => {
                const v = String(e.target.value || '');
                setInvoiceCategoryId(v);

                const next = invoiceCategories.find((c) => c.id === v) ?? null;
                if (!next?.requiresProject) setHeaderProjectId('');
                if (!next?.requiresFund) setHeaderFundId('');
                if (!next?.requiresDepartment) setHeaderDepartmentId('');
              }}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select...</option>
              {selectableInvoiceCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </label>

          {requiresHeaderProject ? (
            <label style={{ flex: 1 }}>
              Project
              <select
                value={headerProjectId}
                onChange={(e) => setHeaderProjectId(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">Select...</option>
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
        </div>

        {(requiresHeaderFund || requiresHeaderDepartment) ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {requiresHeaderFund ? (
              <label style={{ flex: 1 }}>
                Fund
                <select
                  value={headerFundId}
                  onChange={(e) => setHeaderFundId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select...</option>
                  {(headerProjectId ? funds.filter((f) => f.projectId === headerProjectId) : funds).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} - {f.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {requiresHeaderDepartment ? (
              <label style={{ flex: 1 }}>
                Department
                <select
                  value={headerDepartmentId}
                  onChange={(e) => setHeaderDepartmentId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Currency
            <select value={normalizedCurrency} onChange={(e) => setCurrency(e.target.value)} required style={{ width: '100%' }}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Exchange Rate {normalizedBase ? `(base: ${normalizedBase})` : ''}
            <input
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              required={!isBaseCurrency}
              disabled={isBaseCurrency}
              inputMode="decimal"
              style={{ width: '100%' }}
            />
            {exchangeRateError ? <div style={{ marginTop: 4, fontSize: 12, color: 'crimson' }}>{exchangeRateError}</div> : null}
          </label>
          <label style={{ flex: 2 }}>
            Reference (optional)
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. PO#123" style={{ width: '100%' }} />
          </label>
        </div>

        <label>
          Note (optional)
          <textarea
            value={invoiceNote}
            onChange={(e) => setInvoiceNote(e.target.value)}
            placeholder="Optional note to appear on the invoice PDF"
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>

        {selectedCustomer ? (
          <div style={{ border: '1px solid rgba(11,12,30,0.10)', borderRadius: 12, padding: 12, background: 'rgba(11,12,30,0.02)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer Snapshot (will be stored on invoice)</div>
            <div style={{ fontSize: 13 }}>
              <div>
                <b>Name:</b> {selectedCustomer.name}
              </div>
              <div>
                <b>Email:</b> {selectedCustomer.email ?? '-'}
              </div>
              <div>
                <b>Billing Address:</b>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#444', fontSize: 12 }}>{selectedCustomer.billingAddress ?? '-'}</div>
            </div>
          </div>
        ) : null}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Invoice Lines</div>
            <button type="button" onClick={addLine} disabled={!canAddLine}>
              Add line
            </button>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Tax</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
                {showDiscountUi ? <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Disc %</th> : null}
                {showDiscountUi ? <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Disc Amt</th> : null}
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Line Total</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const acct = l.accountId ? accountById.get(l.accountId) : null;
                const needsDept = Boolean(acct?.requiresDepartment);
                const needsProj = Boolean(acct?.requiresProject);
                const needsFund = Boolean(acct?.requiresFund);
                const fundOptions = l.projectId
                  ? funds.filter((f) => f.projectId === l.projectId)
                  : funds;

                const dimColSpan = showDiscountUi ? 9 : 7;

                return (
                  <Fragment key={`${idx}-block`}>
                    <tr key={`${idx}-main`}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        value={l.accountSearch}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLine(idx, { accountSearch: v, accountId: '' });
                        }}
                        onFocus={() => updateLine(idx, { accountPickerOpen: true })}
                        onBlur={() => {
                          window.setTimeout(() => updateLine(idx, { accountPickerOpen: false }), 150);
                        }}
                        placeholder="Search by account code or name..."
                        style={{ width: '100%' }}
                        required
                      />
                      {l.accountPickerOpen ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '100%',
                            marginTop: 4,
                            background: '#fff',
                            border: '1px solid rgba(11,12,30,0.15)',
                            borderRadius: 10,
                            boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                            maxHeight: 220,
                            overflowY: 'auto',
                            zIndex: 10,
                          }}
                        >
                          {(() => {
                            const q = String(l.accountSearch ?? '').trim().toLowerCase();
                            const list = !q
                              ? accounts
                              : accounts.filter((a) => {
                                  const code = String(a.code ?? '').toLowerCase();
                                  const name = String(a.name ?? '').toLowerCase();
                                  return code.includes(q) || name.includes(q);
                                });
                            if (list.length === 0) {
                              return <div style={{ padding: 10, fontSize: 13, color: '#666' }}>No matches</div>;
                            }
                            return list.slice(0, 50).map((a) => {
                              const label = `${a.code} - ${a.name}`;
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateLine(idx, { accountId: a.id, accountSearch: label, accountPickerOpen: false });
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>{label}</div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} required style={{ width: '100%' }} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <select
                      value={String((l as any).taxRateId ?? '')}
                      onChange={(e) => updateLine(idx, { taxRateId: e.currentTarget.value || undefined })}
                      style={{ width: '100%', height: 34 }}
                    >
                      <option value="">(None)</option>
                      {(taxRates ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} ({Number(t.rate ?? 0).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                      required
                      inputMode="decimal"
                      style={{ width: 90, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.unitPrice}
                      onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                      required
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                  {showDiscountUi ? (
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      <input
                        value={l.discountPercent}
                        onChange={(e) => {
                          updateLine(idx, { discountPercent: e.target.value, discountAmount: '' });
                        }}
                        inputMode="decimal"
                        style={{ width: 90, textAlign: 'right' }}
                        placeholder="%"
                        disabled={Boolean(Number(l.discountAmount) > 0)}
                      />
                    </td>
                  ) : null}
                  {showDiscountUi ? (
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      <input
                        value={l.discountAmount}
                        onChange={(e) => {
                          updateLine(idx, { discountAmount: e.target.value, discountPercent: '' });
                        }}
                        inputMode="decimal"
                        style={{ width: 110, textAlign: 'right' }}
                        placeholder="0.00"
                        disabled={Boolean(Number(l.discountPercent) > 0)}
                      />
                    </td>
                  ) : null}
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(computed.lineTotals[idx] ?? 0), currency)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      Remove
                    </button>
                  </td>
                    </tr>

                    <tr key={`${idx}-dims`}>
                      <td colSpan={dimColSpan} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                          <label style={{ fontSize: 12 }}>
                            Department{needsDept ? ' *' : ''}
                            <select
                              value={l.departmentId ?? ''}
                              onChange={(e) => updateLine(idx, { departmentId: e.currentTarget.value || undefined })}
                              style={{ width: '100%', height: 40, marginTop: 6 }}
                            >
                              <option value="">(None)</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.code} – {d.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={{ fontSize: 12 }}>
                            Project{needsProj ? ' *' : ''}
                            <select
                              value={l.projectId ?? ''}
                              onChange={(e) =>
                                updateLine(idx, {
                                  projectId: e.currentTarget.value || undefined,
                                  fundId: undefined,
                                })
                              }
                              style={{ width: '100%', height: 40, marginTop: 6 }}
                            >
                              <option value="">(None)</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} – {p.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={{ fontSize: 12 }}>
                            Fund{needsFund ? ' *' : ''}
                            <select
                              value={l.fundId ?? ''}
                              onChange={(e) => updateLine(idx, { fundId: e.currentTarget.value || undefined })}
                              style={{ width: '100%', height: 40, marginTop: 6 }}
                            >
                              <option value="">(None)</option>
                              {fundOptions.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.code} – {f.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            {computed.hasDiscount ? (
              <>
                <div>
                  Gross Subtotal: <b>{formatMoney(computed.grossSubtotal, currency)}</b>
                </div>
                <div>
                  Less: Discount: <b>{formatMoney(computed.discountTotal, currency)}</b>
                </div>
                <div>
                  Net Subtotal: <b>{formatMoney(computed.subtotal, currency)}</b>
                </div>
              </>
            ) : (
              <div>
                Subtotal: <b>{formatMoney(computed.subtotal, currency)}</b>
              </div>
            )}
            <div>
              Tax: <b>{formatMoney(computed.taxAmount, currency)}</b>
            </div>
            <div>
              Total: <b>{formatMoney(computed.totalAmount, currency)}</b>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loadingLookups || exchangeRateInvalid || !hasAnyValidLine || !allLinesValid}>
            {saving ? 'Creating...' : 'Create (DRAFT)'}
          </button>
          <button type="button" onClick={() => navigate('/finance/ar/invoices')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
