import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
  fetchBatches,
  fetchBatchRecords,
  triggerReregistrationBatch,
  markDormantStudents,
} from '../services/reregistrationService';
import { supabase } from '../supabaseClient';

ModuleRegistry.registerModules([AllCommunityModule]);

const PROGRAMS   = ['MBA','MCA','BBA','BCA'];
const INTAKES    = ['JAN','JUL'];
const ACE_YEARS  = ['2024-25','2025-26','2026-27'];
const SEMESTERS  = [1,2,3,4,5,6];

const REREG_STATUS = {
  not_initiated: { label: 'Not Initiated', bg: '#f3f4f6', text: '#6b7280'  },
  pending:       { label: 'Pending',        bg: '#fef9c3', text: '#854d0e'  },
  dormant:       { label: 'Dormant',        bg: '#fee2e2', text: '#991b1b'  },
  completed:     { label: 'Completed',      bg: '#d1fae5', text: '#065f46'  },
};

function StatusBadge({ value }) {
  const s = REREG_STATUS[value] || REREG_STATUS.not_initiated;
  return (
    <span style={{ background: s.bg, color: s.text, padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ── Trigger Modal ─────────────────────────────────────────────────────────────
function TriggerModal({ selectedStudents, onClose, onDone }) {
  const [form, setForm] = useState({
    triggeredBy:    '',
    deadline:       '',
    targetSemester: '',
    academicYear:   '2025-26',
    notes:          '',
  });
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSend() {
    if (!form.triggeredBy || !form.deadline || !form.targetSemester || !form.academicYear) {
      setError('Please fill all required fields.'); return;
    }
    setSending(true); setError('');
    try {
      const res = await triggerReregistrationBatch({
        triggeredBy:    form.triggeredBy,
        deadline:       form.deadline,
        targetSemester: Number(form.targetSemester),
        academicYear:   form.academicYear,
        notes:          form.notes || null,
        selectedStudentIds: selectedStudents.map(s => s.id),
      });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const resendConfigured = !!import.meta.env.VITE_RESEND_API_KEY;

  if (result) {
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, width: 460 }}>
          <h3 style={{ margin: '0 0 20px' }}>Re-Registration Triggered ✓</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#d1fae5', borderRadius: 8, padding: 16, textAlign: 'center', color: '#065f46' }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{result.sent}</div>
              <div style={{ fontSize: 12 }}>Records Created</div>
            </div>
            <div style={{ background: '#fee2e2', borderRadius: 8, padding: 16, textAlign: 'center', color: '#991b1b' }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{result.errors.length}</div>
              <div style={{ fontSize: 12 }}>Failed</div>
            </div>
          </div>
          {!resendConfigured && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14, color: '#92400e' }}>
              ⚠️ <strong>VITE_RESEND_API_KEY not set</strong> — emails were not sent. Records created in Supabase. Add key to <code>.env</code> to enable emails.
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 100, overflowY: 'auto', marginBottom: 14 }}>
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onDone} style={S.primaryBtn}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Trigger Re-Registration</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        <div style={{ background: '#f0f2e8', border: '1px solid #e8ead4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#374151' }}>
          Sending to <strong>{selectedStudents.length}</strong> selected student{selectedStudents.length !== 1 ? 's' : ''}.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={S.fg}>
            <label style={S.label}>Triggered By *</label>
            <input value={form.triggeredBy} onChange={e => set('triggeredBy', e.target.value)} placeholder="Your name" style={S.input} />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Academic Year *</label>
            <select value={form.academicYear} onChange={e => set('academicYear', e.target.value)} style={S.input}>
              {ACE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Target Semester (next sem) *</label>
            <select value={form.targetSemester} onChange={e => set('targetSemester', e.target.value)} style={S.input}>
              <option value="">Select</option>
              {[2,3,4,5,6].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Last Date to Respond *</label>
            <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} style={S.input} min={new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        <div style={{ ...S.fg, marginBottom: 16 }}>
          <label style={S.label}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="e.g. Semester 2 re-registration — July 2025 batch" />
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSend} disabled={sending} style={S.primaryBtn}>
            {sending ? 'Processing…' : `📧 Send to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function ReRegistration() {
  const gridRef = useRef();
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedRows,  setSelectedRows]  = useState([]);
  const [showTrigger,   setShowTrigger]   = useState(false);
  const [markingDormant,setMarkingDormant]= useState(false);

  // Filters
  const [filterYear,    setFilterYear]    = useState('');
  const [filterCourse,  setFilterCourse]  = useState('');
  const [filterIntake,  setFilterIntake]  = useState('');
  const [filterSem,     setFilterSem]     = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

  // Load students with their latest re-registration status
  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active students
      let q = supabase
        .from('student_master')
        .select(`
          id, enrollment_no, full_name, official_email,
          program_name, intake, intake_year, academic_year,
          current_semester, student_status,
          programs(program_code)
        `)
        .eq('student_status', 'ENROLLED')
        .order('enrollment_no');

      if (filterCourse)  q = q.ilike('program_name', `%${filterCourse}%`);
      if (filterIntake)  q = q.eq('intake', filterIntake);
      if (filterYear)    q = q.eq('intake_year', Number(filterYear));
      if (filterSem)     q = q.eq('current_semester', Number(filterSem));

      const { data: studentData, error } = await q;
      if (error) throw error;

      // Fetch latest re-registration record per student
      const { data: reregData } = await supabase
        .from('reregistration_records')
        .select('student_id, form_status, choice, submitted_at, batch_id, reregistration_batches(deadline, target_semester)')
        .order('created_at', { ascending: false });

      // Map latest record per student
      const reregMap = {};
      for (const r of reregData || []) {
        if (!reregMap[r.student_id]) reregMap[r.student_id] = r;
      }

      // Merge
      const merged = (studentData || []).map(s => {
        const rec = reregMap[s.id];
        let reregStatus = 'not_initiated';
        if (rec) {
          if (rec.form_status === 'submitted') reregStatus = 'completed';
          else if (rec.form_status === 'dormant') reregStatus = 'dormant';
          else reregStatus = 'pending';
        }
        return {
          ...s,
          program_code:   s.programs?.program_code || '',
          rereg_status:   reregStatus,
          rereg_choice:   rec?.choice || null,
          rereg_deadline: rec?.reregistration_batches?.deadline || null,
          rereg_target_sem: rec?.reregistration_batches?.target_semester || null,
          rereg_submitted_at: rec?.submitted_at || null,
        };
      });

      // Filter by rereg status client-side
      const filtered = filterStatus
        ? merged.filter(s => s.rereg_status === filterStatus)
        : merged;

      setStudents(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterCourse, filterIntake, filterYear, filterSem, filterStatus]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Auto-mark dormant for past-deadline pending records
  async function handleMarkDormant() {
    if (!window.confirm('Mark all pending students whose deadline has passed as Dormant?')) return;
    setMarkingDormant(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Get all active batches past deadline
      const { data: batches } = await supabase
        .from('reregistration_batches')
        .select('id, deadline')
        .lt('deadline', today)
        .eq('status', 'active');

      let total = 0;
      for (const b of batches || []) {
        const count = await markDormantStudents(b.id);
        total += count;
      }
      alert(`${total} student(s) marked as Dormant.`);
      await loadStudents();
    } catch (e) {
      alert(e.message);
    } finally {
      setMarkingDormant(false);
    }
  }

  const columnDefs = [
    {
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 44, pinned: 'left',
      sortable: false, filter: false, resizable: false,
    },
    {
      headerName: 'Enrollment No', field: 'enrollment_no',
      pinned: 'left', minWidth: 150,
      cellStyle: { fontFamily: 'monospace', fontSize: 12, fontWeight: 600 },
    },
    {
      headerName: 'Name', field: 'full_name',
      minWidth: 180, flex: 1,
    },
    {
      headerName: 'Official Email', field: 'official_email',
      minWidth: 220, flex: 1,
      cellStyle: { fontSize: 12 },
    },
    {
      headerName: 'Course', field: 'program_code',
      width: 90,
      cellRenderer: p => p.value
        ? <span style={{ background: '#e8ead4', color: '#2d3a0e', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{p.value}</span>
        : '—',
    },
    {
      headerName: 'Year', field: 'intake_year',
      width: 90, cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Intake', field: 'intake',
      width: 90, cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Current Sem', field: 'current_semester',
      width: 110, cellStyle: { textAlign: 'center', fontWeight: 600 },
    },
    {
      headerName: 'Re-Reg Status', field: 'rereg_status',
      width: 150,
      cellRenderer: p => <StatusBadge value={p.value} />,
      cellStyle: { display: 'flex', alignItems: 'center' },
    },
    {
      headerName: 'Choice', field: 'rereg_choice',
      width: 170,
      valueFormatter: p => {
        const map = { continue: 'Continue next sem', break: '6-month break', repeat: 'Repeat semester' };
        return map[p.value] || '—';
      },
      cellStyle: p => ({
        fontSize: 12,
        color: p.value === 'continue' ? '#065f46' : p.value === 'break' ? '#92400e' : p.value === 'repeat' ? '#5b21b6' : '#9ca3af',
        fontWeight: p.value ? 600 : 400,
      }),
    },
    {
      headerName: 'Target Sem', field: 'rereg_target_sem',
      width: 110, cellStyle: { textAlign: 'center' },
      valueFormatter: p => p.value ? `Sem ${p.value}` : '—',
    },
    {
      headerName: 'Deadline', field: 'rereg_deadline',
      width: 120,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('en-IN') : '—',
      cellStyle: p => ({
        color: p.value && new Date(p.value).toISOString().split('T')[0] < new Date().toISOString().split('T')[0]
          ? '#dc2626' : '#374151',
        fontSize: 12,
      }),
    },
    {
      headerName: 'Submitted At', field: 'rereg_submitted_at',
      width: 130,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('en-IN') : '—',
      cellStyle: { fontSize: 12, color: '#6b7280' },
    },
  ];

  const selectedCount = selectedRows.length;

  // Summary counts
  const counts = {
    not_initiated: students.filter(s => s.rereg_status === 'not_initiated').length,
    pending:       students.filter(s => s.rereg_status === 'pending').length,
    completed:     students.filter(s => s.rereg_status === 'completed').length,
    dormant:       students.filter(s => s.rereg_status === 'dormant').length,
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f4f5f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e8ead4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1f0c' }}>Re-Registration</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Manage semester re-registration for active students
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleMarkDormant}
            disabled={markingDormant}
            style={{ ...S.outlineBtn, borderColor: '#fca5a5', color: '#991b1b' }}
          >
            {markingDormant ? 'Marking…' : 'Mark Dormant (Past Deadline)'}
          </button>
          <button
            onClick={() => setShowTrigger(true)}
            disabled={selectedCount === 0}
            style={{
              ...S.primaryBtn,
              opacity: selectedCount === 0 ? 0.45 : 1,
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}
            title={selectedCount === 0 ? 'Select students first' : `Trigger for ${selectedCount} students`}
          >
            📧 Trigger Re-Registration {selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
        </div>
      </div>

      {/* ── Summary Pills ── */}
      <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e8ead4', display: 'flex', gap: 10, flexShrink: 0 }}>
        {Object.entries(counts).map(([status, count]) => {
          const st = REREG_STATUS[status];
          return (
            <div
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
              style={{
                background: filterStatus === status ? st.bg : '#f8f9f4',
                color: filterStatus === status ? st.text : '#6b7280',
                border: `1px solid ${filterStatus === status ? st.text + '40' : '#e8ead4'}`,
                borderRadius: 20, padding: '4px 14px', fontSize: 13, cursor: 'pointer',
                fontWeight: filterStatus === status ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontWeight: 700 }}>{count}</span> {st.label}
            </div>
          );
        })}
        <div style={{ marginLeft: 4, fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
          Total: <strong style={{ marginLeft: 4, color: '#374151' }}>{students.length}</strong>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e8ead4', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={S.filterSel}>
          <option value="">All Years</option>
          {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} style={S.filterSel}>
          <option value="">All Courses</option>
          {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterIntake} onChange={e => setFilterIntake(e.target.value)} style={S.filterSel}>
          <option value="">All Intakes</option>
          {INTAKES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterSem} onChange={e => setFilterSem(e.target.value)} style={S.filterSel}>
          <option value="">All Semesters</option>
          {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        {(filterYear || filterCourse || filterIntake || filterSem || filterStatus) && (
          <button
            onClick={() => { setFilterYear(''); setFilterCourse(''); setFilterIntake(''); setFilterSem(''); setFilterStatus(''); }}
            style={{ ...S.outlineBtn, fontSize: 12, padding: '6px 12px' }}
          >
            Clear Filters
          </button>
        )}
        {selectedCount > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#3d4f12', fontWeight: 600 }}>
            {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, padding: '0 24px 24px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            ref={gridRef}
            theme={themeQuartz.withParams({ fontSize: '13px', rowHeight: 38, headerHeight: 40 })}
            rowData={students}
            columnDefs={columnDefs}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            rowSelection="multiple"
            suppressRowClickSelection
            onSelectionChanged={e => setSelectedRows(e.api.getSelectedRows())}
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            loading={loading}
            enableCellTextSelection
            domLayout="normal"
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </div>

      {showTrigger && (
        <TriggerModal
          selectedStudents={selectedRows}
          onClose={() => setShowTrigger(false)}
          onDone={() => { setShowTrigger(false); loadStudents(); }}
        />
      )}
    </div>
  );
}

const S = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#fff', borderRadius: 14, padding: 28, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  closeBtn:  { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  input:     { width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  fg:        { display: 'flex', flexDirection: 'column', gap: 5 },
  label:     { fontSize: 12, fontWeight: 600, color: '#374151' },
  primaryBtn:{ background: '#3d4f12', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' },
  outlineBtn:{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  filterSel: { padding: '7px 10px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit', minWidth: 130 },
};
