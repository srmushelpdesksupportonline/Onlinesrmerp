import { supabase } from '../supabaseClient';
import { getApplicableScheme, getProgramType, calculateGrade, batchIsAtOrAfter, batchSortKey } from './gradingService';

// IA is out of 30 across the app (see gradingService.calculateGrade default) — kept
// consistent here for the "IA below 50% overrides to F" exclusion check.
const IA_MAX_DEFAULT = 30;

// ─────────────────────────────────────────────────────────────────────────────
// GRACE MARKS POLICY (versioned, same effective_from_batch pattern as
// grading_schemes — see gradingService.getApplicableScheme)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllGracePolicies() {
  const { data, error } = await supabase
    .from('grace_marks_policy')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Find the applicable grace-marks policy for a given batch. Picks the LATEST
 * policy (by effective_from_batch) that is <= the batch. A policy with
 * effective_from_batch = NULL applies "from the beginning" (lowest priority).
 */
export async function fetchActiveGracePolicy(batch) {
  const { data, error } = await supabase
    .from('grace_marks_policy')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;

  const candidates = (data || []).filter(p =>
    p.effective_from_batch === null || batchIsAtOrAfter(batch, p.effective_from_batch)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => batchSortKey(b.effective_from_batch) - batchSortKey(a.effective_from_batch));
  return candidates[0];
}

/** Update the marks_threshold on an existing policy row (used by the Shortfall Report's "Apply" action). */
export async function updateActiveGracePolicyThreshold(policyId, marksThreshold) {
  const { error } = await supabase
    .from('grace_marks_policy')
    .update({ marks_threshold: marksThreshold })
    .eq('id', policyId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE ROW FETCH — batched to bypass Supabase's default 1000-row query cap
// (see fetchPendingCycles / other services for the same pattern)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCycleRows({ programCode, semester, examMonthYear }) {
  const BATCH = 1000;
  let all = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('student_results')
      .select('*')
      .eq('program_code', programCode)
      .eq('semester', parseInt(semester))
      .eq('exam_month_year', examMonthYear)
      .eq('result_stage', 'INTERIM')
      .range(from, from + BATCH - 1);
    if (error) throw error;
    const chunk = data || [];
    all = [...all, ...chunk];
    hasMore = chunk.length === BATCH;
    from += BATCH;
    if (from > 50000) break;
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/** Lowest min_percent among the scheme's non-F bands = the pass cutoff. */
function passCutoffFor(scheme) {
  const passBands = (scheme?.bands || []).filter(b => b.letter_grade !== 'F' && b.min_percent !== null);
  if (passBands.length === 0) return null;
  return Math.min(...passBands.map(b => parseFloat(b.min_percent)));
}

function isFailedDueToIaMinimum(scheme, row) {
  const iaRule = (scheme?.bands || []).find(b => b.special_rule === 'ia_min_50_required');
  if (!iaRule) return false;
  if (row.ia_marks === null || row.ia_marks === undefined) return false;
  return (row.ia_marks / IA_MAX_DEFAULT) * 100 < 50;
}

/**
 * Evaluate a single failing student_results row for grace-marks eligibility,
 * against the total_marks vs. the scheme's pass cutoff (per the locked design:
 * eligibility is based on total marks, not ESE-only).
 */
function evaluateRow(scheme, row, marksThreshold) {
  if (row.ese_marks === 'AB') {
    return { eligible: false, reason: 'Absent (AB) in ESE — no marks to award grace on' };
  }
  if (row.total_marks === null || row.total_marks === undefined) {
    return { eligible: false, reason: 'No total marks recorded' };
  }
  if (!scheme || !scheme.bands || scheme.bands.length === 0) {
    return { eligible: false, reason: 'No applicable grading scheme found for this batch/program' };
  }
  if (isFailedDueToIaMinimum(scheme, row)) {
    return { eligible: false, reason: 'Failed due to IA below the 50% minimum requirement — grace marks on total cannot fix this' };
  }
  const passCutoff = passCutoffFor(scheme);
  if (passCutoff === null) {
    return { eligible: false, reason: 'No passing band defined in this grading scheme' };
  }
  const gap = passCutoff - parseFloat(row.total_marks);
  if (gap <= 0) {
    return { eligible: false, reason: 'Already at or above the pass cutoff' };
  }
  if (gap > marksThreshold) {
    return { eligible: false, reason: `Short by ${gap} mark(s) — exceeds the grace threshold of ${marksThreshold}` };
  }
  return { eligible: true, passCutoff, gap };
}

/**
 * Build the grace-marks review for one exam cycle (program + semester + exam_month_year).
 * Returns every currently-failing INTERIM row in the cycle, split into:
 *   - eligible:   within the marks threshold AND within the per-student subject cap
 *   - ineligible: everything else, each with a human-readable `reason`
 * Passing rows are not evaluated individually but their count is included, since
 * publishing moves the WHOLE cycle (pass + fail) to FINAL together.
 */
export async function computeGraceReview({ programCode, semester, examMonthYear }) {
  if (!programCode || !semester || !examMonthYear) {
    throw new Error('programCode, semester and examMonthYear are required.');
  }

  const rows = await fetchCycleRows({ programCode, semester, examMonthYear });
  const failingRows = rows.filter(r => r.result === 'F');
  const passingCount = rows.length - failingRows.length;

  if (failingRows.length === 0) {
    return { totalRows: rows.length, passingCount, failingCount: 0, eligible: [], ineligible: [] };
  }

  const programType = getProgramType(programCode);
  const schemeCache = {};
  async function schemeFor(batch) {
    const key = batch || '__null__';
    if (!(key in schemeCache)) schemeCache[key] = await getApplicableScheme(programType, batch);
    return schemeCache[key];
  }
  const policyCache = {};
  async function policyFor(batch) {
    const key = batch || '__null__';
    if (!(key in policyCache)) policyCache[key] = await fetchActiveGracePolicy(batch);
    return policyCache[key];
  }

  const evaluated = [];
  for (const row of failingRows) {
    const policy = await policyFor(row.batch);
    if (!policy) {
      evaluated.push({ ...row, eligible: false, reason: 'No active grace-marks policy configured' });
      continue;
    }
    const scheme = await schemeFor(row.batch);
    const outcome = evaluateRow(scheme, row, parseFloat(policy.marks_threshold));
    evaluated.push({ ...row, ...outcome, policy });
  }

  // Enforce the per-student subject cap according to each row's policy.cap_scope.
  const byStudent = {};
  for (const r of evaluated) {
    if (!r.eligible) continue;
    (byStudent[r.enrollment_no] ||= []).push(r);
  }

  for (const enrollmentNo of Object.keys(byStudent)) {
    const studentRows = byStudent[enrollmentNo].sort((a, b) => a.gap - b.gap); // smallest gap first
    const policy = studentRows[0].policy;
    const maxSubjects = policy.max_subjects_per_student;
    const capScope = policy.cap_scope;

    let alreadyUsed = 0;
    if (capScope === 'SEMESTER') {
      const { count } = await supabase.from('student_results').select('id', { count: 'exact', head: true })
        .eq('enrollment_no', enrollmentNo).eq('semester', parseInt(semester)).gt('grace_marks_awarded', 0);
      alreadyUsed = count || 0;
    } else if (capScope === 'CUMULATIVE') {
      const { count } = await supabase.from('student_results').select('id', { count: 'exact', head: true })
        .eq('enrollment_no', enrollmentNo).gt('grace_marks_awarded', 0);
      alreadyUsed = count || 0;
    }
    // CYCLE scope needs no historical lookup — the cap applies fresh within this cycle's list.

    const remainingSlots = Math.max(0, maxSubjects - alreadyUsed);
    studentRows.forEach((r, i) => {
      if (i >= remainingSlots) {
        r.eligible = false;
        r.reason = `Exceeds max ${maxSubjects} grace-marks subject(s) per student (${capScope.toLowerCase()} cap)`;
      }
    });
  }

  return {
    totalRows: rows.length,
    passingCount,
    failingCount: failingRows.length,
    eligible:   evaluated.filter(r => r.eligible),
    ineligible: evaluated.filter(r => !r.eligible),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PENDING CYCLES — exam cycles that still have INTERIM results
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPendingCycles() {
  const BATCH = 1000;
  let all = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('student_results')
      .select('program_code, semester, exam_month_year, batch, result')
      .eq('result_stage', 'INTERIM')
      .range(from, from + BATCH - 1);
    if (error) throw error;
    const chunk = data || [];
    all = [...all, ...chunk];
    hasMore = chunk.length === BATCH;
    from += BATCH;
    if (from > 50000) break;
  }

  const map = {};
  for (const r of all) {
    const key = `${r.program_code}|${r.semester}|${r.exam_month_year}`;
    if (!map[key]) {
      map[key] = {
        program_code: r.program_code, semester: r.semester, exam_month_year: r.exam_month_year,
        batches: new Set(), totalCount: 0, failingCount: 0,
      };
    }
    map[key].batches.add(r.batch);
    map[key].totalCount++;
    if (r.result === 'F') map[key].failingCount++;
  }

  return Object.values(map)
    .map(c => ({ ...c, batches: [...c.batches].filter(Boolean) }))
    .sort((a, b) => a.program_code.localeCompare(b.program_code) || a.semester - b.semester);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH FINAL RESULTS — moves the WHOLE exam cycle from INTERIM to FINAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish final results for one exam cycle. Every INTERIM row in scope moves to
 * FINAL: rows in `approvedIds` get grace marks applied (recomputed server-side,
 * not trusted from the client) and their final_* fields recalculated; every other
 * row (already-passing, or failing-but-not-graced) is copied through unchanged.
 * The original total_marks/result/grade columns are NEVER modified — they remain
 * the permanent interim (system-generated) record for future reference.
 */
export async function publishFinalResults({ programCode, semester, examMonthYear, approvedIds, approvedBy }) {
  if (!programCode || !semester || !examMonthYear) {
    throw new Error('programCode, semester and examMonthYear are required.');
  }

  const rows = await fetchCycleRows({ programCode, semester, examMonthYear });

  const approvedSet = new Set(approvedIds || []);
  const now = new Date().toISOString();
  const programType = getProgramType(programCode);
  const schemeCache = {};
  async function schemeFor(batch) {
    const key = batch || '__null__';
    if (!(key in schemeCache)) schemeCache[key] = await getApplicableScheme(programType, batch);
    return schemeCache[key];
  }

  const updates = [];
  for (const row of rows || []) {
    if (approvedSet.has(row.id)) {
      const scheme = await schemeFor(row.batch);
      const passCutoff = passCutoffFor(scheme);
      const graceAwarded = passCutoff !== null
        ? Math.max(0, passCutoff - parseFloat(row.total_marks))
        : 0;
      const finalTotal = parseFloat(row.total_marks) + graceAwarded;
      const grade = await calculateGrade({
        programCode: row.program_code, batch: row.batch,
        iaMarks: row.ia_marks, eseMarks: row.ese_marks, totalMarks: finalTotal,
      });
      updates.push({
        id: row.id,
        grace_marks_awarded: graceAwarded,
        final_total_marks:   finalTotal,
        final_result:        'P',
        final_grade:         grade?.letter || null,
        result_stage:        'FINAL',
        published_at:        now,
        published_by:        approvedBy || null,
      });
    } else {
      updates.push({
        id: row.id,
        grace_marks_awarded: 0,
        final_total_marks:   row.total_marks,
        final_result:        row.result,
        final_grade:         row.grade,
        result_stage:        'FINAL',
        published_at:        now,
        published_by:        approvedBy || null,
      });
    }
  }

  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await Promise.all(chunk.map(u => {
      const { id, ...fields } = u;
      return supabase.from('student_results').update(fields).eq('id', id);
    }));
  }

  return { published: updates.length, graceApplied: approvedSet.size };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORTFALL REPORT — decision-support view for the committee, BEFORE any
// threshold is chosen: how many students are short by 1, 2, 3, ... marks,
// per batch, so the threshold can be picked with the real distribution in
// view instead of guessing. Purely a count of raw shortfall — does NOT
// apply the per-student subject cap (that only matters once a threshold is
// actually chosen and computeGraceReview/publishFinalResults run for real).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_NUMBERED_SLAB = 9; // slabs 1..9 are exact; anything larger groups into '10+'

export async function computeShortfallReport({ programCode, semester, examMonthYear }) {
  if (!programCode || !semester || !examMonthYear) {
    throw new Error('programCode, semester and examMonthYear are required.');
  }

  const rows = await fetchCycleRows({ programCode, semester, examMonthYear });
  const failingRows = rows.filter(r => r.result === 'F');

  const programType = getProgramType(programCode);
  const schemeCache = {};
  async function schemeFor(batch) {
    const key = batch || '__null__';
    if (!(key in schemeCache)) schemeCache[key] = await getApplicableScheme(programType, batch);
    return schemeCache[key];
  }

  const slabs = [...Array(MAX_NUMBERED_SLAB)].map((_, i) => String(i + 1)).concat(['10+']);
  const matrix       = {}; // { batch: { '1': n, ..., '9': n, '10+': n } }
  const absentCounts = {}; // { batch: n } — AB in ESE, no marks to grace
  const iaMinCounts  = {}; // { batch: n } — failed via IA-below-50% override, marks-gap irrelevant
  const otherCounts  = {}; // { batch: n } — no scheme / no total marks on record
  const batchesSeen  = new Set();

  for (const row of failingRows) {
    const batch = row.batch || 'Unknown';
    batchesSeen.add(batch);

    if (row.ese_marks === 'AB') {
      absentCounts[batch] = (absentCounts[batch] || 0) + 1;
      continue;
    }
    if (row.total_marks === null || row.total_marks === undefined) {
      otherCounts[batch] = (otherCounts[batch] || 0) + 1;
      continue;
    }
    const scheme = await schemeFor(row.batch);
    if (!scheme || !scheme.bands || scheme.bands.length === 0) {
      otherCounts[batch] = (otherCounts[batch] || 0) + 1;
      continue;
    }
    if (isFailedDueToIaMinimum(scheme, row)) {
      iaMinCounts[batch] = (iaMinCounts[batch] || 0) + 1;
      continue;
    }
    const passCutoff = passCutoffFor(scheme);
    if (passCutoff === null) {
      otherCounts[batch] = (otherCounts[batch] || 0) + 1;
      continue;
    }
    const gap = passCutoff - parseFloat(row.total_marks);
    if (gap <= 0) continue; // shouldn't happen on an F row, but guard anyway
    const slabKey = gap > MAX_NUMBERED_SLAB ? '10+' : String(gap);
    if (!matrix[batch]) matrix[batch] = {};
    matrix[batch][slabKey] = (matrix[batch][slabKey] || 0) + 1;
  }

  const batches = [...batchesSeen].sort();
  const policy = batches.length > 0 ? await fetchActiveGracePolicy(batches[0]) : null;

  return {
    batches, slabs, matrix, absentCounts, iaMinCounts, otherCounts,
    totalFailing: failingRows.length,
    policy,
  };
}
