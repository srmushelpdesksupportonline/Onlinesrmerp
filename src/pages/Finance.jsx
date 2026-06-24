import { useState, useEffect, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
  fetchFinanceRecords,
  fetchPaymentHistory,
  fetchFinanceSummary,
  fetchRevenueByMonth,
  fetchOutstandingByProgram,
  fetchScholarshipSummary,
  fetchPaymentMethodBreakdown,
  recordPayment,
  formatINR,
  PAYMENT_PLAN_LABELS,
  PAYMENT_STATUS_COLORS,
} from '../services/financeService';

ModuleRegistry.registerModules([AllCommunityModule]);

const STORAGE_KEY = 'financePageColumns';
const TABS = ['Finance Records', 'Reports'];

// ── All available columns grouped by section ─────────────────────────────────
const ALL_COLUMNS = [
  // Student Info
  { field: 'enrollment_no',      label: 'Enrollment No',       group: 'Student Info', alwaysVisible: true },
  { field: 'full_name',          label: 'Name',                group: 'Student Info', alwaysVisible: true },
  { field: 'application_no',     label: 'Application No',      group: 'Student Info' },
  { field: 'program_code',       label: 'Program',             group: 'Student Info' },
  { field: 'program_name',       label: 'Program Name',        group: 'Student Info' },
  { field: 'specialization',     label: 'Specialization',      group: 'Student Info' },
  { field: 'intake',             label: 'Intake',              group: 'Student Info' },
  { field: 'academic_year',      label: 'Academic Year',       group: 'Student Info' },
  { field: 'mobile',             label: 'Mobile',              group: 'Student Info' },
  { field: 'official_email',     label: 'Official Email',      group: 'Student Info' },
  { field: 'personal_email',     label: 'Personal Email',      group: 'Student Info' },
  // Fee Structure
  { field: 'full_program_fee',   label: 'Gross Fee',           group: 'Fee Structure' },
  { field: 'net_fee',            label: 'Net Fee',             group: 'Fee Structure' },
  { field: 'semester_fee',       label: 'Semester Fee',        group: 'Fee Structure' },
  { field: 'annual_fee',         label: 'Annual Fee',          group: 'Fee Structure' },
  { field: 'total_semesters',    label: 'Total Semesters',     group: 'Fee Structure' },
  // Scholarship & Discount
  { field: 'scholarship_code',   label: 'Scholarship',         group: 'Scholarship & Discount' },
  { field: 'scholarship_name',   label: 'Scholarship Name',    group: 'Scholarship & Discount' },
  { field: 'scholarship_pct',    label: 'Scholarship %',       group: 'Scholarship & Discount' },
  { field: 'scholarship_amount', label: 'Scholarship Amt',     group: 'Scholarship & Discount' },
  { field: 'discount_type',      label: 'Discount Type',       group: 'Scholarship & Discount' },
  { field: 'discount_pct',       label: 'Discount %',          group: 'Scholarship & Discount' },
  { field: 'discount_amount',    label: 'Discount Amt',        group: 'Scholarship & Discount' },
  // Payment
  { field: 'payment_plan',       label: 'Payment Plan',        group: 'Payment' },
  { field: 'emi_partner',        label: 'EMI Partner',         group: 'Payment' },
  { field: 'emi_tenure_months',  label: 'EMI Tenure (Months)', group: 'Payment' },
  { field: 'emi_monthly_amount', label: 'EMI Monthly Amt',     group: 'Payment' },
  { field: 'payment_status',     label: 'Status',              group: 'Payment' },
  { field: 'pre_admission_paid', label: 'Pre-Adm Paid',        group: 'Payment' },
  { field: 'merritto_paid',      label: 'Merritto Paid',       group: 'Payment' },
  { field: 'total_paid',         label: 'Total Paid',          group: 'Payment' },
  { field: 'balance_due',        label: 'Balance Due',         group: 'Payment' },
  { field: 'last_payment_date',  label: 'Last Payment Date',   group: 'Payment' },
  { field: 'next_due_date',      label: 'Next Due Date',       group: 'Payment' },
  { field: 'fee_setup_date',     label: 'Fee Setup Date',      group: 'Payment' },
  { field: 'notes',              label: 'Notes',               group: 'Payment' },
  // Merritto Token Fee (from student raw_data via join)
  { field: '__raw__Token Fee Amount',            label: 'Token Fee Amount',          group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Token Fee Name',              label: 'Token Fee Name',            group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Token Fee Transcation ID',    label: 'Token Fee Transaction ID',  group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Token Fee Method',            label: 'Token Fee Method',          group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Token Fee Date',              label: 'Token Fee Date',            group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Token Fee Order ID',          label: 'Token Fee Order ID',        group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Payment Status',              label: 'Payment Status (Merritto)', group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Payment Amount',              label: 'Payment Amount (Merritto)', group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__What Are You Willing To Pay', label: 'Willing To Pay',            group: 'Merritto Token Fee', isRaw: true },
  { field: '__raw__Payment Method',              label: 'Payment Method (Merritto)', group: 'Merritto Token Fee', isRaw: true },
];

const DEFAULT_VISIBLE = [
  'enrollment_no','full_name','program_code','intake','payment_plan',
  'scholarship_code','full_program_fee','scholarship_amount','discount_amount',
  'net_fee','pre_admission_paid','merritto_paid','total_paid','balance_due',
  'payment_status','mobile','official_email',
];

function loadVisibleCols() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_VISIBLE;
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ value }) {
  const colors = PAYMENT_STATUS_COLORS[value] || { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ background: colors.bg, color: colors.text, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }}>
      {value || '—'}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color || '#6366F1'}` }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Simple Bar Chart ──────────────────────────────────────────────────────────
function SimpleBar({ data, keyX, keyY, color, formatY }) {
  if (!data || data.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>No data</div>;
  const max = Math.max(...data.map(d => d[keyY]));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, overflowX: 'auto' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
          <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>{formatY ? formatY(d[keyY]) : d[keyY]}</div>
          <div style={{ width: 32, height: max > 0 ? `${Math.round((d[keyY] / max) * 90)}px` : '4px', background: color || '#6366F1', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
          <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>{d[keyX]}</div>
        </div>
      ))}
    </div>
  );
}

// ── Customize Columns Panel ───────────────────────────────────────────────────
function CustomisePanel({ visible, onApply, onClose }) {
  const [selected, setSelected] = useState([...visible]);
  const [search,   setSearch]   = useState('');

  const toggle = (field) => {
    const col = ALL_COLUMNS.find(c => c.field === field);
    if (col?.alwaysVisible) return;
    setSelected(s => s.includes(field) ? s.filter(f => f !== field) : [...s, field]);
  };

  const filtered = ALL_COLUMNS.filter(c =>
    !search || c.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={onClose}>
      <div
        style={{ position: 'absolute', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Customize Columns</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left — all columns */}
          <div style={{ flex: 1, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
              <input
                placeholder="🔍  Search column…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {(() => {
                const groups = {};
                filtered.forEach(col => {
                  const g = col.group || 'Other';
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(col);
                });
                return Object.entries(groups).map(([group, cols]) => (
                  <div key={group}>
                    <div style={{ padding: '7px 14px 3px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, background: '#F9FAFB' }}>
                      {group}
                    </div>
                    {cols.map(col => (
                      <div
                        key={col.field}
                        onClick={() => toggle(col.field)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: col.alwaysVisible ? 'default' : 'pointer', borderBottom: '1px solid #F9FAFB' }}
                        onMouseEnter={e => { if (!col.alwaysVisible) e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(col.field)}
                          onChange={() => toggle(col.field)}
                          disabled={col.alwaysVisible}
                          style={{ accentColor: '#6366F1', width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 13, color: col.alwaysVisible ? '#9CA3AF' : '#374151' }}>
                          {col.label}
                          {col.alwaysVisible && <span style={{ fontSize: 10, marginLeft: 6, color: '#9CA3AF' }}>(fixed)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Right — selected */}
          <div style={{ width: 190, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
              SELECTED ({selected.length})
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {selected.map(field => {
                const col = ALL_COLUMNS.find(c => c.field === field);
                if (!col) return null;
                return (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #F9FAFB', fontSize: 13 }}>
                    <span style={{ color: '#374151' }}>{col.label}</span>
                    {!col.alwaysVisible && (
                      <button onClick={() => toggle(field)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid #E5E7EB', justifyContent: 'space-between' }}>
          <button onClick={() => setSelected(DEFAULT_VISIBLE)} style={{ background: '#fff', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>↺ Reset</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button
              onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); onApply(selected); onClose(); }}
              style={{ background: '#6366F1', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────
function RecordPaymentModal({ financeRow, onClose, onDone }) {
  const [form, setForm] = useState({
    amount: '', paymentMethod: 'ORANGEPAY',
    paymentDate: new Date().toISOString().split('T')[0],
    transactionRef: '', paymentFor: '', receiptNo: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      setError('Enter a valid amount.'); return;
    }
    setSaving(true); setError('');
    try {
      await recordPayment({
        financeId: financeRow.id, enrollmentNo: financeRow.enrollment_no,
        amount: parseFloat(form.amount), paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate, transactionRef: form.transactionRef || null,
        paymentFor: form.paymentFor || null, receiptNo: form.receiptNo || null, notes: form.notes || null,
      });
      onDone();
    } catch (e) { setError(e.message || 'Failed'); } finally { setSaving(false); }
  }

  const planOptions = { SEMESTER: ['SEM_1','SEM_2','SEM_3','SEM_4','SEM_5','SEM_6'], ANNUAL: ['ANNUAL_1','ANNUAL_2','ANNUAL_3'], FULL: ['FULL'], EMI: ['EMI'] };
  const forOptions = planOptions[financeRow.payment_plan] || [];

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 480 }}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0 }}>Record Payment</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>{financeRow.full_name}</strong> · {financeRow.enrollment_no}<br />
          Balance Due: <strong style={{ color: '#DC2626' }}>{formatINR(financeRow.balance_due)}</strong>
          &nbsp;|&nbsp; Plan: {PAYMENT_PLAN_LABELS[financeRow.payment_plan] || financeRow.payment_plan}
        </div>
        {[
          { label: 'Amount (₹)', key: 'amount', type: 'number', placeholder: '0' },
          { label: 'Payment Date', key: 'paymentDate', type: 'date' },
          { label: 'Transaction Ref / OrangePay ID', key: 'transactionRef', type: 'text', placeholder: 'Optional' },
          { label: 'Receipt No', key: 'receiptNo', type: 'text', placeholder: 'Optional' },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key} style={S.formGroup}>
            <label style={S.label}>{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={S.input} />
          </div>
        ))}
        <div style={S.formGroup}>
          <label style={S.label}>Payment Method</label>
          <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} style={S.input}>
            <option value="ORANGEPAY">OrangePay (ICICI)</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="GRAYQUEST_EMI">Grayquest EMI</option>
            <option value="ONLINE">Online</option>
          </select>
        </div>
        {forOptions.length > 0 && (
          <div style={S.formGroup}>
            <label style={S.label}>Payment For</label>
            <select value={form.paymentFor} onChange={e => set('paymentFor', e.target.value)} style={S.input}>
              <option value="">— Select —</option>
              {forOptions.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
        <div style={S.formGroup}>
          <label style={S.label}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="Optional" />
        </div>
        {error && <div style={S.errorBox}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Payment History Modal ─────────────────────────────────────────────────────
function PaymentHistoryModal({ financeRow, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentHistory(financeRow.id).then(setHistory).finally(() => setLoading(false));
  }, [financeRow.id]);

  const sourceLabel = { PRE_ADMISSION: 'Pre-Admission', MERRITTO: 'Merritto', ERP: 'ERP' };
  const srcColor = (s) => ({
    PRE_ADMISSION: { bg: '#FEF9C3', text: '#854D0E' },
    MERRITTO:      { bg: '#EFF6FF', text: '#1E40AF' },
    ERP:           { bg: '#F0FDF4', text: '#166534' },
  }[s] || { bg: '#F3F4F6', text: '#374151' });

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 720 }}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0 }}>Payment History — {financeRow.full_name}</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 14, fontSize: 13 }}>
          <span>Net Fee: <strong>{formatINR(financeRow.net_fee)}</strong></span>
          <span>Total Paid: <strong style={{ color: '#16A34A' }}>{formatINR(financeRow.total_paid)}</strong></span>
          <span>Balance: <strong style={{ color: '#DC2626' }}>{formatINR(financeRow.balance_due)}</strong></span>
        </div>
        {loading ? <div style={{ color: '#9CA3AF', padding: 20, textAlign: 'center' }}>Loading…</div>
        : history.length === 0 ? <div style={{ color: '#9CA3AF', padding: 20, textAlign: 'center' }}>No transactions found.</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, userSelect: 'text' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date','Source','For','Method','Ref / Txn ID','Amount','Status'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(t => {
                const sc = srcColor(t.payment_source);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={S.td}>{t.payment_date}</td>
                    <td style={S.td}><span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{sourceLabel[t.payment_source] || t.payment_source}</span></td>
                    <td style={S.td}>{t.payment_for || '—'}</td>
                    <td style={S.td}>{t.payment_method || '—'}</td>
                    <td style={{ ...S.td, userSelect: 'text', cursor: 'text' }}>{t.transaction_ref || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#166534' }}>{formatINR(t.amount)}</td>
                    <td style={S.td}>{t.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={S.outlineBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function Finance() {
  const [tab,     setTab]     = useState('Finance Records');
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterIntake,  setFilterIntake]  = useState('');
  const [searchText,    setSearchText]    = useState('');
  const [showSearch,    setShowSearch]    = useState(false);

  const [showPayment,  setShowPayment]  = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);
  const [showCustomise,setShowCustomise]= useState(false);
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [visibleCols,  setVisibleCols]  = useState(loadVisibleCols);

  const [reportRevenue,     setReportRevenue]     = useState([]);
  const [reportOutstanding, setReportOutstanding] = useState([]);
  const [reportScholarship, setReportScholarship] = useState([]);
  const [reportMethods,     setReportMethods]     = useState([]);

  const gridRef = useRef();

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, sum] = await Promise.all([
        fetchFinanceRecords({ program_code: filterProgram || undefined, payment_status: filterStatus || undefined, intake: filterIntake || undefined }),
        fetchFinanceSummary(),
      ]);
      setRecords(recs);
      setSummary(sum);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterProgram, filterStatus, filterIntake]);

  const loadReports = useCallback(async () => {
    try {
      const [rev, out, sch, meth] = await Promise.all([fetchRevenueByMonth(), fetchOutstandingByProgram(), fetchScholarshipSummary(), fetchPaymentMethodBreakdown()]);
      setReportRevenue(rev); setReportOutstanding(out); setReportScholarship(sch); setReportMethods(meth);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { if (tab === 'Reports') loadReports(); }, [tab, loadReports]);

  function openPayment(row) { setSelectedRow(row); setShowPayment(true); }
  function openHistory(row) { setSelectedRow(row); setShowHistory(true); }

  // Build column defs from visibleCols
  const buildColDef = (field) => {
    const INR = v => formatINR(v);
    const map = {
      enrollment_no:      { headerName: 'Enrollment No',    minWidth: 140, flex: 1, maxWidth: 170, pinned: 'left', cellStyle: { userSelect: 'text', cursor: 'text', fontWeight: 600 } },
      full_name:          { headerName: 'Name',             minWidth: 150, flex: 1, maxWidth: 210, pinned: 'left', cellStyle: { userSelect: 'text', cursor: 'text' } },
      application_no:     { headerName: 'Application No',   minWidth: 130, flex: 1, maxWidth: 170, cellStyle: { userSelect: 'text', cursor: 'text' } },
      program_code:       { headerName: 'Program',          minWidth: 80,  width: 90 },
      program_name:       { headerName: 'Program Name',     minWidth: 180, flex: 1 },
      intake:             { headerName: 'Intake',           minWidth: 80,  width: 90 },
      academic_year:      { headerName: 'Academic Year',    minWidth: 100, width: 115 },
      payment_plan:       { headerName: 'Payment Plan',     minWidth: 120, width: 135, valueFormatter: p => PAYMENT_PLAN_LABELS[p.value] || p.value || '—' },
      emi_partner:        { headerName: 'EMI Partner',      minWidth: 110, width: 120, valueFormatter: p => p.value || '—' },
      scholarship_code:   { headerName: 'Scholarship',      minWidth: 110, width: 120, valueFormatter: p => p.value || '—' },
      scholarship_pct:    { headerName: 'Scholar %',        minWidth: 90,  width: 100, valueFormatter: p => p.value ? `${p.value}%` : '—' },
      scholarship_amount: { headerName: 'Scholar Amt',      minWidth: 110, width: 120, valueFormatter: p => p.value > 0 ? `−${INR(p.value)}` : '—' },
      discount_type:      { headerName: 'Discount Type',    minWidth: 110, width: 120, valueFormatter: p => p.value || '—' },
      discount_pct:       { headerName: 'Discount %',       minWidth: 90,  width: 100, valueFormatter: p => p.value ? `${p.value}%` : '—' },
      discount_amount:    { headerName: 'Discount Amt',     minWidth: 110, width: 120, valueFormatter: p => p.value > 0 ? `−${INR(p.value)}` : '—' },
      full_program_fee:   { headerName: 'Gross Fee',        minWidth: 110, width: 120, valueFormatter: p => INR(p.value) },
      net_fee:            { headerName: 'Net Fee',          minWidth: 110, width: 120, valueFormatter: p => INR(p.value), cellStyle: { fontWeight: 700 } },
      pre_admission_paid: { headerName: 'Pre-Adm Paid',     minWidth: 110, width: 120, valueFormatter: p => INR(p.value) },
      merritto_paid:      { headerName: 'Merritto Paid',    minWidth: 110, width: 120, valueFormatter: p => INR(p.value) },
      total_paid:         { headerName: 'Total Paid',       minWidth: 110, width: 120, valueFormatter: p => INR(p.value), cellStyle: { color: '#166534', fontWeight: 600 } },
      balance_due:        { headerName: 'Balance Due',      minWidth: 110, width: 120, valueFormatter: p => INR(p.value), cellStyle: p => ({ color: parseFloat(p.value) > 0 ? '#DC2626' : '#166534', fontWeight: 600 }) },
      payment_status:     { headerName: 'Status',           minWidth: 100, width: 115, cellRenderer: p => <StatusBadge value={p.value} /> },
      mobile:             { headerName: 'Mobile',           minWidth: 130, width: 145, cellStyle: { userSelect: 'text', cursor: 'text' } },
      official_email:     { headerName: 'Official Email',   minWidth: 210, flex: 2,    cellStyle: { userSelect: 'text', cursor: 'text' } },
      personal_email:     { headerName: 'Personal Email',   minWidth: 200, flex: 2,    cellStyle: { userSelect: 'text', cursor: 'text' } },
      specialization:     { headerName: 'Specialization',   minWidth: 160, flex: 1 },
      fee_setup_date:     { headerName: 'Setup Date',       minWidth: 110, width: 120 },
      next_due_date:      { headerName: 'Next Due',         minWidth: 110, width: 120 },
      last_payment_date:  { headerName: 'Last Payment',     minWidth: 120, width: 130 },
      notes:              { headerName: 'Notes',            minWidth: 160, flex: 1 },
    };
    // Raw data fields (from student_master.raw_data via join)
    if (field.startsWith('__raw__')) {
      const rawKey = field.replace('__raw__', '');
      const colDef = ALL_COLUMNS.find(c => c.field === field);
      return {
        headerName:  colDef?.label || rawKey,
        field,
        minWidth:    130,
        flex:        1,
        cellStyle:   { userSelect: 'text', cursor: 'text' },
        valueGetter: p => p.data?.student_master?.raw_data?.[rawKey] ?? p.data?.raw_data?.[rawKey] ?? '',
      };
    }

    return { field, ...(map[field] || { headerName: field, width: 130 }) };
  };

  const columnDefs = [
    ...visibleCols.map(buildColDef),
    {
      headerName: 'Actions', width: 160, pinned: 'right', sortable: false, filter: false,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
          <button onClick={() => openPayment(p.data)} style={{ ...S.actionBtn, background: '#6366F1', color: '#fff' }}>+ Pay</button>
          <button onClick={() => openHistory(p.data)} style={{ ...S.actionBtn, background: '#F3F4F6', color: '#374151' }}>History</button>
        </div>
      ),
    },
  ];

  const filteredRecords = records.filter(r => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return r.full_name?.toLowerCase().includes(q) || r.enrollment_no?.toLowerCase().includes(q) || r.official_email?.toLowerCase().includes(q) || r.mobile?.includes(q);
  });

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Finance</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Fee management, payments & reports</div>
        </div>
        {/* Toolbar icons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {showSearch && (
            <input
              autoFocus
              placeholder="Search name / enrollment / mobile…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ ...S.input, width: 260, margin: 0 }}
            />
          )}
          <button onClick={() => setShowSearch(s => !s)} style={S.iconBtn} title="Search">🔍</button>
          <button onClick={() => setShowCustomise(true)} style={S.iconBtn} title="Customize Columns">⊞</button>
          <button onClick={loadRecords} style={S.iconBtn} title="Refresh">↻</button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard label="Total Students"    value={summary.total_students}              color="#6366F1" />
          <KpiCard label="Total Net Fee"     value={formatINR(summary.total_net_fee)}    color="#0EA5E9" />
          <KpiCard label="Total Collected"   value={formatINR(summary.total_collected)}  color="#10B981"
            sub={`${summary.completed_count} fully paid · ${summary.partial_count} partial`} />
          <KpiCard label="Total Outstanding" value={formatINR(summary.total_outstanding)} color="#F59E0B"
            sub={`${summary.pending_count} pending · ${summary.partial_count} partial`} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #6366F1' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#6366F1' : '#6B7280',
            fontWeight: tab === t ? 700 : 400, cursor: 'pointer', fontSize: 14,
          }}>{t}</button>
        ))}
      </div>

      {/* ── FINANCE RECORDS TAB ── */}
      {tab === 'Finance Records' && (
        <>
          {/* Filter row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ ...S.input, width: 140, margin: 0 }}>
              <option value="">All Programs</option>
              {['MBA','MCA','BBA','BCA'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: 150, margin: 0 }}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select value={filterIntake} onChange={e => setFilterIntake(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
              <option value="">All Intakes</option>
              <option value="JAN">January</option>
              <option value="JUL">July</option>
            </select>
            <button onClick={loadRecords} style={S.outlineBtn}>Apply</button>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid */}
          <div style={{ height: 540 }}>
            <AgGridReact
              ref={gridRef}
              theme={themeQuartz.withParams({
                fontSize: '12px',
                rowHeight: 36,
                headerHeight: 38,
              })}
              rowData={filteredRecords}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
              pagination
              paginationPageSize={25}
              rowHeight={36}
              headerHeight={38}
              loading={loading}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              onGridReady={params => params.api.sizeColumnsToFit()}
              onFirstDataRendered={params => params.api.sizeColumnsToFit()}
            />
          </div>
        </>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'Reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={S.reportCard}>
            <div style={S.reportTitle}>Revenue by Month</div>
            <SimpleBar data={reportRevenue} keyX="month" keyY="total" color="#6366F1" formatY={v => `₹${(v/1000).toFixed(0)}K`} />
          </div>
          <div style={S.reportCard}>
            <div style={S.reportTitle}>Outstanding Dues by Program</div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>{['Program','Students','Outstanding'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>)}</tr></thead>
              <tbody>
                {reportOutstanding.length === 0
                  ? <tr><td colSpan={3} style={{ color: '#9CA3AF', padding: 12 }}>No data</td></tr>
                  : reportOutstanding.map(r => (
                    <tr key={r.program_code} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={S.td}><strong>{r.program_code}</strong></td>
                      <td style={S.td}>{r.student_count}</td>
                      <td style={{ ...S.td, color: '#DC2626', fontWeight: 600 }}>{formatINR(r.total_outstanding)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={S.reportCard}>
            <div style={S.reportTitle}>Scholarship Disbursements</div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>{['Type','%','Students','Total Discount'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>)}</tr></thead>
              <tbody>
                {reportScholarship.length === 0
                  ? <tr><td colSpan={4} style={{ color: '#9CA3AF', padding: 12 }}>No scholarships applied</td></tr>
                  : reportScholarship.map(r => (
                    <tr key={r.scholarship_code} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={S.td}>{r.scholarship_code}</td>
                      <td style={S.td}>{r.scholarship_pct}%</td>
                      <td style={S.td}>{r.student_count}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{formatINR(r.total_discount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={S.reportCard}>
            <div style={S.reportTitle}>Payment Method Breakdown</div>
            <SimpleBar data={reportMethods} keyX="method" keyY="total" color="#10B981" formatY={v => `₹${(v/1000).toFixed(0)}K`} />
          </div>
        </div>
      )}

      {/* ── MODALS & PANELS ── */}
      {showCustomise && (
        <CustomisePanel
          visible={visibleCols}
          onApply={setVisibleCols}
          onClose={() => setShowCustomise(false)}
        />
      )}
      {showPayment && selectedRow && (
        <RecordPaymentModal financeRow={selectedRow} onClose={() => setShowPayment(false)} onDone={() => { setShowPayment(false); loadRecords(); }} />
      )}
      {showHistory && selectedRow && (
        <PaymentHistoryModal financeRow={selectedRow} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: 14, padding: 28, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' },
  input:       { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  formGroup:   { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  label:       { fontSize: 12, fontWeight: 600, color: '#374151' },
  primaryBtn:  { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn:  { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  iconBtn:     { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, color: '#374151' },
  actionBtn:   { padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  reportCard:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 },
  reportTitle: { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 },
  td:          { padding: '7px 8px', color: '#374151' },
};
