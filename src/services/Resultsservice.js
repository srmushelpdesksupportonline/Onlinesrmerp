import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT NAME MAP — sheet abbreviation → full name
// ─────────────────────────────────────────────────────────────────────────────
export const SHEET_TO_SUBJECT = {
  // MBA Sem 1
  ME:   'Managerial Economics',
  MM:   'Marketing Management',
  FA:   'Financial Accounting',
  POM:  'Production and Operations Management',
  CSFM: 'Communication Skills for Managers',
  // MBA Sem 2
  LAB:  'Legal Aspects of Business',
  BA:   'Business Analytics',
  HRM:  'Human Resource Management',
  FM:   'Financial Management',
  BSQM: 'Business Statistics and Quantitative Methods',
  // MCA Sem 1
  PJ:   'Programming in Java',
  OS:   'Operating System',
  DBT:  'Database Technology',
  CN:   'Computer Networks',
  'PJ-P':    'Programming in Java Online Practical',
  'OS & DT-P': 'Operating System and Database Technology Online Practicals',
  // MCA Sem 2
  PP:   'Python Programming',
  OT:   'Object Oriented Technologies',
  ADSA: 'Advanced Data Structures and Algorithms',
  'ADSA- P':  'Advanced Data Structures and Algorithms Practical',
  AWAD: 'Advanced Web Application Development',
  'AWAD- P':  'Advanced Web Application Development Practical',
  // BCA Sem 1
  IDS:  'Introduction to Data Science',
  PC:   'Python for Computing',
  CF:   'Computer Fundamentals',
  ES:   'Environmental Science',
  PPS:  'Problem Solving and Python Programming',
  DMS:  'Discrete Mathematical Structures',
  // BBA Sem 1
  BPOM: 'Basics of Production and Operations Management',
  // Generic
  'Student Marks Upload': '', // single-subject file — name comes from filename
};

/**
 * Detect subject name from sheet name.
 * Returns full name if known, otherwise returns the sheet name as-is.
 */
export function detectSubjectFromSheet(sheetName, fileName) {
  // Sheet1, Sheet 1 etc. are generic — don't use as subject name
  if (/^sheet\s*\d*$/i.test(sheetName.trim())) {
    return extractSubjectFromFileName(fileName);
  }
  if (SHEET_TO_SUBJECT[sheetName] !== undefined) {
    return SHEET_TO_SUBJECT[sheetName] || extractSubjectFromFileName(fileName);
  }
  return sheetName;
}

/**
 * Extract subject name from filename like "1__Managerial_Economics.xlsx"
 * or "1. Managerial Economics.xlsx"
 */
export function extractSubjectFromFileName(fileName) {
  if (!fileName) return '';
  return fileName
    .replace(/\.[^.]+$/, '')            // remove extension
    .replace(/^\d+[\.\s_-]+/, '')       // remove leading "1." or "1__" or "1- "
    .replace(/_/g, ' ')                 // underscores to spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smart parser: given raw rows from XLSX.utils.sheet_to_json with header:1,
 * finds the real header row by scanning for enrollment-like column,
 * then returns { rows, courseName, courseCode, semester }.
 * Handles files with junk rows at the top like "SRM TRUST", "I SEMESTER" etc.
 */
export function smartParseSheet(rawRows) {
  let headerRowIdx = -1;
  let courseName   = '';
  let courseCode   = '';
  let semester     = '';

  // Scan top rows for metadata and real header
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    const vals = row.map(v => String(v ?? '').trim());
    const joined = vals.join(' ').toLowerCase();

    // Extract course name from rows like "Financial Accounting (EMBA24C102) - Student Marks Upload"
    // Also handles plain subject name rows like "Managerial Economics"
    if (!courseName) {
      const rowText = vals.filter(v => v && v !== 'nan').join(' ').trim();

      // Pattern 1: "Subject Name (CourseCode)"
      const courseMatch = rowText.match(/^([A-Za-z][\w\s&,\/]+?)\s*\(([A-Z0-9]+)\)/);
      if (courseMatch) {
        courseName = courseMatch[1].trim();
        courseCode = courseMatch[2].trim();
      }

      // Pattern 2: Plain subject name row — single non-empty cell, looks like a title
      // Must be longer than 5 chars, not all caps (which would be an org name like "SRM TRUST")
      if (!courseName && rowText.length > 5 && rowText.length < 100 &&
          !/^[A-Z\s]+$/.test(rowText) &&
          !rowText.toLowerCase().includes('semester') &&
          !rowText.toLowerCase().includes('note') &&
          !rowText.toLowerCase().includes('upload') &&
          !rowText.toLowerCase().includes('trust') &&
          !rowText.toLowerCase().includes('university') &&
          vals.filter(v => v && v !== 'nan').length === 1) {
        // Single non-empty cell that looks like a subject name
        const candidate = vals.find(v => v && v !== 'nan') || '';
        if (candidate.length > 5 && /^[A-Z][a-z]/.test(candidate)) {
          courseName = candidate.trim();
        }
      }
    }

    // Extract semester from rows like "I SEMESTER", "II SEMESTER", "Semester 1"
    if (!semester) {
      const semMap = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6' };
      const romanMatch = joined.match(/\b(vi|v|iv|iii|ii|i)\s+semester\b/i);
      if (romanMatch) semester = semMap[romanMatch[1].toUpperCase()] || '';
      const numMatch = joined.match(/semester\s+(\d)/i);
      if (numMatch) semester = numMatch[1];
    }

    // Detect real header row — must contain enrollment/roll no column
    const hasEnrollment = vals.some(v => {
      const norm = v.toLowerCase().replace(/[\s.]+/g, '');
      return norm.match(/enro[l]+n?ment/) || norm === 'rollno' || norm === 'rollnumber';
    });
    if (hasEnrollment) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return { rows: [], courseName, courseCode, semester };

  // Build proper row objects from headerRowIdx onwards
  const headers = rawRows[headerRowIdx].map(v => String(v ?? '').trim());
  const rows = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const obj = {};
    rawRows[i].forEach((val, j) => {
      const key = headers[j] || `col_${j}`;
      obj[key] = val;
    });
    rows.push(obj);
  }

  return { rows, courseName, courseCode, semester };
}
export function parseResultRows(rows, { programCode, semester, academicYear, intake, examMonthYear, schemeId, uploadedBy }) {
  const records = [];

  for (const row of rows) {
    // ── Enrollment number ──
    // Variants: 'Enrollnment Number', 'Enrolment Number', 'Enrollment number ', 'Roll No.'
    const enrollmentKey = Object.keys(row).find(k => {
      const norm = k.trim().toLowerCase().replace(/[\s.]+/g, '');
      return norm.match(/enro[l]+n?ment/) ||
             norm === 'rollno' ||
             norm === 'rollnumber';
    });
    const enrollmentNo = enrollmentKey ? String(row[enrollmentKey] || '').trim() : '';
    if (!enrollmentNo || enrollmentNo.toLowerCase() === 'nan') continue;

    // ── Student name ──
    // Format 1: 'Name of the Student' or 'Name'
    // Format 2: 'Student Name'
    const nameKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().includes('student name') ||
      k.trim().toLowerCase() === 'name of the student' ||
      k.trim().toLowerCase() === 'name'
    );
    const studentName = nameKey ? String(row[nameKey] || '').trim() : '';

    // ── Email ──
    const emailKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().includes('email')
    );
    const officialEmail = emailKey ? String(row[emailKey] || '').trim() : '';

    // ── IA marks ──
    // Format 1: 'IA Marks(30)'
    // Format 2: 'IA Score (Max 30)'
    const iaKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().startsWith('ia marks') ||
      k.trim().toLowerCase().startsWith('ia score')
    );
    const iaRaw  = iaKey ? row[iaKey] : null;
    const iaStr  = iaRaw != null ? String(iaRaw).trim().toUpperCase() : '';
    const iaMarks = (iaStr === 'AB' || iaStr === 'NOT ELIGIBLE' || iaStr === '' || iaStr === 'NAN')
      ? null
      : parseFloat(iaRaw) || null;

    // ── ESE marks ──
    // Format 1: ' ESE Marks (70)' (leading space)
    // Format 2: 'ESE Score (Max 70)'
    const eseKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().includes('ese marks') ||
      k.trim().toLowerCase().includes('ese score')
    );
    const eseRaw  = eseKey ? row[eseKey] : null;
    const eseStr  = eseRaw != null ? String(eseRaw).trim() : '';
    const eseUpper = eseStr.toUpperCase();
    // Normalize any "Not Eligible..." variant to 'AB' (max 50 chars in DB)
    const eseMarks = (eseStr === '' || eseUpper === 'NAN')
      ? null
      : (eseUpper.startsWith('NOT ELIGIBLE') || eseUpper === 'AB') ? 'AB' : eseStr;

    // ── Total marks ──
    // Format 1: 'IA+ ESE- Total Marks(100)'
    // Format 2: 'Total(100)'
    const totalKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().includes('total marks') ||
      k.trim().toLowerCase().startsWith('total(')  ||
      k.trim().toLowerCase().startsWith('total (')
    );
    const totalRaw  = totalKey ? row[totalKey] : null;
    const totalStr  = totalRaw != null ? String(totalRaw).trim().toUpperCase() : '';
    const totalMarks = (totalStr === 'AB' || totalStr === 'NOT ELIGIBLE' || totalStr === '' || totalStr === 'NAN')
      ? null
      : parseFloat(totalRaw) || null;

    // ── Result ──
    // Format 1: 'Result ( P/ F)', 'Result (P/ F)', 'Result (P/F)'
    // Format 2: 'Crs (P/F)'
    const resultKey = Object.keys(row).find(k =>
      k.trim().toLowerCase().startsWith('result') ||
      k.trim().toLowerCase().startsWith('crs')
    );
    const resultRaw = resultKey ? String(row[resultKey] || '').trim().toUpperCase() : '';
    const result = resultRaw === 'P' ? 'P' : resultRaw === 'F' ? 'F' : null;

    // ── Backlog: F result OR AB in ESE ──
    const isBacklog = result === 'F' || eseMarks === 'AB';

    records.push({
      enrollment_no:  enrollmentNo,
      student_name:   studentName   || null,
      official_email: officialEmail || null,
      program_code:   programCode,
      semester:       parseInt(semester),
      course_name:    '',   // filled in by caller
      course_code:    null,
      scheme_id:      schemeId     || null,
      academic_year:  academicYear   || null,
      intake:         intake         || null,
      exam_month_year: examMonthYear || null,
      ia_marks:       iaMarks,
      ese_marks:      eseMarks,
      total_marks:    totalMarks,
      result,
      is_backlog:     !!isBacklog,
      uploaded_by:    uploadedBy   || null,
    });
  }

  return records;
}

/**
 * Upsert result records into student_results.
 * Uses ON CONFLICT on (enrollment_no, course_name, semester, exam_month_year).
 * This allows multiple exam attempts per subject (e.g. backlog re-exams)
 * to coexist as separate rows, while re-uploading the SAME exam sitting
 * safely updates that row instead of duplicating it.
 */
export async function uploadResults(records) {
  if (!records || records.length === 0) return { inserted: 0, updated: 0 };

  // exam_month_year is required by the DB — validate before sending
  const missing = records.filter(r => !r.exam_month_year);
  if (missing.length > 0) {
    throw new Error(`${missing.length} record(s) missing Exam Month/Year. This field is required for every upload.`);
  }

  const { data, error } = await supabase
    .from('student_results')
    .upsert(records, {
      onConflict: 'enrollment_no,course_name,semester,exam_month_year',
      ignoreDuplicates: false,
    })
    .select();

  if (error) throw error;

  // Auto-create minimal student_master records for any students in this
  // upload who don't already exist there. Never overwrites existing rows.
  await autoCreateStudentMasterRecords(records);

  return { count: (data || []).length };
}

/**
 * For each unique student in the uploaded records, check if they exist in
 * student_master. If not, insert a minimal record (enrollment_no, full_name,
 * official_email, program_name, student_status, current_semester).
 * Existing student_master records are NEVER touched or overwritten — this
 * only fills in students who are completely missing.
 */
async function autoCreateStudentMasterRecords(records) {
  // Build one entry per unique enrollment_no from this batch
  const byEnrollment = {};
  for (const r of records) {
    if (!r.enrollment_no) continue;
    if (!byEnrollment[r.enrollment_no]) {
      byEnrollment[r.enrollment_no] = {
        enrollment_no:    r.enrollment_no,
        full_name:        r.student_name   || 'Unknown',
        official_email:   r.official_email || null,
        program_name:     r.program_code   || null,
        current_semester: r.semester       || null,
      };
    }
  }
  const enrollmentNos = Object.keys(byEnrollment);
  if (enrollmentNos.length === 0) return { created: 0 };

  // Find which of these already exist in student_master (batched to respect row limits)
  const existing = new Set();
  for (let i = 0; i < enrollmentNos.length; i += 500) {
    const chunk = enrollmentNos.slice(i, i + 500);
    const { data, error } = await supabase
      .from('student_master')
      .select('enrollment_no')
      .in('enrollment_no', chunk);
    if (error) throw error;
    (data || []).forEach(row => existing.add(row.enrollment_no));
  }

  const toCreate = enrollmentNos
    .filter(no => !existing.has(no))
    .map(no => ({
      ...byEnrollment[no],
      student_status: 'ENROLLED',
    }));

  if (toCreate.length === 0) return { created: 0 };

  // Insert in chunks; ON CONFLICT DO NOTHING semantics via ignoreDuplicates
  // so this never clobbers a record created concurrently by another process.
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    const { error } = await supabase
      .from('student_master')
      .upsert(chunk, { onConflict: 'enrollment_no', ignoreDuplicates: true });
    if (error) throw error;
  }

  return { created: toCreate.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — BY STUDENT
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchResultsByStudent(filters = {}) {
  let query = supabase
    .from('student_results')
    .select('*')
    .range(0, 9999)
    .order('semester', { ascending: true })
    .order('course_name', { ascending: true });

  if (filters.enrollment_no) query = query.eq('enrollment_no', filters.enrollment_no);
  if (filters.program_code)  query = query.eq('program_code',  filters.program_code);
  if (filters.academic_year) query = query.eq('academic_year', filters.academic_year);
  if (filters.intake)        query = query.eq('intake',        filters.intake);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch student result summaries using batched requests to bypass
 * Supabase's default 1000 row limit. Fetches in chunks of 1000
 * until all rows are retrieved.
 */
export async function fetchStudentResultSummaries(filters = {}) {
  const BATCH = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('student_result_summaries')
      .select('*')
      .range(from, from + BATCH - 1);

    if (filters.program_code) query = query.eq('program_code', filters.program_code);
    if (filters.semester)     query = query.contains('semesters', [parseInt(filters.semester)]);

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    allData = [...allData, ...batch];

    // If we got fewer than BATCH rows, we've reached the end
    hasMore = batch.length === BATCH;
    from += BATCH;

    // Safety cap at 20 batches (20,000 students)
    if (from > 20000) break;
  }

  return allData.map(s => ({
    ...s,
    semesters: s.semesters || [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — BY SUBJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchResultsBySubject(filters = {}) {
  const BATCH = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('student_results')
      .select('*')
      .range(from, from + BATCH - 1)
      .order('enrollment_no', { ascending: true });

    if (filters.program_code)    query = query.eq('program_code',    filters.program_code);
    if (filters.semester)        query = query.eq('semester',        parseInt(filters.semester));
    if (filters.course_name)     query = query.eq('course_name',     filters.course_name);
    if (filters.academic_year)   query = query.eq('academic_year',   filters.academic_year);
    if (filters.intake)          query = query.eq('intake',          filters.intake);
    if (filters.result)          query = query.eq('result',          filters.result);
    if (filters.exam_month_year) query = query.eq('exam_month_year', filters.exam_month_year);

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    allData = [...allData, ...batch];
    hasMore = batch.length === BATCH;
    from += BATCH;
    if (from > 50000) break;
  }

  return allData;
}

/**
 * Fetch distinct subject names for a program+semester.
 */
export async function fetchSubjectNames(programCode, semester) {
  let query = supabase
    .from('student_results')
    .select('course_name, course_code')
    .order('course_name');

  if (programCode) query = query.eq('program_code', programCode);
  if (semester)    query = query.eq('semester',     parseInt(semester));

  const { data, error } = await query;
  if (error) throw error;

  // Deduplicate
  const seen = new Set();
  return (data || []).filter(r => {
    if (seen.has(r.course_name)) return false;
    seen.add(r.course_name);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKLOG SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchBacklogSummary(filters = {}) {
  let query = supabase
    .from('student_results')
    .select('enrollment_no, student_name, official_email, program_code, semester, course_name, academic_year, intake')
    .eq('is_backlog', true)
    .range(0, 9999)
    .order('enrollment_no');

  if (filters.program_code)  query = query.eq('program_code',  filters.program_code);
  if (filters.semester)      query = query.eq('semester',      parseInt(filters.semester));
  if (filters.academic_year) query = query.eq('academic_year', filters.academic_year);
  if (filters.intake)        query = query.eq('intake',        filters.intake);

  const { data, error } = await query;
  if (error) throw error;

  // Group by student
  const map = {};
  for (const row of data || []) {
    if (!map[row.enrollment_no]) {
      map[row.enrollment_no] = {
        enrollment_no:  row.enrollment_no,
        student_name:   row.student_name,
        official_email: row.official_email,
        program_code:   row.program_code,
        academic_year:  row.academic_year,
        intake:         row.intake,
        backlogs:       [],
      };
    }
    map[row.enrollment_no].backlogs.push({
      semester:    row.semester,
      course_name: row.course_name,
    });
  }

  return Object.values(map).map(s => ({
    ...s,
    backlog_count: s.backlogs.length,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH DISTINCT FILTER OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchResultFilterOptions() {
  const { data, error } = await supabase
    .from('student_results')
    .select('program_code, academic_year, intake, semester, exam_month_year');
  if (error) throw error;

  const programs        = [...new Set((data || []).map(r => r.program_code).filter(Boolean))].sort();
  const academicYears   = [...new Set((data || []).map(r => r.academic_year).filter(Boolean))].sort().reverse();
  const intakes         = [...new Set((data || []).map(r => r.intake).filter(Boolean))].sort();
  const semesters       = [...new Set((data || []).map(r => r.semester).filter(Boolean))].sort((a, b) => a - b);
  const examMonthYears  = [...new Set((data || []).map(r => r.exam_month_year).filter(Boolean))].sort();

  return { programs, academicYears, intakes, semesters, examMonthYears };
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteResults(filters) {
  let query = supabase.from('student_results').delete();
  if (filters.program_code)  query = query.eq('program_code',  filters.program_code);
  if (filters.semester)      query = query.eq('semester',      parseInt(filters.semester));
  if (filters.academic_year) query = query.eq('academic_year', filters.academic_year);
  if (filters.course_name)   query = query.eq('course_name',   filters.course_name);
  const { error } = await query;
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRAM_CODES  = ['MBA', 'MCA', 'BBA', 'BCA'];
export const INTAKE_OPTIONS = ['JAN', 'JUL'];

export const RESULT_COLORS = {
  P: { bg: '#DCFCE7', text: '#166534' },
  F: { bg: '#FEF2F2', text: '#DC2626' },
};