import { useState, useEffect } from 'react';
import {
  fetchFeeBlocks, createFeeBlock, updateFeeBlock, deleteFeeBlock,
  upsertFeeComponents, fetchAcademicYears,
  formatINR, PROGRAM_CODES, FEE_TYPES, STATUS_COLORS,
} from '../../services/financeManagementService';

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, width: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  mHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
};

function StatusBadge({ value }) {
  const c = STATUS_COLORS[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
      {value}
    </span>
  );
}

function BlockModal({ existing, academicYears, onClose, onSaved }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    block_name:      existing?.block_name      || '',
    program_code:    existing?.program_code    || 'MBA',
    academic_year_id:existing?.academic_year_id|| '',
    semester:        existing?.semester        || '',
    fee_type:        existing?.fee_type        || 'SEMESTER',
    status:          existing?.status          || 'ACTIVE',
    description:     existing?.description     || '',
  });
  const [components, setComponents] = useState(
    existing?.fee_components?.length
      ? existing.fee_components.map(c => ({ component_name: c.component_name, amount: c.amount, is_optional: c.is_optional }))
      : [{ component_name: '', amount: '', is_optional: false }]
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function setComp(i, k, v) {
    setComponents(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  }

  function addComp() {
    setComponents(cs => [...cs, { component_name: '', amount: '', is_optional: false }]);
  }

  function removeComp(i) {
    setComponents(cs => cs.filter((_, idx) => idx !== i));
  }

  const total = components.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  async function handleSave() {
    if (!form.block_name || !form.program_code || !form.fee_type) {
      setError('Block name, program and fee type are required.'); return;
    }
    const validComps = components.filter(c => c.component_name && parseFloat(c.amount) >= 0);
    if (validComps.length === 0) { setError('Add at least one fee component.'); return; }

    setSaving(true); setError('');
    try {
      let blockId;
      const payload = {
        ...form,
        academic_year_id: form.academic_year_id || null,
        semester: form.semester !== '' ? parseInt(form.semester) : null,
      };
      if (isEdit) {
        await updateFeeBlock(existing.id, payload);
        blockId = existing.id;
      } else {
        const b = await createFeeBlock(payload);
        blockId = b.id;
      }
      await upsertFeeComponents(blockId, validComps);
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{isEdit ? 'Edit' : 'Create'} Fee Block</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        {error && <div style={S.errorBox}>{error}</div>}

        <div style={S.fGroup}>
          <label style={S.label}>Block Name</label>
          <input style={S.input} value={form.block_name} onChange={e => set('block_name', e.target.value)} placeholder="e.g. MBA Sem 1 Fee Package" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Program</label>
            <select style={S.input} value={form.program_code} onChange={e => set('program_code', e.target.value)}>
              {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Fee Type</label>
            <select style={S.input} value={form.fee_type} onChange={e => set('fee_type', e.target.value)}>
              {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Status</label>
            <select style={S.input} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Description (optional)</label>
            <input style={S.input} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes" />
          </div>
        </div>

        {/* Fee Components */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ ...S.label, margin: 0 }}>Fee Components</label>
            <button onClick={addComp} style={{ ...S.outlineBtn, padding: '5px 12px', fontSize: 12 }}>+ Add Component</button>
          </div>

          {components.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                style={S.input}
                value={c.component_name}
                onChange={e => setComp(i, 'component_name', e.target.value)}
                placeholder="Component name (e.g. Tuition Fee)"
              />
              <input
                type="number" style={S.input} value={c.amount}
                onChange={e => setComp(i, 'amount', e.target.value)}
                placeholder="Amount"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
                <input
                  type="checkbox" checked={c.is_optional}
                  onChange={e => setComp(i, 'is_optional', e.target.checked)}
                  style={{ accentColor: '#6366F1' }}
                />
                Optional
              </div>
              <button onClick={() => removeComp(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 18, padding: 0 }}>×</button>
            </div>
          ))}

          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 8 }}>
            Block Total: {formatINR(total)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Block'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeeStructures() {
  const [blocks,        setBlocks]        = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [error,         setError]         = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [expanded,      setExpanded]      = useState({});

  async function load() {
    setLoading(true);
    try {
      const [b, y] = await Promise.all([
        fetchFeeBlocks({ program_code: filterProgram || undefined, status: filterStatus || undefined }),
        fetchAcademicYears(),
      ]);
      setBlocks(b);
      setAcademicYears(y);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterProgram, filterStatus]);

  async function handleDelete(id) {
    if (!confirm('Delete this fee block and all its components?')) return;
    try { await deleteFeeBlock(id); load(); }
    catch (e) { setError(e.message); }
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Fee Structures</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Define fee blocks and their components</div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} style={S.primaryBtn}>+ Create Fee Block</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
          style={{ ...S.input, width: 140, margin: 0 }}>
          <option value="">All Programs</option>
          {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...S.input, width: 140, margin: 0 }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280', alignSelf: 'center' }}>
          {blocks.length} block{blocks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div style={{ ...S.errorBox, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : blocks.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          No fee blocks found. <button onClick={() => setShowModal(true)} style={{ ...S.primaryBtn, marginLeft: 12 }}>Create one</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocks.map(block => (
            <div key={block.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              {/* Block header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 16 }}>
                <button
                  onClick={() => toggleExpand(block.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6B7280', padding: 0, lineHeight: 1 }}
                >
                  {expanded[block.id] ? '▼' : '▶'}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{block.block_name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {block.program_code} · {block.fee_type} · {block.academic_year_label}
                    {block.semester ? ` · Sem ${block.semester}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{formatINR(block.total_amount)}</div>
                <StatusBadge value={block.status} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setEditing(block); setShowModal(true); }}
                    style={{ ...S.outlineBtn, padding: '6px 14px', fontSize: 12 }}
                  >Edit</button>
                  <button onClick={() => handleDelete(block.id)} style={S.dangerBtn}>Delete</button>
                </div>
              </div>

              {/* Components — expanded */}
              {expanded[block.id] && (
                <div style={{ borderTop: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Component', 'Amount', 'Optional'].map(h => (
                          <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(block.fee_components || []).map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 20px', color: '#374151' }}>{c.component_name}</td>
                          <td style={{ padding: '10px 20px', fontWeight: 600, color: '#111827' }}>{formatINR(c.amount)}</td>
                          <td style={{ padding: '10px 20px', color: '#6B7280' }}>{c.is_optional ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F3F4F6' }}>
                        <td style={{ padding: '10px 20px', fontWeight: 700, color: '#111827' }}>Total</td>
                        <td style={{ padding: '10px 20px', fontWeight: 700, color: '#111827' }}>{formatINR(block.total_amount)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <BlockModal
          existing={editing}
          academicYears={academicYears}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
