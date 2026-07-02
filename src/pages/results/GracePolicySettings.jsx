import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllGracePolicies, createGracePolicy, updateGracePolicy, setGracePolicyActive,
} from '../../services/graceMarksService';
import { PROGRAM_CODES } from '../../services/resultsService';

const S = {
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  successBox: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  td:         { padding: '10px 12px', color: '#374151', fontSize: 13 },
  th:         { padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', fontSize: 12 },
};

const SEMESTERS = ['1', '2', '3', '4', '5', '6'];
const CAP_SCOPES = ['CYCLE', 'SEMESTER', 'CUMULATIVE'];

function emptyForm() {
  return {
    scopeType: 'cycle', // 'cycle' | 'general'
    programCode: '', semester: '', examMonthYear: '',
    effectiveFromBatch: '',
    marksThreshold: 3, maxSubjectsPerStudent: 2, capScope: 'CYCLE',
    notes: '',
  };
}

function PolicyModal({ policy, onClose, onSaved }) {
  const isEdit = !!policy;
  const [form, setForm] = useState(() => {
    if (!policy) return emptyForm();
    const isCycle = !!(policy.program_code && policy.semester && policy.exam_month_year);
    return {
      scopeType: isCycle ? 'cycle' : 'general',
      programCode: policy.program_code || '',
      semester: policy.semester ? String(policy.semester) : '',
      examMonthYear: policy.exam_month_year || '',
      effectiveFromBatch: policy.effective_from_batch || '',
      marksThreshold: policy.marks_threshold,
      maxSubjectsPerStudent: policy.max_subjects_per_student,
      capScope: policy.cap_scope,
      notes: policy.notes || '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (form.scopeType === 'cycle' && (!form.programCode || !form.semester || !form.examMonthYear.trim())) {
      setError('Program, Semester and Exam Month/Year are required for a cycle-specific policy.');
      return;
    }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await updateGracePolicy(policy.id, {
          marks_threshold: parseFloat(form.marksThreshold),
          max_subjects_per_student: parseInt(form.maxSubjectsPerStudent),
          cap_scope: form.capScope,
          notes: form.notes || null,
          program_code:         form.scopeType === 'cycle' ? form.programCode : null,
          semester:              form.scopeType === 'cycle' ? parseInt(form.semester) : null,
          exam_month_year:       form.scopeType === 'cycle' ? form.examMonthYear.trim() : null,
          effective_from_batch:  form.scopeType === 'general' ? (form.effectiveFromBatch.trim() || null) : null,
        });
      } else {
        await createGracePolicy({
          scopeType: form.scopeType,
          programCode: form.programCode,
          semester: form.semester,
          examMonthYear: form.examMonthYear.trim(),
          effectiveFromBatch: form.effectiveFromBatch.trim(),
          marksThreshold: parseFloat(form.marksThreshold),
          maxSubjectsPerStudent: parseInt(form.maxSubjectsPerStudent),
          capScope: form.capScope,
          notes: form.notes,
        });
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Failed to save policy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Edit Policy' : 'New Grace Marks Policy'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Scope</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: 'cycle', label: 'Specific Exam Cycle' },
              { v: 'general', label: 'General (by batch)' },
            ].map(o => (
              <button key={o.v} onClick={() => set('scopeType', o.v)} style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: form.scopeType === o.v ? '2px solid #6366F1' : '1px solid #D1D5DB',
                background: form.scopeType === o.v ? '#EEF2FF' : '#fff',
                color: form.scopeType === o.v ? '#6366F1' : '#374151',
              }}>{o.label}</button>
            ))}
          </div>
        </div>

        {form.scopeType === 'cycle' ? (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ ...S.fGroup, flex: 1 }}>
                <label style={S.label}>Program</label>
                <select style={S.input} value={form.programCode} onChange={e => set('programCode', e.target.value)}>
                  <option value="">— Select —</option>
                  {PROGRAM_CODES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ ...S.fGroup, flex: 1 }}>
                <label style={S.label}>Semester</label>
                <select style={S.input} value={form.semester} onChange={e => set('semester', e.target.value)}>
                  <option value="">— Select —</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={S.fGroup}>
              <label style={S.label}>Exam Month/Year</label>
              <input style={S.input} value={form.examMonthYear} onChange={e => set('examMonthYear', e.target.value)} placeholder="e.g. MAR 2026" />
            </div>
          </>
        ) : (
          <div style={S.fGroup}>
            <label style={S.label}>Effective From Batch <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional — blank applies from the beginning)</span></label>
            <input style={S.input} value={form.effectiveFromBatch} onChange={e => set('effectiveFromBatch', e.target.value)} placeholder="e.g. Jan-2025" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ ...S.fGroup, flex: 1 }}>
            <label style={S.label}>Marks Threshold</label>
            <input type="number" min={1} style={S.input} value={form.marksThreshold} onChange={e => set('marksThreshold', e.target.value)} />
          </div>
          <div style={{ ...S.fGroup, flex: 1 }}>
            <label style={S.label}>Max Subjects / Student</label>
            <input type="number" min={1} style={S.input} value={form.maxSubjectsPerStudent} onChange={e => set('maxSubjectsPerStudent', e.target.value)} />
          </div>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>Cap Scope</label>
          <select style={S.input} value={form.capScope} onChange={e => set('capScope', e.target.value)}>
            {CAP_SCOPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
            CYCLE resets per exam cycle · SEMESTER counts across the whole semester · CUMULATIVE counts across the student's entire record.
          </div>
        </div>

        <div style={{ ...S.fGroup, marginBottom: 20 }}>
          <label style={S.label}>Notes <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
          <input style={S.input} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Why this policy exists" />
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GracePolicySettings() {
  const [policies, setPolicies] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modalPolicy, setModalPolicy] = useState(undefined); // undefined = closed, null = new, object = edit
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolicies(await fetchAllGracePolicies());
    } catch (e) { setError(e.message || 'Failed to load policies.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(policy) {
    setError(''); setSuccess('');
    try {
      await setGracePolicyActive(policy.id, !policy.is_active);
      setSuccess(`✓ Policy ${policy.is_active ? 'deactivated' : 'activated'}.`);
      load();
    } catch (e) { setError(e.message || 'Failed to update policy.'); }
  }

  function scopeLabel(p) {
    if (p.program_code && p.semester && p.exam_month_year) {
      return `Cycle: ${p.program_code} · Sem ${p.semester} · ${p.exam_month_year}`;
    }
    return p.effective_from_batch ? `General — from batch ${p.effective_from_batch}` : 'General — all batches';
  }

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Grace Marks Policy</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
            Set the marks threshold, max subjects per student, and cap scope — per exam cycle or as a general default. No code changes needed.
          </div>
        </div>
        <button onClick={() => setModalPolicy(null)} style={S.primaryBtn}>+ New Policy</button>
      </div>

      {error   && <div style={S.errorBox}>{error}</div>}
      {success && <div style={S.successBox}>{success}</div>}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : policies.length === 0 ? (
        <div style={{ color: '#9CA3AF', fontSize: 14, padding: 24, textAlign: 'center', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 }}>
          No policies configured yet. Click "+ New Policy" to create one.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Scope', 'Marks Threshold', 'Max Subjects', 'Cap Scope', 'Notes', 'Status', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: p.is_active ? 1 : 0.55 }}>
                  <td style={{ ...S.td, fontWeight: 600 }}>
                    <span style={{
                      background: p.program_code ? '#EEF2FF' : '#F0FDF4',
                      color: p.program_code ? '#6366F1' : '#166534',
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>{scopeLabel(p)}</span>
                  </td>
                  <td style={S.td}>{p.marks_threshold}</td>
                  <td style={S.td}>{p.max_subjects_per_student}</td>
                  <td style={S.td}>{p.cap_scope}</td>
                  <td style={{ ...S.td, color: '#6B7280', fontSize: 12 }}>{p.notes || '—'}</td>
                  <td style={S.td}>
                    {p.is_active
                      ? <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Active</span>
                      : <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Inactive</span>}
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setModalPolicy(p)} style={S.outlineBtn}>Edit</button>
                      <button onClick={() => handleToggleActive(p)} style={S.dangerBtn}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalPolicy !== undefined && (
        <PolicyModal
          policy={modalPolicy}
          onClose={() => setModalPolicy(undefined)}
          onSaved={() => { setModalPolicy(undefined); setSuccess('✓ Policy saved.'); load(); }}
        />
      )}
    </div>
  );
}
