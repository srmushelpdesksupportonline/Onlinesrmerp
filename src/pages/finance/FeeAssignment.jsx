import { useState, useEffect } from 'react';
import {
  fetchFeeAssignments, createFeeAssignment, deleteFeeAssignment,
  fetchFeeBlocks, fetchAcademicYears,
  formatINR, PROGRAM_CODES, fetchBatchOptions,
} from '../../services/financeManagementService';

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, width: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  mHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
};

function AssignModal({ blocks, academicYears, batchOptions, onClose, onSaved }) {
  const [assignType, setAssignType] = useState('batch'); // 'batch' (bulk, by program) or 'student' (single) — unrelated to the student batch field below
  const [form, setForm] = useState({
    block_id:         '',
    enrollment_no:    '',
    program_code:     '',
    semester:         '',
    academic_year_id: '',
    batch:            '',
    assigned_by:      '',
    notes:            '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const selectedBlock = blocks.find(b => String(b.id) === String(form.block_id));

  async function handleSave() {
    if (!form.block_id) { setError('Select a fee block.'); return; }
    if (assignType === 'student' && !form.enrollment_no) { setError('Enter an enrollment number.'); return; }
    if (assignType === 'batch'   && !form.program_code)  { setError('Select a program for batch assignment.'); return; }

    setSaving(true); setError('');
    try {
      await createFeeAssignment({
        ...form,
        enrollment_no:    assignType === 'student' ? form.enrollment_no : null,
        program_code:     assignType === 'batch'   ? form.program_code  : null,
        semester:         form.semester         || null,
        academic_year_id: form.academic_year_id || null,
        batch:            form.batch            || null,
      });
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Assign Fee Block</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        {error && <div style={S.errorBox}>{error}</div>}

        {/* Assignment type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['batch', 'student'].map(t => (
            <button
              key={t}
              onClick={() => setAssignType(t)}
              style={{
                padding: '7px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: assignType === t ? '2px solid #6366F1' : '1px solid #D1D5DB',
                background: assignType === t ? '#EEF2FF' : '#fff',
                color: assignType === t ? '#6366F1' : '#374151',
              }}
            >
              {t === 'batch' ? 'Batch Assignment' : 'Individual Student'}
            </button>
          ))}
        </div>

        <div style={S.infoBox}>
          {assignType === 'batch'
            ? 'Assigns this fee block to all students matching the selected program / semester / batch.'
            : 'Assigns this fee block to a single student by enrollment number.'}
        </div>

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
              Total: {formatINR(selectedBlock.total_amount)} · {selectedBlock.fee_type}
            </div>
          )}
        </div>

        {assignType === 'student' ? (
          <div style={S.fGroup}>
            <label style={S.label}>Enrollment Number</label>
            <input style={S.input} value={form.enrollment_no} onChange={e => set('enrollment_no', e.target.value)} placeholder="e.g. EMB22500001" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Program</label>
              <select style={S.input} value={form.program_code} onChange={e => set('program_code', e.target.value)}>
                <option value="">— Select —</option>
                {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Batch</label>
              <select style={S.input} value={form.batch} onChange={e => set('batch', e.target.value)}>
                <option value="">All Batches</option>
                {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Academic Year</label>
            <select style={S.input} value={form.academic_year_id} onChange={e => set('academic_year_id', e.target.value)}>
              <option value="">— Select —</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Semester (optional)</label>
            <input type="number" style={S.input} value={form.semester} onChange={e => set('semester', e.target.value)} placeholder="e.g. 1" min="1" max="6" />
          </div>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Assigned By</label>
          <input style={S.input} value={form.assigned_by} onChange={e => set('assigned_by', e.target.value)} placeholder="Your name or team" />
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Notes (optional)</label>
          <textarea style={{ ...S.input, resize: 'vertical' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>
            {saving ? 'Assigning…' : 'Assign Fee Block'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeeAssignment() {
  const [assignments,   setAssignments]   = useState([]);
  const [blocks,        setBlocks]        = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [batchOptions,  setBatchOptions]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [error,         setError]         = useState('');
  const [filterProgram, setFilterProgram] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [a, b, y, bo] = await Promise.all([
        fetchFeeAssignments({ program_code: filterProgram || undefined }),
        fetchFeeBlocks(),
        fetchAcademicYears(),
        fetchBatchOptions(),
      ]);
      setAssignments(a);
      setBlocks(b);
      setAcademicYears(y);
      setBatchOptions(bo);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterProgram]);

  async function handleDelete(id) {
    if (!confirm('Remove this fee assignment?')) return;
    try { await deleteFeeAssignment(id); load(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Fee Assignment</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Assign fee blocks to students or batches</div>
        </div>
        <button onClick={() => setShowModal(true)} style={S.primaryBtn}>+ Assign Fee Block</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ ...S.input, width: 160, margin: 0 }}>
          <option value="">All Programs</option>
          {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280', alignSelf: 'center' }}>
          {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div style={{ ...S.errorBox, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : assignments.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          No assignments yet. <button onClick={() => setShowModal(true)} style={{ ...S.primaryBtn, marginLeft: 12 }}>Create one</button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Fee Block', 'Assigned To', 'Program', 'Semester', 'Batch', 'Academic Year', 'Block Total', 'Assigned At', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{a.block_name}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {a.enrollment_no
                      ? <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{a.enrollment_no}</span>
                      : <span style={{ background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Batch</span>
                    }
                  </td>
                  <td style={{ padding: '11px 14px', color: '#374151' }}>{a.program_code || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151' }}>{a.semester ? `Sem ${a.semester}` : '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151' }}>{a.batch || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151' }}>{a.academic_year_label}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{formatINR(a.block_total)}</td>
                  <td style={{ padding: '11px 14px', color: '#6B7280' }}>{new Date(a.assigned_at).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => handleDelete(a.id)} style={S.dangerBtn}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AssignModal
          blocks={blocks}
          academicYears={academicYears}
          batchOptions={batchOptions}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
