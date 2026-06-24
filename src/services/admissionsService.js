import { supabase } from '../supabaseClient';
import {
  PROGRAM_EMAIL_NAMES,
  getProgramCode,
  getProgramShortCode,
  getIntakeCode,
  getIntakeFullName,
  getYearCode,
  generateEnrollmentNumber,
} from './enrollmentService';

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Strips all non-digit characters, removes leading '91' if 12 digits,
 * returns last 10 digits.
 */
export function cleanMobile(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  const stripped =
    digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return stripped.slice(-10);
}

/**
 * Password rule: ProperCaseName@123
 * Uses smart name extraction: if first name < 4 chars, combines with next name.
 * If total length < 8, extend digits until >= 8.
 *   Annamalai → Annamalai@123  (13 chars — fine)
 *   Ali Kaseem → Alikaseem@123 (12 chars — fine)
 *   Jo         → Jo@12345      (8 chars)
 */
export function generatePassword(fullName) {
  const { firstName } = parseName(fullName);
  const properCase = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  
  let numStr = '123';
  let password = properCase + '@' + numStr;
  
  while (password.length < 8) {
    numStr += String((numStr.length % 9) + 1);
    password = properCase + '@' + numStr;
  }
  
  return password;
}

/**
 * Splits full name into first / middle / last.
 * Smart logic:
 * - Skip single-letter initials (e.g., "S" in "S JOHN KUMAR")
 * - If first name < 4 chars, combine with next name
 * - Otherwise use first name only
 */
export function parseName(fullName) {
  let parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  
  // Skip single-letter initials at the start
  if (parts[0].length === 1 && parts.length > 1) {
    parts = parts.slice(1);
  }
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  
  let firstName = parts[0];
  let remainder = parts.slice(1);
  
  // If first name < 4 chars, combine with next name
  if (firstName.length < 4 && remainder.length > 0) {
    firstName = firstName + remainder[0];
    remainder = remainder.slice(1);
  }
  
  if (remainder.length === 0) return { firstName, middleName: '', lastName: '' };
  if (remainder.length === 1) return { firstName, middleName: '', lastName: remainder[0] };
  
  return {
    firstName,
    middleName:  remainder.slice(0, -1).join(' '),
    lastName:    remainder[remainder.length - 1],
  };
}

/**
 * Check if a value is in Excel numeric date format.
 * Excel dates are typically numbers between 100 and 100000.
 */
function isExcelDate(val) {
  if (!val) return false;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return !isNaN(num) && num > 100 && num < 100000;
}

/**
 * Parse a date string in various formats and return ISO (YYYY-MM-DD).
 * Handles: DD/MM/YY, DD/MM/YYYY, DD-MM-YY, DD-MM-YYYY, YYYY-MM-DD
 */
function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  dateStr = dateStr.trim();
  
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Try DD/MM/YY or DD/MM/YYYY
  let match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let [, day, month, year] = match;
    day = parseInt(day, 10);
    month = parseInt(month, 10);
    year = parseInt(year, 10);
    
    // Handle 2-digit year (19xx or 20xx)
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    // Validate ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    
    // Pad and return as ISO
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * Convert Excel numeric date to ISO date string (YYYY-MM-DD).
 * Example: 39055.00011574074 → '2006-10-15'
 */
function excelDateToISO(excelNum) {
  if (!excelNum) return null;
  const num = typeof excelNum === 'string' ? parseFloat(excelNum) : excelNum;
  if (isNaN(num)) return null;
  const epochDate = new Date(1900, 0, 1);
  const millisecondsPerDay = 86400000;
  const date = new Date(epochDate.getTime() + (num - 1) * millisecondsPerDay);
  return date.toISOString().split('T')[0];
}

/**
 * Smart date converter: handles Excel numbers and various string formats.
 */
function convertToISODate(dateVal) {
  if (!dateVal) return null;
  
  // Excel numeric format
  if (isExcelDate(dateVal)) {
    return excelDateToISO(dateVal);
  }
  
  // String format (DD/MM/YY, DD-MM-YYYY, etc.)
  if (typeof dateVal === 'string') {
    return parseDateString(dateVal);
  }
  
  return null;
}

// ── FETCH ─────────────────────────────────────────────────────────────────────

export async function loadAdmissions(programFilter = '') {
  let query = supabase
    .from('merrito_import')
    .select('*')
    .order('imported_at', { ascending: false });

  if (programFilter && programFilter !== '') {
    query = query.eq('course', programFilter);
  }

  const { data, error } = await query;
  if (error) { console.error('loadAdmissions:', error); return []; }
  return data || [];
}

export async function loadAcademicYears() {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, academic_year')
    .eq('is_active', true)
    .order('academic_year', { ascending: false });
  if (error) { console.error('loadAcademicYears:', error); return []; }
  return data || [];
}

export async function getExistingAdmissions() {
  const { data, error } = await supabase
    .from('merrito_import')
    .select('application_no, email_id, mobile_number');
  if (error) { console.error('getExistingAdmissions:', error); return []; }
  return data || [];
}

export async function getExistingStudents() {
  const { data, error } = await supabase
    .from('student_master')
    .select('application_no, personal_email, mobile');
  if (error) { console.error('getExistingStudents:', error); return []; }
  return data || [];
}

export async function getEnrolledCount() {
  const { count, error } = await supabase
    .from('student_master')
    .select('*', { count: 'exact', head: true });
  if (error) { console.error('getEnrolledCount:', error); return 0; }
  return count || 0;
}

// ── MAPPING ───────────────────────────────────────────────────────────────────

export function mapRowToMerritoImport(row, intake, academicYear) {
  return {
    application_no:    String(row['Application No'] || '').trim(),
    course:            (row['Program Applied For'] || row['Course'] || '').toUpperCase().trim(),
    full_name_as_per_your_10th_marksheet:
      row['Full Name As Per Your 10th Marksheet'] ||
      row['Full Name as per your 10th Marksheet'] ||
      row['Full Name'] || '',
    mobile_number:     String(row['Mobile Number'] || '').trim(),
    email_id:          (row['Email ID'] || row['Email Id'] || '').toLowerCase().trim(),
    intake,
    academic_year:     academicYear,
    enrollment_no:     null,
    api_push_status:   'PENDING',
    processed:         false,
    raw_data:          row,  // ← Store entire Excel row as JSON
  };
}

// ── INSERT ────────────────────────────────────────────────────────────────────

/**
 * Returns full inserted rows (with id) so enrollment numbers
 * can be generated immediately after.
 */
export async function insertAdmissions(records) {
  const { data, error } = await supabase
    .from('merrito_import')
    .insert(records)
    .select('*');
  if (error) { console.error('insertAdmissions:', error); throw error; }
  return data || [];
}

// ── CRM PUSH STATUS ───────────────────────────────────────────────────────────

/**
 * Marks selected merrito_import rows as CRM push completed.
 * Temporary manual step until Merritto API is integrated.
 */
export async function markCRMPushComplete(ids) {
  const { error } = await supabase
    .from('merrito_import')
    .update({ api_push_status: 'COMPLETED' })
    .in('id', ids);
  if (error) throw error;
}

// ── ENROLLMENT NUMBER GENERATION ──────────────────────────────────────────────

/**
 * Generates an enrollment number for one merrito_import row
 * via the Supabase RPC and saves it back to the row.
 */
export async function generateAndSaveEnrollmentNo(row) {
  const programCode = getProgramCode(row.course);
  const sessionCode = getIntakeCode(row.intake);
  const yearCode    = getYearCode(row.academic_year);  // already 2-digit

  const enrollmentNo = await generateEnrollmentNumber(
    programCode,
    sessionCode,
    yearCode,
    '0'
  );

  const { error } = await supabase
    .from('merrito_import')
    .update({ enrollment_no: enrollmentNo })
    .eq('id', row.id);
  if (error) throw error;

  return enrollmentNo;
}

// ── LOOKUP IDs ────────────────────────────────────────────────────────────────

const _lookupCache = {};

export async function getLookupIds(course, intake, academicYear) {
  const key = `${course}|${intake}|${academicYear}`;
  if (_lookupCache[key]) return _lookupCache[key];

  // Convert intake (JAN/JUL) to enrollment code (1/2)
  const intakeEnrollmentCode = intake === 'JAN' ? '1' : '2';

  const [programResult, sessionResult, yearResult, typeResult] =
    await Promise.all([
      supabase.rpc('get_program_id_by_name', { p_program_name: course }),
      supabase
        .from('intake_sessions')
        .select('id')
        .eq('enrollment_code', intakeEnrollmentCode)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('academic_years')
        .select('id')
        .eq('academic_year', academicYear)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('admission_types')
        .select('id')
        .eq('admission_code', 'NORMAL')
        .limit(1)
        .maybeSingle(),
    ]);

  if (programResult.error)
    throw new Error(`Program lookup failed for "${course}": ${programResult.error.message}`);
  if (sessionResult.error)
    throw new Error(`Intake session lookup failed for "${intake}": ${sessionResult.error.message}`);
  if (!sessionResult.data)
    throw new Error(`No intake session found for code "${intakeEnrollmentCode}"`);
  if (yearResult.error)
    throw new Error(`Academic year lookup failed for "${academicYear}": ${yearResult.error.message}`);
  if (!yearResult.data)
    throw new Error(`No academic year found for "${academicYear}"`);
  if (typeResult.error)
    throw new Error(`Admission type lookup failed: ${typeResult.error.message}`);
  if (!typeResult.data)
    throw new Error(`No admission type found for NORMAL`);

  const ids = {
    programId:       programResult.data,
    intakeSessionId: sessionResult.data.id,
    academicYearId:  yearResult.data.id,
    admissionTypeId: typeResult.data.id,
  };

  _lookupCache[key] = ids;
  return ids;
}

// ── OFFICIAL EMAIL GENERATION ─────────────────────────────────────────────────

/**
 * Generate official email using smart name extraction (client-side).
 * Format: {firstName}.{programCode}{intakeCode}ul{yearCode}@srmus.edu.in
 * 
 * Example:
 * - ANNAMALAI PR, MBA, JUL, 26 → annamalai.mbaul26@srmus.edu.in
 * - ALI KASEEM S, MCA, JUL, 26 → alikaseem.mcaul26@srmus.edu.in
 * - RYAN NOLAN D, BBA, JUL, 26 → ryannolan.bbaul26@srmus.edu.in
 * - R ADITHYA, MBA, JUL, 26 → adithya.mbaul26@srmus.edu.in (skips R initial)
 */
export function generateOfficialEmail(fullName, course, intake, yearCode) {
  const { firstName } = parseName(fullName);
  const programShort   = getProgramShortCode(course).toLowerCase(); // 'mba','mca','bba','bca'
  const intakeFull     = getIntakeFullName(intake).toLowerCase();    // 'july' or 'january'
  // Format: annamalai.mbajuly26@srmus.edu.in
  const emailPrefix = `${firstName.toLowerCase()}.${programShort}${intakeFull}${yearCode}`;
  return `${emailPrefix}@srmus.edu.in`;
}

// ── FULL ENROLL FLOW ──────────────────────────────────────────────────────────

/**
 * Enrolls a single student from a merrito_import row.
 *
 * Steps:
 *  1.  Generate official email (RPC — deduped)
 *  2.  Generate password
 *  3.  INSERT → students
 *  4.  INSERT → student_master
 *  5.  INSERT → student_programs
 *  6.  INSERT → student_addresses
 *  7.  INSERT → student_parents
 *  8.  INSERT → student_email_registry
 *  9.  INSERT → student_status_history
 *  10. INSERT → enrollment_history
 *  11. DELETE from merrito_import  ← row moved; staging cleared
 */
/**
 * Enrolls a single student from a merrito_import row.
 *
 * Steps:
 *  1. Generate official email (RPC — deduped)
 *  2. Generate password
 *  3. INSERT → student_master (flat Student Page record)
 *  4. DELETE from merrito_import (row fully moved)
 */

// ── FINANCE AUTO-SETUP (inlined to avoid circular import) ────────────────────

const FEE_MAP = {
  MBA: { full_program_fee: 110000, total_semesters: 4 },
  MCA: { full_program_fee: 100000, total_semesters: 4 },
  BBA: { full_program_fee: 117000, total_semesters: 6 },
  BCA: { full_program_fee: 117000, total_semesters: 6 },
};

function normalisePCode(val) {
  if (!val) return 'MBA';
  const v = val.toString().toUpperCase();
  if (v.includes('MBA') || v === 'MB') return 'MBA';
  if (v.includes('MCA') || v === 'MC') return 'MCA';
  if (v.includes('BBA') || v === 'BB') return 'BBA';
  if (v.includes('BCA') || v === 'BC') return 'BCA';
  return 'MBA';
}

function detectScholarshipInline(rawData) {
  if (!rawData) return null;
  const SCHOLARSHIPS = {
    DEFENCE:  { code: 'DEFENCE',  name: 'Defence Personnel Scholarship',        pct: 20 },
    ALUMNI:   { code: 'ALUMNI',   name: 'SRM Alumni Scholarship',               pct: 20 },
    REGIONAL: { code: 'REGIONAL', name: 'Sikkim & Northeast Region Scholarship', pct: 30 },
  };

  // Check eligibility field
  const eligible = (rawData['Are You Eligible For Any Scholarship?'] || '').toString().toUpperCase().trim();

  // Check individual fields regardless of eligibility flag (some records may have it blank)
  const isDefence  = (rawData['Are You A Defense Personnel Member?'] || '').toString().toUpperCase().trim() === 'YES';
  const isRegional = (rawData['Are You From Northeast Region?'] || '').toString().toUpperCase().trim() === 'YES';
  const isAlumni   = (rawData['Are You An SRM Group Alumni?'] || '').toString().toUpperCase().trim() === 'YES';

  // Also check Scholarship Type field directly
  const scholarshipType = (rawData['Scholarship Type'] || '').toString().toUpperCase().trim();
  if (scholarshipType && SCHOLARSHIPS[scholarshipType]) return SCHOLARSHIPS[scholarshipType];

  // If none of the individual fields are YES and eligibility is NO, return null
  if (!isDefence && !isRegional && !isAlumni && eligible === 'NO') return null;
  if (!isDefence && !isRegional && !isAlumni && eligible !== 'YES') return null;

  const candidates = [];
  if (isDefence)  candidates.push(SCHOLARSHIPS.DEFENCE);
  if (isRegional) candidates.push(SCHOLARSHIPS.REGIONAL);
  if (isAlumni)   candidates.push(SCHOLARSHIPS.ALUMNI);
  if (candidates.length === 0) return null;
  // Return only the highest scholarship
  return candidates.reduce((best, c) => (c.pct > best.pct ? c : best), candidates[0]);
}

function detectPlanInline(rawData) {
  if (!rawData) return 'SEMESTER';

  // Primary: What Are You Willing To Pay
  const willing = (rawData['What Are You Willing To Pay'] || '').toString().toUpperCase().trim();
  const PLAN_MAP = { 'FULL COURSE FEE': 'FULL', 'ANNUAL FEE': 'ANNUAL', 'SEMESTER FEE': 'SEMESTER', 'EMI': 'EMI' };
  if (PLAN_MAP[willing]) return PLAN_MAP[willing];

  // Secondary: Payment Method field (index 265 in Excel)
  const method = (rawData['Payment Method'] || '').toString().toUpperCase().trim();
  if (method === 'EMI') return 'EMI';
  if (method === 'PAY INSTANTLY') {
    // Fall through to Token Fee Name
  }

  // Tertiary: Token Fee Name
  const tokenName = (rawData['Token Fee Name'] || '').toString().toUpperCase().trim();
  if (tokenName.includes('FULL COURSE') || tokenName.includes('FULL PROGRAM')) return 'FULL';
  if (tokenName.includes('ANNUAL'))   return 'ANNUAL';
  if (tokenName.includes('SEMESTER')) return 'SEMESTER';

  return 'SEMESTER';
}

function r2(n) { return Math.round(n * 100) / 100; }

function calcFeesInline(programCode, paymentPlan, scholarship) {
  const structure = FEE_MAP[programCode];
  if (!structure) throw new Error(`Unknown program: ${programCode}`);
  const { full_program_fee, total_semesters } = structure;
  const semester_fee     = full_program_fee / total_semesters;
  const annual_fee       = full_program_fee / (total_semesters / 2);
  const scholarshipPct   = scholarship ? scholarship.pct : 0;
  const scholarship_amt  = r2(full_program_fee * scholarshipPct / 100);
  const after_scholar    = r2(full_program_fee - scholarship_amt);
  const DISC = { FULL: { type: 'FULL_COURSE', pct: 10 }, ANNUAL: { type: 'ANNUAL', pct: 5 }, SEMESTER: { type: null, pct: 0 }, EMI: { type: null, pct: 0 } };
  const disc        = DISC[paymentPlan] || DISC.SEMESTER;
  const discount_amt = r2(after_scholar * disc.pct / 100);
  const net_fee      = r2(after_scholar - discount_amt);
  return {
    full_program_fee, total_semesters,
    semester_fee: r2(semester_fee), annual_fee: r2(annual_fee),
    scholarship_code: scholarship?.code || null, scholarship_name: scholarship?.name || null,
    scholarship_pct: scholarshipPct, scholarship_amount: scholarship_amt,
    discount_type: disc.type, discount_pct: disc.pct, discount_amount: discount_amt, net_fee,
  };
}

function parseDateSafeInline(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  const d = new Date(val);
  return isNaN(d) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
}

async function autoSetupFinance(student) {
  const programCode     = normalisePCode(student.program_name);
  const rawData         = student.raw_data || {};
  const intake          = rawData['Intake'] || rawData['intake'] || student.intake || null;
  const academicYear    = rawData['Academic Year'] || rawData['academic_year'] || student.academic_year || null;
  const scholarship     = detectScholarshipInline(rawData);
  const paymentPlan     = detectPlanInline(rawData);
  const fees            = calcFeesInline(programCode, paymentPlan, scholarship);
  const tokenAmt        = parseFloat(rawData['Token Fee Amount']) || 0;
  const merrittoPaid    = tokenAmt > 0 ? tokenAmt : 0;

  const { data: financeRow, error: finErr } = await supabase
    .from('student_finance')
    .insert({
      student_id:         student.id,
      enrollment_no:      student.enrollment_no,
      program_code:       programCode,
      program_name:       student.program_name,
      intake,
      academic_year:      academicYear,
      full_program_fee:   fees.full_program_fee,
      total_semesters:    fees.total_semesters,
      semester_fee:       fees.semester_fee,
      annual_fee:         fees.annual_fee,
      payment_plan:       paymentPlan,
      emi_partner:        paymentPlan === 'EMI' ? 'GRAYQUEST' : null,
      scholarship_code:   fees.scholarship_code,
      scholarship_name:   fees.scholarship_name,
      scholarship_pct:    fees.scholarship_pct,
      scholarship_amount: fees.scholarship_amount,
      discount_type:      fees.discount_type,
      discount_pct:       fees.discount_pct,
      discount_amount:    fees.discount_amount,
      net_fee:            fees.net_fee,
      pre_admission_paid: 10000,
      merritto_paid:      merrittoPaid,
    })
    .select()
    .single();

  if (finErr) throw finErr;

  const txns = [
    {
      finance_id:      financeRow.id,
      enrollment_no:   student.enrollment_no,
      payment_source:  'PRE_ADMISSION',
      transaction_ref: null,
      amount:          10000,
      payment_method:  'CASH',
      payment_date:    student.created_at
        ? new Date(student.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      payment_for:     'PRE_ADMISSION',
      status:          'SUCCESS',
      notes:           'Pre-admission fee collected separately before Merritto',
    },
  ];

  if (merrittoPaid > 0) {
    txns.push({
      finance_id:      financeRow.id,
      enrollment_no:   student.enrollment_no,
      payment_source:  'MERRITTO',
      transaction_ref: rawData['Token Fee Transcation ID'] ? String(rawData['Token Fee Transcation ID']) : null,
      amount:          merrittoPaid,
      payment_method:  (rawData['Token Fee Method'] || 'ONLINE').toString().toUpperCase(),
      payment_date:    parseDateSafeInline(rawData['Token Fee Date']),
      payment_for:     paymentPlan,
      status:          'SUCCESS',
      notes:           'Payment collected via Merritto (Token Fee)',
    });
  }

  const { error: txnErr } = await supabase.from('payment_transactions').insert(txns);
  if (txnErr) throw txnErr;

  return financeRow;
}

export async function enrollStudent(row, lookupIds) {
  const rawData = row.raw_data || row;  // Use raw_data if available, fallback to row
  
  const fullName = row.full_name_as_per_your_10th_marksheet || '';
  const yearCode = getYearCode(row.academic_year);

  const officialEmail = generateOfficialEmail(
    fullName, row.course, row.intake, yearCode
  );
  const password = generatePassword(fullName);

  const { firstName, middleName, lastName } = parseName(fullName);
  const today = new Date().toISOString().split('T')[0];
  // Numeric/integer converters — return null instead of '' for empty values
  const toNum = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const toInt = v => { const n = parseInt(v);   return isNaN(n) ? null : n; };
  const mobile = String(row.mobile_number || '').trim();
  const whatsapp = String(rawData['Whatsapp Number'] || rawData['WhatsApp Number'] || '').trim();
  const parentMobile = String(rawData['Parent / Guardian Number'] || rawData['Parent/Guardian Number'] || '').trim();

  // Convert Excel numeric dates or string dates to ISO format (YYYY-MM-DD)
  const dob = convertToISODate(rawData['Date Of Birth'] || rawData['Date of Birth']);

  // 1 — INSERT student_master (flat Student Page record)
  const { error: e1 } = await supabase
    .from('student_master')
    .insert({
      application_no:            row.application_no,
      enrollment_no:             row.enrollment_no,
      official_email:            officialEmail,
      student_status:            'ENROLLED',
      current_semester:          1,
      program_name:              row.course,
      specialization:            rawData['Specialization'] || '',
      admission_type:            'Normal',
      admission_date:            today,
      full_name:                 fullName,
      title:                     rawData['Title'] || '',
      gender:                    rawData['Gender'] || '',
      dob,
      mobile,
      whatsapp_no:               whatsapp,
      personal_email:            row.email_id,
      religion:                  rawData['Religion'] || '',
      category:                  rawData['Category'] || '',
      blood_group:               rawData['Blood Group'] || '',
      marital_status:            rawData['Marital Status'] || '',
      parent_name:               rawData['Parent / Guardian Name'] || rawData['Parent/Guardian Name'] || '',
      parent_mobile:             parentMobile,
      parent_email:              rawData['Parent / Guardian Email'] || rawData['Parent/Guardian Email'] || '',
      aadhaar_no:                rawData['Aadhaar Number'] || '',
      abc_id:                    rawData['Your ABC (Academic Bank of Credits) ID number'] || rawData['ABC ID'] || '',
      deb_id:                    rawData['DEB ID'] || '',
      deb_status:                rawData['DEB Status'] || '',
      country:                   rawData['Country'] || '',
      state:                     rawData['State'] || '',
      district:                  rawData['District'] || '',
      city:                      rawData['City'] || '',
      address_line_1:            rawData['Address Line 1'] || '',
      address_line_2:            rawData['Address Line 2'] || '',
      pincode:                   rawData['Pincode'] || '',
      permanent_same_as_current: true,
      permanent_country:         rawData['Country'] || '',
      permanent_state:           rawData['State'] || '',
      permanent_district:        rawData['District'] || '',
      permanent_city:            rawData['City'] || '',
      permanent_address_line_1:  rawData['Address Line 1'] || '',
      permanent_address_line_2:  rawData['Address Line 2'] || '',
      permanent_pincode:         rawData['Pincode'] || '',
      // ── Basic Details ──────────────────────────────────────────────────
      nationality:               rawData['Nationality'] || '',
      studied_from_india:        rawData['Have You Studied from India'] || '',

      // ── Program Details ────────────────────────────────────────────────
      dynamic_series:            rawData['Dynamic Series'] || '',

      // ── Personal Details ───────────────────────────────────────────────
      alternate_email:           rawData['Alternate Email ID'] || rawData['Alternate Email Id'] || '',
      parent_title:              rawData['Parent / Guardian Title'] || '',

      // ── Class Xth/SSC ──────────────────────────────────────────────────
      class_10_school:           rawData['Class Xth/SSC-School Name'] || rawData['Class Xth/SSC/O Level - School Name'] || '',
      class_10_board:            rawData['Class Xth/SSC-Board'] || rawData['Class Xth/SSC/O Level - Board'] || '',
      class_10_year:             toInt(rawData['Class Xth/SSC-Year of Passing'] || rawData['Class Xth/SSC/O Level - Year Of Passing']),
      class_10_marking_scheme:   rawData['Class Xth/SSC-Marking Scheme'] || '',
      class_10_percentage:       rawData['Class Xth/SSC-Percentage/CGPA'] || rawData['Class Xth/SSC/O Level - Percentage/CGPA'] || '',
      x_percentage:              toNum(rawData['Class Xth/SSC-Percentage/CGPA'] || rawData['Class Xth/SSC/O Level - Percentage/CGPA']),
      x_year_of_passing:         toInt(rawData['Class Xth/SSC-Year of Passing'] || rawData['Class Xth/SSC/O Level - Year Of Passing']),
      qualification_status_12:   rawData['Qualification Status for XII'] || '',

      // ── Class XIIth/HSC ────────────────────────────────────────────────
      class_12_school:           rawData['Class XIIth/HSC-School Name'] || rawData['Class XIIth/HSC/Senior Secondary School - School / Institution Name'] || '',
      class_12_board:            rawData['Class XIIth/HSC-Board'] || rawData['Class XIIth/HSC/Senior Secondary School - Board'] || '',
      class_12_stream:           rawData['Class XIIth/HSC-Stream'] || rawData['Class XIIth/HSC/Senior Secondary School - Stream'] || '',
      class_12_year:             toInt(rawData['Class XIIth/HSC-Year of Passing'] || rawData['Class XIIth/HSC/Senior Secondary School - Year Of Passing']),
      class_12_marking_scheme:   rawData['Class XIIth/HSC-Marking Scheme'] || '',
      class_12_percentage:       rawData['Class XIIth/HSC-Percentage/CGPA'] || rawData['Class XIIth/HSC/Senior Secondary School - Percentage/CGPA'] || '',
      xii_percentage:            toNum(rawData['Class XIIth/HSC-Percentage/CGPA'] || rawData['Class XIIth/HSC/Senior Secondary School - Percentage/CGPA']),
      xii_year_of_passing:       toInt(rawData['Class XIIth/HSC-Year of Passing'] || rawData['Class XIIth/HSC/Senior Secondary School - Year Of Passing']),

      // ── Graduation / UG ────────────────────────────────────────────────
      qualification_status_pg:   rawData['Qualification Status for PG'] || '',
      ug_college:                rawData['UG-College / University Name'] || '',
      ug_degree:                 rawData['UG-Name of Degree'] || '',
      ug_year:                   rawData['UG-Year of Passing'] ? String(rawData['UG-Year of Passing']) : '',
      ug_year_of_passing:        toInt(rawData['UG-Year of Passing']),
      ug_mode:                   rawData['UG-Mode of Study'] || '',
      ug_marking_scheme:         rawData['UG-Marking Scheme'] || '',
      ug_percentage:             toNum(rawData['UG-Percentage/CGPA']),

      // ── Aadhaar & IDs ──────────────────────────────────────────────────
      aadhaar_name:              rawData['Your Name as Per Aadhaar'] || '',
      aadhaar_linked_mobile:     rawData['Have You linked your mobile no with aadhaar?'] || '',

      // ── Applicant Additional ───────────────────────────────────────────
      pursuing_other_degree:     rawData['Are you currently pursuing any other degree?'] || '',

      // ── Scholarship ────────────────────────────────────────────────────
      scholarship_eligible:      rawData['Are You Eligible For Any Scholarship?'] || rawData['Are you eligible for any Scholarship?'] || '',
      scholarship_type:          rawData['Scholarship Type'] || rawData['Scholarship type'] || '',
      is_defence:                (rawData['Are You A Defense Personnel Member?'] || rawData['Are you a defense personnel member?'] || '').toString().toUpperCase() === 'YES',
      is_northeast:              (rawData['Are You From Northeast Region?'] || rawData['Are you from Northeast Region?'] || '').toString().toUpperCase() === 'YES',
      is_srm_alumni:             (rawData['Are You An SRM Group Alumni?'] || rawData['Are you an SRM group Alumni?'] || '').toString().toUpperCase() === 'YES',
      defence_service_id:        rawData['Defense Personnel Service ID Number'] || rawData['Defense Personnel Service ID number'] || '',
      srm_institute_name:        rawData['Name of the SRM Institute / Entity'] || '',

      // ── Payment ────────────────────────────────────────────────────────
      willing_to_pay:            rawData['What Are You Willing To Pay'] || rawData['What Are you willing to pay'] || '',
      payment_method_chosen:     rawData['Payment Method'] || '',

      // ── Raw data (everything else) ─────────────────────────────────────
      raw_data:                  rawData,

      // ── ERP generated ──────────────────────────────────────────────────
      official_email:            officialEmail,
      login_password:            password,
      password_generated:        true,
      email_activation_status:   'PENDING',
      welcome_email_sent:        false,
    });
  if (e1) throw e1;

  // 2 — Fetch the newly inserted student_master row to get its id
  const { data: newStudent, error: e2 } = await supabase
    .from('student_master')
    .select('id, enrollment_no, program_name, raw_data, official_email, mobile, created_at')
    .eq('enrollment_no', row.enrollment_no)
    .single();
  if (e2) throw e2;

  // 3 — Auto-create finance record (parallel to enrollment)
  try {
    await autoSetupFinance({
      ...newStudent,
      intake:        row.intake,
      academic_year: row.academic_year,
    });
  } catch (financeErr) {
    // Finance setup failure should not block enrollment
    console.error('Finance auto-setup failed for', row.enrollment_no, financeErr);
  }

  // 4 — DELETE from merrito_import (row fully moved to Student Page)
  const { error: e3 } = await supabase
    .from('merrito_import')
    .delete()
    .eq('id', row.id);
  if (e3) throw e3;

  return { officialEmail, password };
}