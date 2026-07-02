import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM TYPE CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export const PROGRAM_TYPE_MAP = {
  MBA: 'PG',
  MCA: 'PG',
  BBA: 'UG',
  BCA: 'UG',
};

export function getProgramType(programCode) {
  return PROGRAM_TYPE_MAP[(programCode || '').toUpperCase()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH ORDERING — compares batches like "JAN-25", "JUL-25", "JAN-26" etc.
// so we can determine which scheme is "effective" for a given batch.
// ─────────────────────────────────────────────────────────────────────────────
function batchSortKey(batch) {
  if (!batch) return -Infinity; // no batch = treat as earliest possible
  const match = String(batch).trim().toUpperCase().match(/^(JAN|JUL)-(\d{2})$/);
  if (!match) return -Infinity;
  const [, month, yy] = match;
  const year = 2000 + parseInt(yy, 10);
  const half = month === 'JAN' ? 0 : 1; // JAN comes before JUL in the same year
  return year * 2 + half;
}

/** Returns true if batchA is the same as or after batchB chronologically. */
export function batchIsAtOrAfter(batchA, batchB) {
  return batchSortKey(batchA) >= batchSortKey(batchB);
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH SCHEMES
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGradingSchemes() {
  const { data, error } = await supabase
    .from('grading_schemes')
    .select('*')
    .order('program_type', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchSchemeBands(schemeId) {
  const { data, error } = await supabase
    .from('grading_scheme_bands')
    .select('*')
    .eq('scheme_id', schemeId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch all schemes WITH their bands attached, grouped by program_type.
 * Used by the Grades admin page.
 */
export async function fetchAllSchemesWithBands() {
  const schemes = await fetchGradingSchemes();
  const { data: allBands, error } = await supabase
    .from('grading_scheme_bands')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;

  return schemes.map(s => ({
    ...s,
    bands: (allBands || []).filter(b => b.scheme_id === s.id),
  }));
}

/**
 * Find the applicable scheme for a given program type + batch.
 * Picks the LATEST scheme (by effective_from_batch) that is <= the student's batch.
 * Schemes with effective_from_batch = NULL are treated as "from the beginning"
 * and are always eligible (lowest priority — overridden by any dated scheme
 * whose cutoff has been reached).
 */
export async function getApplicableScheme(programType, batch) {
  const { data: schemes, error } = await supabase
    .from('grading_schemes')
    .select('*')
    .eq('program_type', programType)
    .eq('is_active', true);
  if (error) throw error;

  const candidates = (schemes || []).filter(s =>
    s.effective_from_batch === null || batchIsAtOrAfter(batch, s.effective_from_batch)
  );
  if (candidates.length === 0) return null;

  // Pick the one with the latest effective_from_batch (NULL = earliest/lowest priority)
  candidates.sort((a, b) => batchSortKey(b.effective_from_batch) - batchSortKey(a.effective_from_batch));
  const scheme = candidates[0];
  const bands = await fetchSchemeBands(scheme.id);
  return { ...scheme, bands };
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATE GRADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the letter grade for a result row.
 * @param {Object} params
 * @param {string} params.programCode   e.g. 'MBA'
 * @param {string} params.batch         e.g. 'JAN-25' (the `intake` field)
 * @param {number|null} params.iaMarks
 * @param {string|number|null} params.eseMarks  ('AB' or numeric)
 * @param {number|null} params.totalMarks
 * @param {number} params.iaMax   max IA marks for this scheme's pass check (default 30)
 * @returns {Promise<{letter: string, points: number} | null>}
 */
export async function calculateGrade({ programCode, batch, iaMarks, eseMarks, totalMarks, iaMax = 30 }) {
  const programType = getProgramType(programCode);
  if (!programType) return null;

  const scheme = await getApplicableScheme(programType, batch);
  if (!scheme || !scheme.bands || scheme.bands.length === 0) return null;

  // Absent: ESE marks is 'AB'
  if (eseMarks === 'AB') {
    const band = scheme.bands.find(b => b.special_rule === 'is_absent');
    if (band) return { letter: band.letter_grade, points: parseFloat(band.grade_points) };
  }

  // No total marks at all -> cannot grade
  if (totalMarks === null || totalMarks === undefined) {
    const band = scheme.bands.find(b => b.special_rule === 'is_not_eligible');
    if (band) return { letter: band.letter_grade, points: parseFloat(band.grade_points) };
    return null;
  }

  // Find the matching band by percentage range (totalMarks assumed to be out of 100)
  const pct = parseFloat(totalMarks);
  let matched = scheme.bands.find(b =>
    b.min_percent !== null && b.max_percent !== null &&
    pct >= parseFloat(b.min_percent) && pct <= parseFloat(b.max_percent)
  );

  // Apply special rule: IA minimum requirement (e.g. PG scheme requires IA >= 50%)
  if (matched && matched.special_rule !== 'ia_min_50_required') {
    const iaRule = scheme.bands.find(b => b.special_rule === 'ia_min_50_required');
    if (iaRule && iaMarks !== null && iaMarks !== undefined && iaMax > 0) {
      const iaPercent = (iaMarks / iaMax) * 100;
      if (iaPercent < 50) {
        // Override to F regardless of total marks band
        matched = iaRule;
      }
    }
  }

  if (!matched) {
    // Fall back to F band if marks are below all defined ranges
    matched = scheme.bands.find(b => b.letter_grade === 'F');
  }

  if (!matched) return null;
  return { letter: matched.letter_grade, points: parseFloat(matched.grade_points) };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEME MANAGEMENT (admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function createGradingScheme({ name, programType, effectiveFromBatch, notes, bands }) {
  const { data: scheme, error: schemeErr } = await supabase
    .from('grading_schemes')
    .insert({
      name,
      program_type: programType,
      effective_from_batch: effectiveFromBatch || null,
      notes: notes || null,
      is_active: true,
    })
    .select()
    .single();
  if (schemeErr) throw schemeErr;

  if (bands && bands.length > 0) {
    const bandRecords = bands.map((b, i) => ({
      scheme_id: scheme.id,
      letter_grade: b.letter_grade,
      grade_points: b.grade_points,
      min_percent: b.min_percent,
      max_percent: b.max_percent,
      special_rule: b.special_rule || null,
      display_order: i + 1,
    }));
    const { error: bandsErr } = await supabase.from('grading_scheme_bands').insert(bandRecords);
    if (bandsErr) throw bandsErr;
  }

  return scheme;
}

export async function updateSchemeBand(bandId, updates) {
  const { error } = await supabase
    .from('grading_scheme_bands')
    .update(updates)
    .eq('id', bandId);
  if (error) throw error;
}

export async function updateScheme(schemeId, updates) {
  const { error } = await supabase
    .from('grading_schemes')
    .update(updates)
    .eq('id', schemeId);
  if (error) throw error;
}

export async function deactivateScheme(schemeId) {
  const { error } = await supabase
    .from('grading_schemes')
    .update({ is_active: false })
    .eq('id', schemeId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAST IN-MEMORY GRADE CALCULATION (no DB round-trip per row)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Same logic as calculateGrade, but takes a pre-fetched scheme (with bands)
 * instead of looking it up from the DB. Used by recalculateGrades for speed.
 */
function calculateGradeWithScheme(scheme, { iaMarks, eseMarks, totalMarks, iaMax = 30 }) {
  if (!scheme || !scheme.bands || scheme.bands.length === 0) return null;

  if (eseMarks === 'AB') {
    const band = scheme.bands.find(b => b.special_rule === 'is_absent');
    if (band) return { letter: band.letter_grade, points: parseFloat(band.grade_points) };
  }

  if (totalMarks === null || totalMarks === undefined) {
    const band = scheme.bands.find(b => b.special_rule === 'is_not_eligible');
    if (band) return { letter: band.letter_grade, points: parseFloat(band.grade_points) };
    return null;
  }

  const pct = parseFloat(totalMarks);
  let matched = scheme.bands.find(b =>
    b.min_percent !== null && b.max_percent !== null &&
    pct >= parseFloat(b.min_percent) && pct <= parseFloat(b.max_percent)
  );

  if (matched && matched.special_rule !== 'ia_min_50_required') {
    const iaRule = scheme.bands.find(b => b.special_rule === 'ia_min_50_required');
    if (iaRule && iaMarks !== null && iaMarks !== undefined && iaMax > 0) {
      const iaPercent = (iaMarks / iaMax) * 100;
      if (iaPercent < 50) matched = iaRule;
    }
  }

  if (!matched) matched = scheme.bands.find(b => b.letter_grade === 'F');
  if (!matched) return null;
  return { letter: matched.letter_grade, points: parseFloat(matched.grade_points) };
}

/**
 * Pre-fetch all active schemes (with bands) once, organized for fast lookup
 * by program_type. Returns a function that finds the applicable scheme for
 * a given program_type + batch without hitting the DB again.
 */
async function buildSchemeResolver() {
  const all = await fetchAllSchemesWithBands();
  const active = all.filter(s => s.is_active);

  return function resolve(programType, batch) {
    const candidates = active.filter(s =>
      s.program_type === programType &&
      (s.effective_from_batch === null || batchIsAtOrAfter(batch, s.effective_from_batch))
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => batchSortKey(b.effective_from_batch) - batchSortKey(a.effective_from_batch));
    return candidates[0];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK RECALCULATE — used for backfilling existing student_results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate and update the `grade` column for all rows matching filters
 * (or all rows if no filters given). Schemes are fetched ONCE upfront and
 * reused in-memory for every row (no per-row DB round-trip for scheme lookup).
 * Updates are batched via upsert instead of one UPDATE per row.
 *
 * @param {Object} filters - optional { program_code, intake }
 * @param {Function} onProgress - optional callback(done, total) for UI progress
 */
export async function recalculateGrades(filters = {}, onProgress) {
  const resolveScheme = await buildSchemeResolver();

  // Get total count first for progress reporting
  let countQuery = supabase.from('student_results').select('id', { count: 'exact', head: true });
  if (filters.program_code) countQuery = countQuery.eq('program_code', filters.program_code);
  if (filters.intake)       countQuery = countQuery.eq('intake', filters.intake);
  const { count: totalCount } = await countQuery;

  const BATCH = 1000;
  let from = 0;
  let hasMore = true;
  let updated = 0;
  let skipped = 0;
  let processed = 0;

  while (hasMore) {
    let query = supabase
      .from('student_results')
      .select('id, program_code, intake, ia_marks, ese_marks, total_marks')
      .range(from, from + BATCH - 1);

    if (filters.program_code) query = query.eq('program_code', filters.program_code);
    if (filters.intake)       query = query.eq('intake', filters.intake);

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    if (batch.length === 0) { hasMore = false; break; }

    // Calculate grades in-memory for the whole batch (fast, no DB calls)
    const updates = [];
    for (const row of batch) {
      const programType = getProgramType(row.program_code);
      const scheme = programType ? resolveScheme(programType, row.intake) : null;
      const grade = calculateGradeWithScheme(scheme, {
        iaMarks:    row.ia_marks,
        eseMarks:   row.ese_marks,
        totalMarks: row.total_marks,
      });
      if (grade) {
        updates.push({ id: row.id, grade: grade.letter });
      } else {
        skipped++;
      }
    }

    // Write this batch's grades in parallel chunks of 50 to balance speed vs load
    const CHUNK = 50;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      await Promise.all(chunk.map(u =>
        supabase.from('student_results').update({ grade: u.grade }).eq('id', u.id)
      ));
      updated += chunk.length;
      processed += chunk.length;
      if (onProgress) onProgress(processed + skipped, totalCount || processed + skipped);
    }

    processed = from + batch.length;
    if (onProgress) onProgress(processed, totalCount || processed);

    hasMore = batch.length === BATCH;
    from += BATCH;
    if (from > 50000) break;
  }

  return { updated, skipped, total: totalCount };
}