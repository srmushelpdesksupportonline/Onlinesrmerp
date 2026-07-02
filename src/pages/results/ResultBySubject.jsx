import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
  fetchResultsBySubject, fetchSubjectNames, fetchBacklogSummary,
  fetchResultFilterOptions, fetchStudentStatusMap, STUDENT_STATUS_OPTIONS,
  PROGRAM_CODES, RESULT_COLORS,
} from '../../services/resultsService';
import { formatINR } from '../../services/financeManagementService';

ModuleRegistry.registerModules([AllCommunityModule]);

const S = {
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  dangerBtn:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  td:         { padding: '10px 14px', color: '#374151' },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
};

function ResultBadge({ value }) {
  const c = RESULT_COLORS[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
      {value || '—'}
    </span>
  );
}

// ── Backlog Fee Modal ─────────────────────────────────────────────────────────
function BacklogFeeModal({ backlogStudents, filters, onClose }) {
  const [costPerPaper, setCostPerPaper] = useState('');
  const [payLinkBase,  setPayLinkBase]  = useState('https://pay.orangepay.in/srmus');

  const totalPapers = backlogStudents.reduce((s, b) => s + b.backlog_count, 0);
  const cost        = parseFloat(costPerPaper) || 0;

  // Build a summary for each student
  const rows = backlogStudents.map(b => ({
    ...b,
    fee: b.backlog_count * cost,
    payLink: cost > 0 && payLinkBase
      ? `${payLinkBase}?amount=${b.backlog_count * cost}&ref=${b.enrollment_no}&type=backlog`
      : null,
  }));

  function handleCopy() {
    const text = rows.map(r =>
      `${r.enrollment_no}\t${r.student_name || ''}\t${r.backlog_count}\t₹${r.fee}`
    ).join('\n');
    navigator.clipboard.writeText(text);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 800, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Backlog Fee Calculator</h3>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
              {backlogStudents.length} students · {totalPapers} total backlog papers
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        {/* Cost per paper input */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20, background: '#F9FAFB', padding: '16px 20px', borderRadius: 10, border: '1px solid #E5E7EB' }}>
          <div>
            <label style={S.label}>Cost per Paper (₹)</label>
            <input
              type="number" style={S.input} value={costPerPaper}
              onChange={e => setCostPerPaper(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label style={S.label}>Payment Link Base URL</label>
            <input style={S.input} value={payLinkBase} onChange={e => setPayLinkBase(e.target.value)} />
          </div>
        </div>

        {cost > 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Students with Backlogs', value: backlogStudents.length, color: '#F59E0B' },
              { label: 'Total Backlog Papers',   value: totalPapers,            color: '#EF4444' },
              { label: 'Total Fee to Collect',   value: formatINR(totalPapers * cost), color: '#6366F1' },
            ].map(c => (
              <div key={c.label} style={{ flex: 1, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={S.infoBox}>
          This is informational only. To send payment links, go to <strong>Finance → Generate Fee</strong> and select the backlog fee block.
          Use this table to verify amounts before generating.
        </div>

        {/* Student table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Enrollment No', 'Student', 'Program', 'Backlog Subjects', 'Papers', 'Fee Amount', 'Payment Link'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.enrollment_no} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ ...S.td, fontWeight: 700 }}>{r.enrollment_no}</td>
                <td style={S.td}>{r.student_name || '—'}</td>
                <td style={S.td}>
                  <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    {r.program_code}
                  </span>
                </td>
                <td style={S.td}>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {r.backlogs.map(b => `Sem ${b.semester}: ${b.course_name}`).join(', ')}
                  </div>
                </td>
                <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>
                  <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                    {r.backlog_count}
                  </span>
                </td>
                <td style={{ ...S.td, fontWeight: 700, color: cost > 0 ? '#111827' : '#9CA3AF' }}>
                  {cost > 0 ? formatINR(r.fee) : '—'}
                </td>
                <td style={S.td}>
                  {r.payLink
                    ? <a href={r.payLink} target="_blank" rel="noreferrer" style={{ color: '#6366F1', fontSize: 12, fontWeight: 600 }}>Link ↗</a>
                    : <span style={{ color: '#9CA3AF', fontSize: 12 }}>Enter cost above</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={handleCopy} style={S.outlineBtn}>📋 Copy Table</button>
          <button onClick={onClose} style={S.outlineBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ResultBySubject() {
  const [results,       setResults]       = useState([]);
  const [backlogStudents, setBacklogStudents] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ programs: [], academicYears: [], batches: [], semesters: [], examMonthYears: [] });
  const [subjectNames,  setSubjectNames]  = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [showBacklogModal, setShowBacklogModal] = useState(false);
  const gridRef = useRef();

  const [filterProgram,  setFilterProgram]  = useState('');
  const [filterSem,      setFilterSem]      = useState('');
  const [filterSubject,  setFilterSubject]  = useState('');
  const [filterYear,     setFilterYear]     = useState('');
  const [filterBatch,   setFilterBatch]   = useState('');
  const [filterExamDate, setFilterExamDate] = useState('');
  const [filterResult,   setFilterResult]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [search,         setSearch]         = useState('');

  // Load filter options once
  useEffect(() => {
    fetchResultFilterOptions().then(setFilterOptions).catch(console.error);
  }, []);

  // Load subject names when program+sem changes
  useEffect(() => {
    if (filterProgram || filterSem) {
      fetchSubjectNames(filterProgram, filterSem).then(setSubjectNames).catch(console.error);
    } else {
      setSubjectNames([]);
      setFilterSubject('');
    }
  }, [filterProgram, filterSem]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, bl] = await Promise.all([
        fetchResultsBySubject({
          program_code:    filterProgram  || undefined,
          semester:        filterSem      || undefined,
          course_name:     filterSubject  || undefined,
          academic_year:   filterYear     || undefined,
          batch:           filterBatch    || undefined,
          exam_month_year: filterExamDate || undefined,
          result:          filterResult   || undefined,
        }),
        fetchBacklogSummary({
          program_code:  filterProgram || undefined,
          semester:      filterSem     || undefined,
          academic_year: filterYear    || undefined,
          batch:         filterBatch   || undefined,
        }),
      ]);
      const statusMap = await fetchStudentStatusMap(res.map(r => r.enrollment_no));
      setResults(res.map(r => ({ ...r, student_status: statusMap[r.enrollment_no] || null })));
      setBacklogStudents(bl);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterProgram, filterSem, filterSubject, filterYear, filterBatch, filterExamDate, filterResult]);

  useEffect(() => { load(); }, [load]);

  const filtered = results.filter(r => {
    if (filterStatus && r.student_status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.enrollment_no?.toLowerCase().includes(q) || r.student_name?.toLowerCase().includes(q);
  });

  // Stats
  const passed  = filtered.filter(r => r.result === 'P').length;
  const failed  = filtered.filter(r => r.result === 'F').length;
  const absent  = filtered.filter(r => r.ese_marks === 'AB').length;
  const passRate = filtered.length > 0 ? Math.round((passed / filtered.length) * 100) : 0;

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Results by Subject</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Filter by program, semester and subject to view student performance</div>
        </div>
        {backlogStudents.length > 0 && (
          <button onClick={() => setShowBacklogModal(true)} style={S.dangerBtn}>
            ⚠ Backlog Fee — {backlogStudents.length} students
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={S.label}>Program</label>
          <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); setFilterSubject(''); }}
            style={{ ...S.input, width: 120, margin: 0 }}>
            <option value="">All</option>
            {filterOptions.programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Semester</label>
          <select value={filterSem} onChange={e => { setFilterSem(e.target.value); setFilterSubject(''); }}
            style={{ ...S.input, width: 120, margin: 0 }}>
            <option value="">All</option>
            {filterOptions.semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Subject</label>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            style={{ ...S.input, width: 220, margin: 0 }}>
            <option value="">All Subjects</option>
            {subjectNames.map(s => <option key={s.course_name} value={s.course_name}>{s.course_name}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Academic Year</label>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            style={{ ...S.input, width: 120, margin: 0 }}>
            <option value="">All</option>
            {filterOptions.academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Batch</label>
          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
            style={{ ...S.input, width: 110, margin: 0 }}>
            <option value="">All</option>
            {filterOptions.batches.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Exam Month/Year</label>
          <select value={filterExamDate} onChange={e => setFilterExamDate(e.target.value)}
            style={{ ...S.input, width: 140, margin: 0 }}>
            <option value="">All Attempts</option>
            {filterOptions.examMonthYears.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Result</label>
          <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
            style={{ ...S.input, width: 100, margin: 0 }}>
            <option value="">All</option>
            <option value="P">Pass</option>
            <option value="F">Fail</option>
          </select>
        </div>
        <div>
          <label style={S.label}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ ...S.input, width: 130, margin: 0 }}>
            <option value="">All</option>
            {STUDENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <input placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, width: 200, margin: 0 }} />
        </div>
        {(() => {
          const hasFilters = !!(filterProgram || filterSem || filterSubject || filterYear || filterBatch || filterExamDate || filterResult || filterStatus || search);
          return (
            <div style={{ alignSelf: 'flex-end' }}>
              <button
                onClick={() => {
                  setFilterProgram(''); setFilterSem(''); setFilterSubject('');
                  setFilterYear(''); setFilterBatch(''); setFilterExamDate(''); setFilterResult(''); setFilterStatus(''); setSearch('');
                }}
                disabled={!hasFilters}
                style={{
                  ...S.outlineBtn,
                  color:       hasFilters ? '#DC2626' : '#9CA3AF',
                  borderColor: hasFilters ? '#FECACA'  : '#E5E7EB',
                  cursor:      hasFilters ? 'pointer'  : 'default',
                }}
              >
                ✕ Reset Filters
              </button>
            </div>
          );
        })()}
      </div>

      {/* Stats bar */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total',     value: filtered.length, color: '#6366F1' },
            { label: 'Passed',    value: passed,          color: '#10B981' },
            { label: 'Failed',    value: failed,          color: '#EF4444' },
            { label: 'Absent',    value: absent,          color: '#F59E0B' },
            { label: 'Pass Rate', value: `${passRate}%`,  color: '#0EA5E9' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            ref={gridRef}
            theme={themeQuartz.withParams({ fontSize: '12px', rowHeight: 36, headerHeight: 38 })}
            rowData={filtered}
            pagination
            paginationPageSize={50}
            paginationPageSizeSelector={[20, 50, 100, 200]}
            rowHeight={36}
            headerHeight={38}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            getRowStyle={p => p.data?.is_backlog ? { background: '#FFFBEB' } : {}}
            style={{ height: '100%', width: '100%' }}
            onGridReady={p => p.api.sizeColumnsToFit()}
            onFirstDataRendered={p => p.api.sizeColumnsToFit()}
            columnDefs={[
              { headerName: 'Enrollment No', field: 'enrollment_no', minWidth: 150, flex: 1.5,
                cellStyle: { fontWeight: 700, color: '#111827', userSelect: 'text' } },
              { headerName: 'Student',  field: 'student_name',  minWidth: 160, flex: 2,   valueFormatter: p => p.value || '—' },
              { headerName: 'Program',  field: 'program_code',  minWidth: 90,  flex: 0.8,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                  : '—' },
              { headerName: 'Year',     field: 'academic_year', minWidth: 90,  flex: 0.9, valueFormatter: p => p.value || '—' },
              { headerName: 'Batch',    field: 'batch',         minWidth: 90,  flex: 0.9,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.value}</span>
                  : '—' },
              { headerName: 'Semester', field: 'semester',      minWidth: 100, flex: 0.9, valueFormatter: p => p.value ? `Sem ${p.value}` : '—' },
              { headerName: 'Subject',  field: 'course_name',   minWidth: 180, flex: 2.5 },
              { headerName: 'Exam Month/Year', field: 'exam_month_year', minWidth: 130, flex: 1.1,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.value}</span>
                  : '—' },
              { headerName: 'IA',       field: 'ia_marks',      minWidth: 65,  flex: 0.6, valueFormatter: p => p.value ?? '—' },
              { headerName: 'ESE',      field: 'ese_marks',     minWidth: 65,  flex: 0.6,
                cellStyle: p => ({ color: p.value === 'AB' ? '#DC2626' : '#374151', fontWeight: p.value === 'AB' ? 700 : 400 }),
                valueFormatter: p => p.value ?? '—' },
              { headerName: 'Total',    field: 'total_marks',   minWidth: 75,  flex: 0.7,
                cellStyle: { fontWeight: 600 }, valueFormatter: p => p.value ?? '—' },
              { headerName: 'Result',   field: 'result',        minWidth: 90,  flex: 0.8,
                cellRenderer: p => {
                  const colors = { P: { bg: '#DCFCE7', text: '#166534' }, F: { bg: '#FEF2F2', text: '#DC2626' } };
                  const c = colors[p.value] || { bg: '#F3F4F6', text: '#6B7280' };
                  return p.value
                    ? <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                    : <span style={{ color: '#9CA3AF' }}>—</span>;
                }},
              { headerName: 'Grade',    field: 'grade',          minWidth: 80,  flex: 0.7,
                cellRenderer: p => {
                  const colors = {
                    O: { bg: '#DCFCE7', text: '#166534' }, 'A+': { bg: '#DCFCE7', text: '#166534' },
                    A: { bg: '#D1FAE5', text: '#047857' }, 'B+': { bg: '#E0F2FE', text: '#0369A1' },
                    B: { bg: '#E0F2FE', text: '#0369A1' }, C: { bg: '#FEF9C3', text: '#854D0E' },
                    P: { bg: '#FEF3C7', text: '#92400E' }, F: { bg: '#FEF2F2', text: '#DC2626' },
                    Ab: { bg: '#FEF2F2', text: '#DC2626' }, N: { bg: '#F3F4F6', text: '#6B7280' },
                  };
                  const c = colors[p.value] || { bg: '#F3F4F6', text: '#6B7280' };
                  return p.value
                    ? <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                    : <span style={{ color: '#9CA3AF' }}>—</span>;
                }},
              { headerName: 'Backlog',  field: 'is_backlog',    minWidth: 90,  flex: 0.8,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Backlog</span>
                  : <span style={{ color: '#9CA3AF' }}>—</span> },
              { headerName: 'Status',   field: 'student_status', minWidth: 100, flex: 0.9,
                valueFormatter: p => p.value || '—' },
              { headerName: 'Stage',    field: 'result_stage',  minWidth: 90,  flex: 0.8,
                cellRenderer: p => {
                  const isFinal = p.value === 'FINAL';
                  return <span style={{ background: isFinal ? '#DCFCE7' : '#F3F4F6', color: isFinal ? '#166534' : '#6B7280', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{isFinal ? 'Final' : 'Interim'}</span>;
                } },
              { headerName: 'Grace Marks', field: 'grace_marks_awarded', minWidth: 100, flex: 0.9,
                cellRenderer: p => p.value > 0
                  ? <span style={{ background: '#FEF9C3', color: '#854D0E', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>+{p.value}</span>
                  : <span style={{ color: '#9CA3AF' }}>—</span> },
              { headerName: 'Final Result', field: 'final_result', minWidth: 100, flex: 0.9,
                cellRenderer: p => {
                  const colors = { P: { bg: '#DCFCE7', text: '#166534' }, F: { bg: '#FEF2F2', text: '#DC2626' } };
                  const c = colors[p.value] || { bg: '#F3F4F6', text: '#6B7280' };
                  return p.value
                    ? <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                    : <span style={{ color: '#9CA3AF' }}>—</span>;
                }},
            ]}
          />
        </div>
      )}

      {showBacklogModal && (
        <BacklogFeeModal
          backlogStudents={backlogStudents}
          filters={{ filterProgram, filterSem, filterYear, filterBatch }}
          onClose={() => setShowBacklogModal(false)}
        />
      )}
    </div>
  );
}
