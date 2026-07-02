import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import {
  fetchStudentResultSummaries, fetchResultsByStudent,
  fetchResultFilterOptions, fetchStudentStatusMap, STUDENT_STATUS_OPTIONS,
  PROGRAM_CODES, RESULT_COLORS,
} from '../../services/resultsService';

ModuleRegistry.registerModules([AllCommunityModule]);

const S = {
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  td:         { padding: '10px 14px', color: '#374151' },
};

function ResultBadge({ value }) {
  const c = RESULT_COLORS[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
      {value || '—'}
    </span>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

// ── Student Detail Panel ──────────────────────────────────────────────────────
function StudentDetailPanel({ student, onClose }) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetchResultsByStudent({ enrollment_no: student.enrollment_no })
      .then(setResults)
      .finally(() => setLoading(false));
  }, [student.enrollment_no]);

  // Group by semester
  const bySem = {};
  for (const r of results) {
    if (!bySem[r.semester]) bySem[r.semester] = [];
    bySem[r.semester].push(r);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 780, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{student.student_name || student.enrollment_no}</h3>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
              {student.enrollment_no} · {student.program_code} · {student.academic_year} · {student.batch}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        {/* Summary badges */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Subjects', value: student.total_subjects, color: '#6366F1' },
            { label: 'Passed',         value: student.passed,         color: '#10B981' },
            { label: 'Failed',         value: student.failed,         color: '#EF4444' },
            { label: 'Backlogs',       value: student.backlog_count,  color: '#F59E0B' },
          ].map(c => (
            <div key={c.label} style={{ flex: 1, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>Loading results…</div>
        ) : Object.keys(bySem).length === 0 ? (
          <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No results found.</div>
        ) : (
          Object.entries(bySem).sort(([a], [b]) => a - b).map(([sem, rows]) => (
            <div key={sem} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Semester {sem}
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>({rows.length} subjects)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Subject', 'Exam Month/Year', 'IA', 'ESE', 'Total', 'Result', 'Grade', 'Backlog', 'Stage'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: r.is_backlog ? '#FFF7ED' : 'white' }}>
                      <td style={{ padding: '8px 12px', fontWeight: r.is_backlog ? 600 : 400 }}>{r.course_name}</td>
                      <td style={{ padding: '8px 12px', color: '#92400E', fontSize: 12 }}>{r.exam_month_year || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{r.ia_marks ?? '—'}</td>
                      <td style={{ padding: '8px 12px', color: r.ese_marks === 'AB' ? '#DC2626' : '#374151', fontWeight: r.ese_marks === 'AB' ? 700 : 400 }}>
                        {r.ese_marks ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{r.total_marks ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}><ResultBadge value={r.result} /></td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.grade
                          ? <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{r.grade}</span>
                          : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.is_backlog
                          ? <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Backlog</span>
                          : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.result_stage === 'FINAL'
                          ? <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              Final{r.grace_marks_awarded > 0 ? ` (+${r.grace_marks_awarded})` : ''}
                            </span>
                          : <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Interim</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={S.outlineBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ResultByStudent() {
  const [summaries,     setSummaries]     = useState([]);
  const [filterOptions, setFilterOptions] = useState({ programs: [], academicYears: [], batches: [], semesters: [] });
  const [loading,       setLoading]       = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const gridRef = useRef();
  const [search,        setSearch]        = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear,    setFilterYear]    = useState('');
  const [filterBatch,  setFilterBatch]  = useState('');
  const [filterSem,     setFilterSem]     = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [showBacklogsOnly, setShowBacklogsOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, opts] = await Promise.all([
        // Don't pass batch/year to summary — we want ALL subjects counted per student
        // Filtering by batch/year happens on the list display level
        fetchStudentResultSummaries({
          program_code: filterProgram || undefined,
          semester:     filterSem     || undefined,
        }),
        fetchResultFilterOptions(),
      ]);
      // Apply batch and year filter on the client side for list display
      const filtered_ = s.filter(student => {
        if (filterBatch && student.batch !== filterBatch) return false;
        if (filterYear   && student.academic_year !== filterYear) return false;
        return true;
      });
      const statusMap = await fetchStudentStatusMap(filtered_.map(st => st.enrollment_no));
      setSummaries(filtered_.map(st => ({ ...st, student_status: statusMap[st.enrollment_no] || null })));
      setFilterOptions(opts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterProgram, filterYear, filterBatch, filterSem]);

  useEffect(() => { load(); }, [load]);

  const filtered = summaries.filter(s => {
    if (showBacklogsOnly && s.backlog_count === 0) return false;
    if (filterStatus && s.student_status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.enrollment_no?.toLowerCase().includes(q)
      || s.student_name?.toLowerCase().includes(q)
      || s.official_email?.toLowerCase().includes(q);
  });

  const totalBacklogStudents = summaries.filter(s => s.backlog_count > 0).length;
  const totalBacklogs        = summaries.reduce((a, s) => a + s.backlog_count, 0);

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Results by Student</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Click a student to view full result history across semesters</div>
        </div>
        <button
          onClick={load}
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
        >↻ Refresh</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Total Students"    value={summaries.length}      color="#6366F1" />
        <KpiCard label="With Backlogs"     value={totalBacklogStudents}  color="#F59E0B" />
        <KpiCard label="Total Backlogs"    value={totalBacklogs}         color="#EF4444" />
        <KpiCard label="Showing"           value={filtered.length}       color="#10B981" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search enrollment / name / email…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, width: 260, margin: 0 }}
        />
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Programs</option>
          {filterOptions.programs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterSem} onChange={e => setFilterSem(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Semesters</option>
          {filterOptions.semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Years</option>
          {filterOptions.academicYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.input, width: 120, margin: 0 }}>
          <option value="">All Batches</option>
          {filterOptions.batches.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: 130, margin: 0 }}>
          <option value="">All Statuses</option>
          {STUDENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setShowBacklogsOnly(b => !b)}
          style={{
            ...S.outlineBtn,
            background: showBacklogsOnly ? '#FEF3C7' : '#fff',
            borderColor: showBacklogsOnly ? '#F59E0B' : '#D1D5DB',
            color:       showBacklogsOnly ? '#92400E' : '#374151',
            fontWeight:  showBacklogsOnly ? 700 : 400,
          }}
        >
          {showBacklogsOnly ? '⚠ Backlogs Only' : 'All Students'}
        </button>
        {(() => {
          const hasFilters = !!(filterProgram || filterSem || filterYear || filterBatch || filterStatus || search || showBacklogsOnly);
          return (
            <button
              onClick={() => {
                setFilterProgram(''); setFilterSem(''); setFilterYear('');
                setFilterBatch(''); setFilterStatus(''); setSearch(''); setShowBacklogsOnly(false);
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
          );
        })()}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
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
            onRowClicked={e => setSelectedStudent(e.data)}
            rowStyle={{ cursor: 'pointer' }}
            getRowStyle={p => p.data?.backlog_count > 0 ? { background: '#FFFBEB' } : {}}
            style={{ height: '100%', width: '100%' }}
            onGridReady={p => p.api.sizeColumnsToFit()}
            onFirstDataRendered={p => p.api.sizeColumnsToFit()}
            columnDefs={[
              { headerName: 'Enrollment No', field: 'enrollment_no', minWidth: 150, flex: 1.5,
                cellStyle: { fontWeight: 700, color: '#111827', userSelect: 'text' } },
              { headerName: 'Name',     field: 'student_name',  minWidth: 160, flex: 2,
                valueFormatter: p => p.value || '—' },
              { headerName: 'Program',  field: 'program_code',  minWidth: 90, flex: 0.8,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                  : '—' },
              { headerName: 'Year',     field: 'academic_year', minWidth: 90, flex: 0.9, valueFormatter: p => p.value || '—' },
              { headerName: 'Status',   field: 'student_status', minWidth: 100, flex: 0.9, valueFormatter: p => p.value || '—' },
              { headerName: 'Batch',    field: 'batch',         minWidth: 100, flex: 0.9,
                cellRenderer: p => p.value
                  ? <span style={{ background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.value}</span>
                  : '—' },
              { headerName: 'Semesters', field: 'semesters', minWidth: 100, flex: 1,
                valueFormatter: p => (p.value || []).map(n => `Sem ${n}`).join(', ') },
              { headerName: 'Subjects', field: 'total_subjects', minWidth: 85,  flex: 0.8, type: 'numericColumn' },
              { headerName: 'Passed',   field: 'passed',         minWidth: 80,  flex: 0.8, type: 'numericColumn',
                cellStyle: p => ({ color: p.value > 0 ? '#166534' : '#374151', fontWeight: 600 }) },
              { headerName: 'Failed',   field: 'failed',         minWidth: 75,  flex: 0.8, type: 'numericColumn',
                cellStyle: p => ({ color: p.value > 0 ? '#DC2626' : '#374151', fontWeight: 600 }) },
              { headerName: 'Backlogs', field: 'backlog_count',  minWidth: 90,  flex: 0.8, type: 'numericColumn',
                cellRenderer: p => p.value > 0
                  ? <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{p.value}</span>
                  : <span style={{ color: '#9CA3AF' }}>0</span> },
              { headerName: '', field: '__view', minWidth: 75, flex: 0.6, sortable: false, filter: false,
                cellRenderer: () => <span style={{ color: '#6366F1', fontSize: 12 }}>View →</span> },
            ]}
          />
        </div>
      )}

      {selectedStudent && (
        <StudentDetailPanel
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
