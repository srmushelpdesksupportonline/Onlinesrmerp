import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllSchemesWithBands, createGradingScheme, updateSchemeBand,
  updateScheme, deactivateScheme, recalculateGrades,
} from '../../services/gradingService';

const S = {
  input:      { width: '100%', padding: '8px 11px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  successBox: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 14, padding: 28, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: 720 },
};

const SPECIAL_RULE_LABELS = {
  ia_min_50_required: 'Requires IA ≥ 50% to pass',
  is_absent:          'Absent (ESE = AB)',
  is_not_eligible:    'Not eligible to appear',
};

function SchemeCard({ scheme, onEdit, onDeactivate }) {
  const isDefault = !scheme.effective_from_batch;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{scheme.name}</span>
            {!scheme.is_active && (
              <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Superseded</span>
            )}
            {scheme.is_active && (
              <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Active</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            Effective from: <strong>{isDefault ? 'Beginning (default)' : scheme.effective_from_batch}</strong>
          </div>
          {scheme.notes && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{scheme.notes}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onEdit(scheme)} style={S.outlineBtn}>Edit Bands</button>
          {scheme.is_active && (
            <button onClick={() => onDeactivate(scheme)} style={S.dangerBtn}>Deactivate</button>
          )}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            {['Grade', 'Points', 'Mark Range', 'Special Rule'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scheme.bands.map(b => (
            <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '6px 10px', fontWeight: 700 }}>{b.letter_grade}</td>
              <td style={{ padding: '6px 10px' }}>{b.grade_points}</td>
              <td style={{ padding: '6px 10px', color: '#374151' }}>
                {b.min_percent !== null && b.max_percent !== null ? `${b.min_percent}–${b.max_percent}` : '—'}
              </td>
              <td style={{ padding: '6px 10px', color: '#92400E', fontSize: 11 }}>
                {b.special_rule ? SPECIAL_RULE_LABELS[b.special_rule] || b.special_rule : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Edit Bands Modal ──────────────────────────────────────────────────────────
function EditBandsModal({ scheme, onClose, onSaved }) {
  const [bands, setBands]   = useState(scheme.bands.map(b => ({ ...b })));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function updateBand(idx, field, value) {
    setBands(bs => bs.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      for (const b of bands) {
        await updateSchemeBand(b.id, {
          letter_grade: b.letter_grade,
          grade_points: parseFloat(b.grade_points) || 0,
          min_percent:  b.min_percent === '' || b.min_percent === null ? null : parseFloat(b.min_percent),
          max_percent:  b.max_percent === '' || b.max_percent === null ? null : parseFloat(b.max_percent),
          special_rule: b.special_rule || null,
        });
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Edit Bands — {scheme.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={S.errorBox}>{error}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Grade', 'Points', 'Min %', 'Max %', 'Special Rule'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#6B7280', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={b.id}>
                <td style={{ padding: 4 }}>
                  <input value={b.letter_grade} onChange={e => updateBand(i, 'letter_grade', e.target.value)} style={{ ...S.input, width: 60 }} />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.grade_points} onChange={e => updateBand(i, 'grade_points', e.target.value)} style={{ ...S.input, width: 60 }} />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.min_percent ?? ''} onChange={e => updateBand(i, 'min_percent', e.target.value)} style={{ ...S.input, width: 70 }} placeholder="—" />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.max_percent ?? ''} onChange={e => updateBand(i, 'max_percent', e.target.value)} style={{ ...S.input, width: 70 }} placeholder="—" />
                </td>
                <td style={{ padding: 4 }}>
                  <select value={b.special_rule || ''} onChange={e => updateBand(i, 'special_rule', e.target.value)} style={{ ...S.input, width: 200 }}>
                    <option value="">None</option>
                    <option value="ia_min_50_required">Requires IA ≥ 50% to pass</option>
                    <option value="is_absent">Absent (ESE = AB)</option>
                    <option value="is_not_eligible">Not eligible to appear</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── New Scheme Modal ──────────────────────────────────────────────────────────
function NewSchemeModal({ baseScheme, onClose, onCreated }) {
  const [name, setName]       = useState(`New ${baseScheme.program_type} Grading`);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [notes, setNotes]     = useState('');
  const [bands, setBands]     = useState(baseScheme.bands.map(b => ({
    letter_grade: b.letter_grade, grade_points: b.grade_points,
    min_percent: b.min_percent, max_percent: b.max_percent, special_rule: b.special_rule,
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function updateBand(idx, field, value) {
    setBands(bs => bs.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Scheme name is required.'); return; }
    if (!effectiveFrom.trim().match(/^(JAN|JUL)-\d{2}$/i)) {
      setError('Effective From Batch must be in format like "JUL-27".'); return;
    }
    setSaving(true); setError('');
    try {
      await createGradingScheme({
        name: name.trim(),
        programType: baseScheme.program_type,
        effectiveFromBatch: effectiveFrom.trim().toUpperCase(),
        notes: notes.trim() || null,
        bands: bands.map(b => ({
          letter_grade: b.letter_grade,
          grade_points: parseFloat(b.grade_points) || 0,
          min_percent:  b.min_percent === '' || b.min_percent === null ? null : parseFloat(b.min_percent),
          max_percent:  b.max_percent === '' || b.max_percent === null ? null : parseFloat(b.max_percent),
          special_rule: b.special_rule || null,
        })),
      });
      onCreated();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>New {baseScheme.program_type} Grading Scheme</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Scheme Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Effective From Batch</label>
            <input value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} style={S.input} placeholder="e.g. JUL-27" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} style={S.input} placeholder="Why this scheme was introduced..." />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Grade Bands — pre-filled from current scheme, edit as needed
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Grade', 'Points', 'Min %', 'Max %', 'Special Rule'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#6B7280', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={i}>
                <td style={{ padding: 4 }}>
                  <input value={b.letter_grade} onChange={e => updateBand(i, 'letter_grade', e.target.value)} style={{ ...S.input, width: 60 }} />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.grade_points} onChange={e => updateBand(i, 'grade_points', e.target.value)} style={{ ...S.input, width: 60 }} />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.min_percent ?? ''} onChange={e => updateBand(i, 'min_percent', e.target.value)} style={{ ...S.input, width: 70 }} placeholder="—" />
                </td>
                <td style={{ padding: 4 }}>
                  <input type="number" value={b.max_percent ?? ''} onChange={e => updateBand(i, 'max_percent', e.target.value)} style={{ ...S.input, width: 70 }} placeholder="—" />
                </td>
                <td style={{ padding: 4 }}>
                  <select value={b.special_rule || ''} onChange={e => updateBand(i, 'special_rule', e.target.value)} style={{ ...S.input, width: 200 }}>
                    <option value="">None</option>
                    <option value="ia_min_50_required">Requires IA ≥ 50% to pass</option>
                    <option value="is_absent">Absent (ESE = AB)</option>
                    <option value="is_not_eligible">Not eligible to appear</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={S.primaryBtn}>{saving ? 'Creating…' : 'Create Scheme'}</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function Grades() {
  const [schemes, setSchemes]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [editScheme, setEditScheme] = useState(null);
  const [newSchemeBase, setNewSchemeBase] = useState(null);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState(null); // { done, total }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllSchemesWithBands();
      setSchemes(data);
    } catch (e) {
      setError(e.message);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDeactivate(scheme) {
    if (!confirm(`Deactivate "${scheme.name}"? It will no longer apply to new uploads, but historical grades using it stay unchanged.`)) return;
    try {
      await deactivateScheme(scheme.id);
      setSuccess('Scheme deactivated.');
      load();
    } catch (e) { setError(e.message); }
  }

  async function handleRecalculate() {
    if (!confirm('Recalculate grades for ALL existing results using the current applicable schemes? This may take a moment for large datasets.')) return;
    setRecalculating(true); setError(''); setSuccess(''); setRecalcProgress({ done: 0, total: 0 });
    try {
      const { updated, skipped } = await recalculateGrades({}, (done, total) => {
        setRecalcProgress({ done, total });
      });
      setSuccess(`✓ Recalculated ${updated} results. ${skipped > 0 ? `${skipped} skipped (no applicable scheme or missing data).` : ''}`);
    } catch (e) { setError(e.message); }
    finally { setRecalculating(false); setRecalcProgress(null); }
  }

  const pgSchemes = schemes.filter(s => s.program_type === 'PG');
  const ugSchemes = schemes.filter(s => s.program_type === 'UG');

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Grading Schemes</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
            Editable, versioned grading logic for PG (MBA/MCA) and UG (BBA/BCA) programs
          </div>
        </div>
        <button onClick={handleRecalculate} disabled={recalculating} style={S.outlineBtn}>
          {recalculating
            ? (recalcProgress && recalcProgress.total > 0
                ? `Recalculating… ${recalcProgress.done}/${recalcProgress.total}`
                : 'Starting…')
            : '↻ Recalculate All Grades'}
        </button>
      </div>

      {error   && <div style={S.errorBox}>{error}</div>}
      {success && <div style={S.successBox}>{success}</div>}
      {recalculating && recalcProgress && recalcProgress.total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round((recalcProgress.done / recalcProgress.total) * 100))}%`,
              background: '#6366F1',
              transition: 'width 0.2s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            {recalcProgress.done} / {recalcProgress.total} results processed
          </div>
        </div>
      )}
      {!loading && schemes.length === 0 && !error && (
        <div style={{ ...S.errorBox, background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
          No grading schemes found in the database. Expected 2 seeded schemes (PG and UG). Check that the grading_schema.sql migration ran successfully.
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>PG Programs (MBA, MCA)</h3>
              {pgSchemes.length > 0 && (
                <button onClick={() => setNewSchemeBase(pgSchemes[pgSchemes.length - 1])} style={S.primaryBtn}>
                  + New PG Scheme
                </button>
              )}
            </div>
            {pgSchemes.map(s => (
              <SchemeCard key={s.id} scheme={s} onEdit={setEditScheme} onDeactivate={handleDeactivate} />
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>UG Programs (BBA, BCA)</h3>
              {ugSchemes.length > 0 && (
                <button onClick={() => setNewSchemeBase(ugSchemes[ugSchemes.length - 1])} style={S.primaryBtn}>
                  + New UG Scheme
                </button>
              )}
            </div>
            {ugSchemes.map(s => (
              <SchemeCard key={s.id} scheme={s} onEdit={setEditScheme} onDeactivate={handleDeactivate} />
            ))}
          </div>
        </>
      )}

      {editScheme && (
        <EditBandsModal
          scheme={editScheme}
          onClose={() => setEditScheme(null)}
          onSaved={() => { setEditScheme(null); setSuccess('Bands updated.'); load(); }}
        />
      )}
      {newSchemeBase && (
        <NewSchemeModal
          baseScheme={newSchemeBase}
          onClose={() => setNewSchemeBase(null)}
          onCreated={() => { setNewSchemeBase(null); setSuccess('New scheme created.'); load(); }}
        />
      )}
    </div>
  );
}
