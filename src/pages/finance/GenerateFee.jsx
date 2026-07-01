import { useState, useEffect } from 'react';
import {
  fetchGeneratedFees, generateFeesForBlock, markGeneratedFeePaid,
  fetchFeeBlocks, formatINR, PROGRAM_CODES, STATUS_COLORS,
} from '../../services/financeManagementService';

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, width: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  mHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  successBtn: { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  successBox: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
};

function StatusBadge({ value }) {
  const c = STATUS_COLORS[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
      {value}
    </span>
  );
}

function GenerateModal({ blocks, onClose, onDone }) {
  const [form, setForm] = useState({
    block_id:                '',
    program_code:            '',
    intake:                  '',
    semester:                '',
    require_full_fee_paid:   false,
    require_no_backlogs:     false,
    payment_link_base:       'https://pay.orangepay.in/srmus',
    generated_by:            '',
  });
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const selectedBlock = blocks.find(b => String(b.id) === String(form.block_id));

  async function handleGenerate() {
    if (!form.block_id) { setError('Select a fee block.'); return; }
    setRunning(true); setError(''); setResult(null);
    try {
      const conditions = {
        program_code:          form.program_code          || undefined,
        intake:                form.intake                || undefined,
        semester:              form.semester ? parseInt(form.semester) : undefined,
        require_full_fee_paid: form.require_full_fee_paid,
        require_no_backlogs:   form.require_no_backlogs,
        payment_link_base:     form.payment_link_base     || undefined,
      };
      const res = await generateFeesForBlock({
        block_id:      parseInt(form.block_id),
        conditions,
        generated_by:  form.generated_by || null,
      });
      setResult(res);
    } catch (e) { setError(e.message); } finally { setRunning(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Generate Fees</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        {error  && <div style={S.errorBox}>{error}</div>}
        {result && (
          <div style={S.successBox}>
            ✓ Generated fees for <strong>{result.inserted}</strong> student{result.inserted !== 1 ? 's' : ''}.
            {result.skipped > 0 && ` ${result.skipped} already had a fee record for this block.`}
          </div>
        )}

        <div style={S.fGroup}>
          <label style={S.label}>Fee Block</label>
          <select style={S.input} value={form.block_id} onChange={e => set('block_id', e.target.value)}>
            <option value="">— Select Fee Block —</option>
            {blocks.filter(b => b.status === 'ACTIVE').map(b => (
              <option key={b.id} value={b.id}>
                {b.block_name} — {b.program_code} ({formatINR(b.total_amount)})
              </option>
            ))}
          </select>
          {selectedBlock && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
              Block Total: {formatINR(selectedBlock.total_amount)} · {selectedBlock.fee_type}
              {selectedBlock.semester ? ` · Sem ${selectedBlock.semester}` : ''}
            </div>
          )}
        </div>

        {/* Conditions */}
        <div style={{ ...S.infoBox, marginTop: 4 }}>
          <strong>Eligibility Conditions</strong> — Only students matching all selected conditions below will have fees generated.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Program</label>
            <select style={S.input} value={form.program_code} onChange={e => set('program_code', e.target.value)}>
              <option value="">All Programs</option>
              {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Intake</label>
            <select style={S.input} value={form.intake} onChange={e => set('intake', e.target.value)}>
              <option value="">All Intakes</option>
              <option value="JAN">January</option>
              <option value="JUL">July</option>
            </select>
          </div>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Semester (optional filter)</label>
          <input type="number" style={S.input} value={form.semester} onChange={e => set('semester', e.target.value)} placeholder="Leave blank for all semesters" min="1" max="6" />
        </div>

        {/* Condition checkboxes */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Additional Conditions</div>
          {[
            { key: 'require_full_fee_paid', label: 'Only if full course fee is already paid' },
            { key: 'require_no_backlogs',   label: 'Only if no backlogs in previous semesters' },
          ].map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input
                type="checkbox" id={c.key}
                checked={form[c.key]}
                onChange={e => set(c.key, e.target.checked)}
                style={{ width: 15, height: 15, accentColor: '#6366F1' }}
              />
              <label htmlFor={c.key} style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>{c.label}</label>
            </div>
          ))}
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Payment Link Base URL</label>
          <input style={S.input} value={form.payment_link_base} onChange={e => set('payment_link_base', e.target.value)} placeholder="https://pay.orangepay.in/srmus" />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Amount and enrollment number will be appended automatically.</div>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Generated By</label>
          <input style={S.input} value={form.generated_by} onChange={e => set('generated_by', e.target.value)} placeholder="Your name or team" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button onClick={handleGenerate} disabled={running} style={S.primaryBtn}>
              {running ? 'Generating…' : 'Generate Fees'}
            </button>
          )}
          {result && (
            <button onClick={() => { onDone(); onClose(); }} style={S.primaryBtn}>View Results</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GenerateFee() {
  const [genFees,       setGenFees]       = useState([]);
  const [blocks,        setBlocks]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [error,         setError]         = useState('');
  const [filterBlock,   setFilterBlock]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [search,        setSearch]        = useState('');

  async function load() {
    setLoading(true);
    try {
      const [gf, bl] = await Promise.all([
        fetchGeneratedFees({
          block_id:     filterBlock   || undefined,
          status:       filterStatus  || undefined,
          program_code: filterProgram || undefined,
        }),
        fetchFeeBlocks(),
      ]);
      setGenFees(gf);
      setBlocks(bl);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterBlock, filterStatus, filterProgram]);

  async function handleMarkPaid(row) {
    if (!confirm(`Mark ${row.enrollment_no} as PAID (${formatINR(row.total_amount)})?`)) return;
    try { await markGeneratedFeePaid(row.id, row.total_amount); load(); }
    catch (e) { setError(e.message); }
  }

  const filtered = genFees.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.enrollment_no?.toLowerCase().includes(q) || r.student_name?.toLowerCase().includes(q);
  });

  // Summary stats
  const totalAmt  = filtered.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
  const paidAmt   = filtered.reduce((s, r) => s + parseFloat(r.paid_amount  || 0), 0);
  const unpaidCnt = filtered.filter(r => r.status === 'UNPAID').length;
  const paidCnt   = filtered.filter(r => r.status === 'PAID').length;

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Generate Fee</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Generate and track fee records per student</div>
        </div>
        <button onClick={() => setShowModal(true)} style={S.primaryBtn}>+ Generate Fees</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Generated', value: formatINR(totalAmt),   color: '#6366F1' },
          { label: 'Total Paid',      value: formatINR(paidAmt),     color: '#10B981' },
          { label: 'Unpaid Records',  value: unpaidCnt,              color: '#F59E0B' },
          { label: 'Paid Records',    value: paidCnt,                color: '#10B981' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search enrollment / name…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, width: 240, margin: 0 }}
        />
        <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)} style={{ ...S.input, width: 220, margin: 0 }}>
          <option value="">All Blocks</option>
          {blocks.map(b => <option key={b.id} value={b.id}>{b.block_name}</option>)}
        </select>
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ ...S.input, width: 140, margin: 0 }}>
          <option value="">All Programs</option>
          {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </select>
        <span style={{ alignSelf: 'center', fontSize: 13, color: '#6B7280', marginLeft: 'auto' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div style={{ ...S.errorBox, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          No generated fees found. <button onClick={() => setShowModal(true)} style={{ ...S.primaryBtn, marginLeft: 12 }}>Generate now</button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Enrollment No', 'Student', 'Program', 'Sem', 'Fee Block', 'Total', 'Paid', 'Balance', 'Status', 'Generated', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827', userSelect: 'text' }}>{r.enrollment_no}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.student_name || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.program_code || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.semester ? `Sem ${r.semester}` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.block_name}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{formatINR(r.total_amount)}</td>
                  <td style={{ padding: '10px 12px', color: '#166534', fontWeight: 600 }}>{formatINR(r.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', color: parseFloat(r.balance) > 0 ? '#DC2626' : '#166534', fontWeight: 600 }}>{formatINR(r.balance)}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge value={r.status} /></td>
                  <td style={{ padding: '10px 12px', color: '#6B7280' }}>{new Date(r.generated_at).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.status !== 'PAID' && (
                      <button onClick={() => handleMarkPaid(r)} style={S.successBtn}>Mark Paid</button>
                    )}
                    {r.payment_link && (
                      <a href={r.payment_link} target="_blank" rel="noreferrer"
                        style={{ marginLeft: 6, fontSize: 12, color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
                        Pay Link ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <GenerateModal
          blocks={blocks}
          onClose={() => setShowModal(false)}
          onDone={() => load()}
        />
      )}
    </div>
  );
}
