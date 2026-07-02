import { useState, useEffect, useCallback } from 'react';
import {
  fetchPendingCycles, computeGraceReview, publishFinalResults,
  computeShortfallReport, updateActiveGracePolicyThreshold,
} from '../../services/graceMarksService';

const S = {
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  successBox: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  td:         { padding: '9px 12px', color: '#374151', fontSize: 13 },
  th:         { padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', fontSize: 12 },
};

const SLAB_COLUMNS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

export default function PublishResults() {
  const [cycles,        setCycles]        = useState([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [view,          setView]          = useState('list'); // 'list' | 'report' | 'review'
  const [selectedCycle, setSelectedCycle] = useState(null);

  // Review flow
  const [review,        setReview]        = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [approvedBy,    setApprovedBy]    = useState('');
  const [publishing,    setPublishing]    = useState(false);

  // Shortfall report flow
  const [report,           setReport]           = useState(null);
  const [loadingReport,    setLoadingReport]    = useState(false);
  const [threshold,        setThreshold]        = useState(3);
  const [applyingThreshold, setApplyingThreshold] = useState(false);
  const [applySuccess,     setApplySuccess]     = useState('');

  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const loadCycles = useCallback(async () => {
    setLoadingCycles(true);
    try {
      setCycles(await fetchPendingCycles());
    } catch (e) { setError(e.message || 'Failed to load pending exam cycles.'); }
    finally { setLoadingCycles(false); }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  function backToList() {
    setView('list'); setSelectedCycle(null); setReview(null); setReport(null);
    setError(''); setSuccess('');
  }

  async function openReport(cycle) {
    setSelectedCycle(cycle);
    setView('report');
    setReport(null);
    setApplySuccess('');
    setError(''); setSuccess('');
    setLoadingReport(true);
    try {
      const r = await computeShortfallReport({
        programCode:   cycle.program_code,
        semester:      cycle.semester,
        examMonthYear: cycle.exam_month_year,
      });
      setReport(r);
      setThreshold(r.policy?.marks_threshold ? Math.max(1, Math.min(9, Math.round(r.policy.marks_threshold))) : 3);
    } catch (e) {
      setError(e.message || 'Failed to compute shortfall report.');
    } finally {
      setLoadingReport(false);
    }
  }

  async function openReview(cycle) {
    setSelectedCycle(cycle);
    setView('review');
    setReview(null);
    setError(''); setSuccess('');
    setLoadingReview(true);
    try {
      const r = await computeGraceReview({
        programCode:   cycle.program_code,
        semester:      cycle.semester,
        examMonthYear: cycle.exam_month_year,
      });
      setReview(r);
      setSelectedIds(new Set(r.eligible.map(row => row.id)));
    } catch (e) {
      setError(e.message || 'Failed to compute grace-marks review.');
    } finally {
      setLoadingReview(false);
    }
  }

  function toggleRow(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePublish() {
    if (!selectedCycle) return;
    setPublishing(true); setError(''); setSuccess('');
    try {
      const { published, graceApplied } = await publishFinalResults({
        programCode:   selectedCycle.program_code,
        semester:      selectedCycle.semester,
        examMonthYear: selectedCycle.exam_month_year,
        approvedIds:   [...selectedIds],
        approvedBy:    approvedBy || null,
      });
      setSuccess(`✓ Published ${published} final result(s) — ${graceApplied} student(s) received grace marks.`);
      backToList();
      loadCycles();
    } catch (e) {
      setError(e.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleApplyThreshold() {
    if (!report?.policy) { setError('No active grace-marks policy found to update.'); return; }
    setApplyingThreshold(true); setError(''); setApplySuccess('');
    try {
      await updateActiveGracePolicyThreshold(report.policy.id, threshold);
      setApplySuccess(`✓ Grace marks threshold set to ${threshold} mark(s) short of pass. This takes effect immediately for Review & Publish on every cycle using this policy.`);
      setReport(r => ({ ...r, policy: { ...r.policy, marks_threshold: threshold } }));
    } catch (e) {
      setError(e.message || 'Failed to update the policy.');
    } finally {
      setApplyingThreshold(false);
    }
  }

  function eligibleCountAtThreshold(batch) {
    if (!report) return 0;
    const bucket = report.matrix[batch] || {};
    let sum = 0;
    for (let i = 1; i <= threshold; i++) sum += bucket[String(i)] || 0;
    return sum;
  }
  const totalEligibleAtThreshold = report ? report.batches.reduce((acc, b) => acc + eligibleCountAtThreshold(b), 0) : 0;
  const batchesAffectedAtThreshold = report ? report.batches.filter(b => eligibleCountAtThreshold(b) > 0).length : 0;

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Publish Results</h2>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
          Review the marks-shortfall distribution, decide a grace threshold, then review and publish final results for an exam cycle. Interim (system-generated) marks are kept permanently — publishing only adds a final layer on top.
        </div>
      </div>

      {error   && <div style={S.errorBox}>{error}</div>}
      {success && <div style={S.successBox}>{success}</div>}

      {view === 'list' && (
        <>
          <div style={S.infoBox}>
            Showing exam cycles (Program + Semester + Exam Month/Year) that still have INTERIM results awaiting review and publish.
          </div>
          {loadingCycles ? (
            <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
          ) : cycles.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 14, padding: 24, textAlign: 'center', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 }}>
              No exam cycles pending publish. Everything uploaded so far has already been finalized.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Program', 'Semester', 'Exam Month/Year', 'Batch(es)', 'Total Records', 'Failing', ''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cycles.map(c => (
                    <tr key={`${c.program_code}|${c.semester}|${c.exam_month_year}`} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ ...S.td, fontWeight: 700 }}>
                        <span style={{ background: '#EEF2FF', color: '#6366F1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{c.program_code}</span>
                      </td>
                      <td style={S.td}>Sem {c.semester}</td>
                      <td style={S.td}>
                        <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{c.exam_month_year}</span>
                      </td>
                      <td style={{ ...S.td, color: '#6B7280', fontSize: 12 }}>{c.batches.join(', ') || '—'}</td>
                      <td style={S.td}>{c.totalCount}</td>
                      <td style={S.td}>
                        {c.failingCount > 0
                          ? <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{c.failingCount}</span>
                          : <span style={{ color: '#9CA3AF' }}>0</span>}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openReport(c)} style={S.outlineBtn}>📊 Shortfall Report</button>
                          <button onClick={() => openReview(c)} style={S.primaryBtn}>Review & Publish →</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'report' && (
        <>
          <button onClick={backToList} style={{ ...S.outlineBtn, marginBottom: 16 }}>← Back to cycle list</button>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              {selectedCycle.program_code} · Semester {selectedCycle.semester} · {selectedCycle.exam_month_year}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
              Marks-shortfall distribution — see how many students are short by each mark count, per batch, before deciding a threshold.
            </div>
          </div>

          {loadingReport ? (
            <div style={{ color: '#6B7280', fontSize: 14 }}>Computing shortfall distribution…</div>
          ) : report && (
            <>
              <div style={S.infoBox}>
                {report.totalFailing} failing record(s) across {report.batches.length} batch(es). Counts below are the raw marks-shortfall distribution —
                the per-student max-subjects cap is only applied later, at Review &amp; Publish, not in this report.
              </div>

              {report.batches.length === 0 ? (
                <div style={{ color: '#9CA3AF', fontSize: 14, padding: 24, textAlign: 'center', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                  No failing records in this cycle.
                </div>
              ) : (
                <>
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'auto', marginBottom: 24 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          <th style={S.th}>Batch</th>
                          {SLAB_COLUMNS.map(s => (
                            <th key={s} style={{ ...S.th, textAlign: 'center', whiteSpace: 'nowrap' }}>{s} short</th>
                          ))}
                          <th style={{ ...S.th, textAlign: 'center' }}>Absent</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>IA-Min Fail</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>Other</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>Total Failing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.batches.map(b => {
                          const rowTotal = SLAB_COLUMNS.reduce((a, s) => a + (report.matrix[b]?.[s] || 0), 0)
                            + (report.absentCounts[b] || 0) + (report.iaMinCounts[b] || 0) + (report.otherCounts[b] || 0);
                          return (
                            <tr key={b} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ ...S.td, fontWeight: 700 }}>
                                <span style={{ background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{b}</span>
                              </td>
                              {SLAB_COLUMNS.map(s => {
                                const count = report.matrix[b]?.[s] || 0;
                                const within = s !== '10+' && parseInt(s) <= threshold;
                                return (
                                  <td key={s} style={{
                                    ...S.td, textAlign: 'center', fontWeight: count > 0 ? 700 : 400,
                                    background: within && count > 0 ? '#FEF9C3' : 'transparent',
                                    color: count > 0 ? '#111827' : '#D1D5DB',
                                  }}>
                                    {count || '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...S.td, textAlign: 'center', color: report.absentCounts[b] ? '#DC2626' : '#D1D5DB' }}>{report.absentCounts[b] || '—'}</td>
                              <td style={{ ...S.td, textAlign: 'center', color: report.iaMinCounts[b] ? '#DC2626' : '#D1D5DB' }}>{report.iaMinCounts[b] || '—'}</td>
                              <td style={{ ...S.td, textAlign: 'center', color: report.otherCounts[b] ? '#6B7280' : '#D1D5DB' }}>{report.otherCounts[b] || '—'}</td>
                              <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>{rowTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Choose a Grace Marks Threshold</div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                      <div>
                        <label style={S.label}>Marks Threshold</label>
                        <input
                          type="number" min={1} max={9} value={threshold}
                          onChange={e => setThreshold(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))}
                          style={{ ...S.input, width: 90 }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ fontSize: 13, color: '#374151' }}>
                          At <strong>{threshold} mark(s)</strong>: <strong style={{ color: '#F59E0B' }}>{totalEligibleAtThreshold}</strong> student-subject record(s)
                          {' '}across {batchesAffectedAtThreshold} batch(es) would become grace-eligible (before the per-student subject cap).
                        </div>
                        {report.policy && (
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            Current active policy: {report.policy.marks_threshold} mark(s) threshold, max {report.policy.max_subjects_per_student} subject(s) per student ({report.policy.cap_scope.toLowerCase()} cap).
                          </div>
                        )}
                      </div>
                    </div>

                    {applySuccess && <div style={S.successBox}>{applySuccess}</div>}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={handleApplyThreshold}
                        disabled={applyingThreshold || !report.policy}
                        style={{ ...S.primaryBtn, opacity: (applyingThreshold || !report.policy) ? 0.5 : 1, cursor: (applyingThreshold || !report.policy) ? 'not-allowed' : 'pointer' }}
                      >
                        {applyingThreshold ? 'Applying…' : `Apply ${threshold}-Mark Threshold as Policy`}
                      </button>
                      <button onClick={() => openReview(selectedCycle)} style={S.outlineBtn}>
                        Proceed to Review & Publish →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {view === 'review' && (
        <>
          <button onClick={backToList} style={{ ...S.outlineBtn, marginBottom: 16 }}>
            ← Back to cycle list
          </button>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              {selectedCycle.program_code} · Semester {selectedCycle.semester} · {selectedCycle.exam_month_year}
            </div>
          </div>

          {loadingReview ? (
            <div style={{ color: '#6B7280', fontSize: 14 }}>Computing grace-marks eligibility…</div>
          ) : review && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                <KpiCard label="Total Records"        value={review.totalRows}              color="#6366F1" />
                <KpiCard label="Already Passing"      value={review.passingCount}           color="#10B981" />
                <KpiCard label="Eligible for Grace"   value={review.eligible.length}         color="#F59E0B" />
                <KpiCard label="Failing — No Grace"   value={review.ineligible.length}       color="#EF4444" />
              </div>

              {review.eligible.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    Eligible for Grace Marks — checked rows will be moved to Pass on publish
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['', 'Enrollment No', 'Student', 'Subject', 'Total Marks', 'Pass Cutoff', 'Grace Marks Needed'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {review.eligible.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6', background: selectedIds.has(r.id) ? '#F0FDF4' : 'white' }}>
                            <td style={S.td}>
                              <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleRow(r.id)} />
                            </td>
                            <td style={{ ...S.td, fontWeight: 700 }}>{r.enrollment_no}</td>
                            <td style={S.td}>{r.student_name || '—'}</td>
                            <td style={S.td}>{r.course_name}</td>
                            <td style={S.td}>{r.total_marks}</td>
                            <td style={S.td}>{r.passCutoff}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#F59E0B' }}>+{r.gap}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {review.ineligible.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    Failing — Not Eligible for Grace
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Enrollment No', 'Student', 'Subject', 'Total Marks', 'Reason'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {review.ineligible.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ ...S.td, fontWeight: 700 }}>{r.enrollment_no}</td>
                            <td style={S.td}>{r.student_name || '—'}</td>
                            <td style={S.td}>{r.course_name}</td>
                            <td style={S.td}>{r.total_marks ?? '—'}</td>
                            <td style={{ ...S.td, color: '#DC2626', fontSize: 12 }}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ maxWidth: 280 }}>
                    <label style={S.label}>Approved By <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="Your name" />
                  </div>
                </div>
                <div style={S.infoBox}>
                  Publishing moves <strong>all {review.totalRows} record(s)</strong> in this exam cycle from Interim to Final —
                  {' '}{selectedIds.size} student(s) checked above will receive grace marks and pass;
                  everyone else (already-passing and un-graced failures) is finalized unchanged. This cannot be easily undone.
                </div>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  style={{ ...S.primaryBtn, background: '#059669', opacity: publishing ? 0.5 : 1, cursor: publishing ? 'not-allowed' : 'pointer' }}
                >
                  {publishing ? 'Publishing…' : `Approve & Publish Final Results (${review.totalRows} records)`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
