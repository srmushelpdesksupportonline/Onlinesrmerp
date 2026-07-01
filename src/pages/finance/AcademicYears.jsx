import { useState, useEffect } from 'react';
import {
  fetchAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear,
} from '../../services/financeManagementService';

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  mHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
};

function Badge({ active }) {
  return (
    <span style={{
      background: active ? '#DCFCE7' : '#F3F4F6',
      color:      active ? '#166534' : '#6B7280',
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function AcademicYearModal({ existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    label:      existing?.label      || '',
    start_date: existing?.start_date || '',
    end_date:   existing?.end_date   || '',
    is_active:  existing?.is_active  || false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.label || !form.start_date || !form.end_date) {
      setError('All fields are required.'); return;
    }
    setSaving(true); setError('');
    try {
      if (isEdit) await updateAcademicYear(existing.id, form);
      else        await createAcademicYear(form);
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{isEdit ? 'Edit' : 'Add'} Academic Year</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        {error && <div style={S.errorBox}>{error}</div>}
        <div style={S.fGroup}>
          <label style={S.label}>Label (e.g. 2025-26)</label>
          <input style={S.input} value={form.label} onChange={e => set('label', e.target.value)} placeholder="2025-26" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Start Date</label>
            <input type="date" style={S.input} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>End Date</label>
            <input type="date" style={S.input} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <input
            type="checkbox" id="is_active" checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#6366F1' }}
          />
          <label htmlFor="is_active" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            Set as Active Academic Year
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcademicYears() {
  const [years,   setYears]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [error,     setError]     = useState('');

  async function load() {
    setLoading(true);
    try { setYears(await fetchAcademicYears()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this academic year?')) return;
    try { await deleteAcademicYear(id); load(); }
    catch (e) { setError(e.message); }
  }

  function openAdd()        { setEditing(null); setShowModal(true); }
  function openEdit(y)      { setEditing(y);    setShowModal(true); }
  function handleSaved()    { setShowModal(false); load(); }

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Academic Years</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Define and manage academic year periods</div>
        </div>
        <button onClick={openAdd} style={S.primaryBtn}>+ Add Academic Year</button>
      </div>

      {error && <div style={{ ...S.errorBox, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : years.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          No academic years defined yet. <button onClick={openAdd} style={{ ...S.primaryBtn, marginLeft: 12 }}>Add one</button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Label', 'Start Date', 'End Date', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map(y => (
                <tr key={y.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>{y.label}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{y.start_date}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{y.end_date}</td>
                  <td style={{ padding: '12px 16px' }}><Badge active={y.is_active} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(y)} style={{ ...S.outlineBtn, padding: '5px 12px', fontSize: 12 }}>Edit</button>
                      <button onClick={() => handleDelete(y.id)} style={S.dangerBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AcademicYearModal
          existing={editing}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
