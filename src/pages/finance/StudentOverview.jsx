import { useState, useEffect, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
  fetchStudentOverview, formatINR, PROGRAM_CODES, fetchBatchOptions, STATUS_COLORS,
  fetchPaymentHistory, recordPayment,
  PAYMENT_PLAN_LABELS, PAYMENT_STATUS_COLORS,
} from '../../services/financeManagementService';

ModuleRegistry.registerModules([AllCommunityModule]);

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  mHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 12 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  iconBtn:    { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, color: '#374151' },
  actionBtn:  { padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  td:         { padding: '8px 10px', color: '#374151' },
};

function StatusBadge({ value }) {
  const colors = PAYMENT_STATUS_COLORS[value] || { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ background: colors.bg, color: colors.text, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }}>
      {value || '—'}
    </span>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color || '#6366F1'}` }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Semester Fees Panel ───────────────────────────────────────────────────────
function SemesterFeesPanel({ semesterFees }) {
  if (!semesterFees || semesterFees.length === 0)
    return <div style={{ color: '#9CA3AF', fontSize: 12 }}>No semester fee records.</div>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
      <thead>
        <tr style={{ background: '#F9FAFB' }}>
          {['Block', 'Semester', 'Total', 'Paid', 'Status'].map(h => (
            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semesterFees.map((sf, i) => {
          const sc = STATUS_COLORS[sf.status] || { bg: '#F3F4F6', text: '#6B7280' };
          return (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={S.td}>{sf.fee_blocks?.block_name || '—'}</td>
              <td style={S.td}>{sf.semester ? `Sem ${sf.semester}` : '—'}</td>
              <td style={{ ...S.td, fontWeight: 600 }}>{formatINR(sf.total_amount)}</td>
              <td style={{ ...S.td, color: '#166534', fontWeight: 600 }}>{formatINR(sf.paid_amount)}</td>
              <td style={S.td}>
                <span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                  {sf.status}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
        paymentFor: form.paymentFor || null, receiptNo: form.receiptNo || null,
        notes: form.notes || null,
      });
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const planOptions = {
    SEMESTER: ['SEM_1','SEM_2','SEM_3','SEM_4','SEM_5','SEM_6'],
    ANNUAL:   ['ANNUAL_1','ANNUAL_2','ANNUAL_3'],
    FULL:     ['FULL'],
    EMI:      ['EMI'],
  };
  const forOptions = planOptions[financeRow.payment_plan] || [];

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 480 }}>
        <div style={S.mHead}>
          <h3 style={{ margin: 0 }}>Record Payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>{financeRow.full_name}</strong> · {financeRow.enrollment_no}<br />
          Balance Due: <strong style={{ color: '#DC2626' }}>{formatINR(financeRow.balance_due)}</strong>
          &nbsp;|&nbsp; Plan: {PAYMENT_PLAN_LABELS[financeRow.payment_plan] || financeRow.payment_plan}
        </div>
        {[
          { label: 'Amount (₹)',                   key: 'amount',         type: 'number', placeholder: '0'        },
          { label: 'Payment Date',                  key: 'paymentDate',    type: 'date'                            },
          { label: 'Transaction Ref / OrangePay ID',key: 'transactionRef', type: 'text',   placeholder: 'Optional' },
          { label: 'Receipt No',                    key: 'receiptNo',      type: 'text',   placeholder: 'Optional' },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key} style={S.fGroup}>
            <label style={S.label}>{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={S.input} />
          </div>
        ))}
        <div style={S.fGroup}>
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
          <div style={S.fGroup}>
            <label style={S.label}>Payment For</label>
            <select value={form.paymentFor} onChange={e => set('paymentFor', e.target.value)} style={S.input}>
              <option value="">— Select —</option>
              {forOptions.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
        <div style={S.fGroup}>
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
  const srcColor = s => ({
    PRE_ADMISSION: { bg: '#FEF9C3', text: '#854D0E' },
    MERRITTO:      { bg: '#EFF6FF', text: '#1E40AF' },
    ERP:           { bg: '#F0FDF4', text: '#166534' },
  }[s] || { bg: '#F3F4F6', text: '#374151' });

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 800 }}>
        <div style={S.mHead}>
          <div>
            <h3 style={{ margin: 0 }}>Payment History — {financeRow.full_name}</h3>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{financeRow.enrollment_no} · {financeRow.program_code}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        {/* Fee summary */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13, background: '#F9FAFB', padding: '12px 16px', borderRadius: 8 }}>
          <span>Gross: <strong>{formatINR(financeRow.full_program_fee)}</strong></span>
          <span>Net Fee: <strong>{formatINR(financeRow.net_fee)}</strong></span>
          <span>Total Paid: <strong style={{ color: '#16A34A' }}>{formatINR(financeRow.total_paid)}</strong></span>
          <span>Balance: <strong style={{ color: '#DC2626' }}>{formatINR(financeRow.balance_due)}</strong></span>
          <span>Plan: <strong>{PAYMENT_PLAN_LABELS[financeRow.payment_plan] || financeRow.payment_plan}</strong></span>
        </div>

        {/* Semester fees breakdown */}
        {financeRow.semester_fees?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Semester-wise Fees</div>
            <SemesterFeesPanel semesterFees={financeRow.semester_fees} />
          </div>
        )}

        {/* Transaction history */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Transaction History</div>
        {loading ? <div style={{ color: '#9CA3AF', padding: 20, textAlign: 'center' }}>Loading…</div>
        : history.length === 0 ? <div style={{ color: '#9CA3AF', padding: 20, textAlign: 'center' }}>No transactions found.</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
export default function StudentOverview() {
  const [records,       setRecords]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterBatch,   setFilterBatch]   = useState('');
  const [search,        setSearch]        = useState('');
  const [showSearch,    setShowSearch]    = useState(false);
  const [showPayment,   setShowPayment]   = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);
  const [selectedRow,   setSelectedRow]   = useState(null);
  const [batchOptions,  setBatchOptions]  = useState([]);
  const gridRef = useRef();

  useEffect(() => { fetchBatchOptions().then(setBatchOptions).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStudentOverview({
        program_code:   filterProgram || undefined,
        payment_status: filterStatus  || undefined,
        batch:          filterBatch   || undefined,
      });
      setRecords(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterProgram, filterStatus, filterBatch]);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.full_name?.toLowerCase().includes(q)
      || r.enrollment_no?.toLowerCase().includes(q)
      || r.official_email?.toLowerCase().includes(q)
      || r.mobile?.includes(q);
  });

  // Summary
  const totalNetFee     = filtered.reduce((s, r) => s + parseFloat(r.net_fee     || 0), 0);
  const totalCollected  = filtered.reduce((s, r) => s + parseFloat(r.total_paid  || 0), 0);
  const totalOutstanding= filtered.reduce((s, r) => s + parseFloat(r.balance_due || 0), 0);
  const completedCount  = filtered.filter(r => r.payment_status === 'COMPLETED').length;
  const partialCount    = filtered.filter(r => r.payment_status === 'PARTIAL').length;
  const pendingCount    = filtered.filter(r => r.payment_status === 'PENDING').length;

  const columnDefs = [
    { field: 'enrollment_no', headerName: 'Enrollment No', minWidth: 140, pinned: 'left', cellStyle: { fontWeight: 600, userSelect: 'text', cursor: 'text' } },
    { field: 'full_name',     headerName: 'Name',          minWidth: 160, pinned: 'left', cellStyle: { userSelect: 'text', cursor: 'text' } },
    { field: 'program_code',  headerName: 'Program',       width: 90 },
    { field: 'batch',         headerName: 'Batch',         width: 100 },
    { field: 'payment_plan',  headerName: 'Plan',          width: 120, valueFormatter: p => PAYMENT_PLAN_LABELS[p.value] || p.value || '—' },
    { field: 'scholarship_code', headerName: 'Scholarship', width: 120, valueFormatter: p => p.value || '—' },
    { field: 'discount_type',    headerName: 'Discount',   width: 120, valueFormatter: p => p.value || '—' },
    { field: 'discount_pct',     headerName: 'Disc %',     width: 80,  valueFormatter: p => p.value ? `${p.value}%` : '—' },
    { field: 'full_program_fee', headerName: 'Gross Fee',  width: 120, valueFormatter: p => formatINR(p.value) },
    { field: 'scholarship_amount', headerName: 'Scholar Amt', width: 120, valueFormatter: p => p.value > 0 ? `−${formatINR(p.value)}` : '—' },
    { field: 'discount_amount',    headerName: 'Disc Amt',    width: 110, valueFormatter: p => p.value > 0 ? `−${formatINR(p.value)}` : '—' },
    { field: 'net_fee',      headerName: 'Net Fee',       width: 120, cellStyle: { fontWeight: 700 }, valueFormatter: p => formatINR(p.value) },
    { field: 'total_paid',   headerName: 'Total Paid',    width: 120, cellStyle: { color: '#166534', fontWeight: 600 }, valueFormatter: p => formatINR(p.value) },
    { field: 'balance_due',  headerName: 'Balance Due',   width: 120,
      cellStyle: p => ({ color: parseFloat(p.value) > 0 ? '#DC2626' : '#166534', fontWeight: 600 }),
      valueFormatter: p => formatINR(p.value) },
    { field: 'payment_status', headerName: 'Status', width: 120,
      cellRenderer: p => <StatusBadge value={p.value} /> },
    { field: 'official_email', headerName: 'Email', minWidth: 200, flex: 1, cellStyle: { userSelect: 'text', cursor: 'text' } },
    { field: 'mobile',         headerName: 'Mobile', width: 130, cellStyle: { userSelect: 'text', cursor: 'text' } },
    {
      headerName: 'Actions', width: 160, pinned: 'right', sortable: false, filter: false,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
          <button onClick={() => { setSelectedRow(p.data); setShowPayment(true); }}
            style={{ ...S.actionBtn, background: '#6366F1', color: '#fff' }}>+ Pay</button>
          <button onClick={() => { setSelectedRow(p.data); setShowHistory(true); }}
            style={{ ...S.actionBtn, background: '#F3F4F6', color: '#374151' }}>History</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Student Overview</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Master finance sheet — payments, balances & history</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {showSearch && (
            <input autoFocus placeholder="Search name / enrollment / mobile…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...S.input, width: 260, margin: 0 }} />
          )}
          <button onClick={() => setShowSearch(s => !s)} style={S.iconBtn} title="Search">🔍</button>
          <button onClick={load} style={S.iconBtn} title="Refresh">↻</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Total Students"    value={filtered.length}             color="#6366F1" />
        <KpiCard label="Total Net Fee"     value={formatINR(totalNetFee)}      color="#0EA5E9" />
        <KpiCard label="Total Collected"   value={formatINR(totalCollected)}   color="#10B981"
          sub={`${completedCount} fully paid · ${partialCount} partial`} />
        <KpiCard label="Total Outstanding" value={formatINR(totalOutstanding)} color="#F59E0B"
          sub={`${pendingCount} pending · ${partialCount} partial`} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ ...S.input, width: 140, margin: 0 }}>
          <option value="">All Programs</option>
          {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: 150, margin: 0 }}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partial</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Batches</option>
          {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={load} style={S.outlineBtn}>Apply</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div style={{ height: 560 }}>
        <AgGridReact
          ref={gridRef}
          theme={themeQuartz.withParams({ fontSize: '12px', rowHeight: 36, headerHeight: 38 })}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          pagination
          paginationPageSize={25}
          rowHeight={36}
          headerHeight={38}
          loading={loading}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          onGridReady={p => p.api.sizeColumnsToFit()}
          onFirstDataRendered={p => p.api.sizeColumnsToFit()}
        />
      </div>

      {showPayment && selectedRow && (
        <RecordPaymentModal
          financeRow={selectedRow}
          onClose={() => setShowPayment(false)}
          onDone={() => { setShowPayment(false); load(); }}
        />
      )}
      {showHistory && selectedRow && (
        <PaymentHistoryModal
          financeRow={selectedRow}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
