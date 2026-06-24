import { supabase } from '../supabaseClient';

// ── Program maps ───────────────────────────────────────────────────────────────

export const PROGRAM_CODES = {
  MBA: 'MB',
  MCA: 'MC',
  BBA: 'BB',
  BCA: 'BC',
};

// Used in official email: annamalai.mbaJuly26@srmus.edu.in
export const PROGRAM_EMAIL_NAMES = {
  MBA: 'mba',
  MCA: 'mca',
  BBA: 'bba',
  BCA: 'bca',
};

// Full intake name for email: JUL → july, JAN → january
export const INTAKE_FULL_NAMES = {
  JAN: 'january',
  JUL: 'july',
};

// Session code for enrollment number: 1=Jan, 2=Jul
export const INTAKE_CODES = {
  JAN: '1',
  JUL: '2',
};

// ── Helper functions ───────────────────────────────────────────────────────────

export function getProgramCode(program) {
  const v = (program || '').toUpperCase().trim();
  if (v === 'MBA' || v === 'MB' || v.includes('BUSINESS') && v.includes('MASTER'))   return 'MB';
  if (v === 'MCA' || v === 'MC' || v.includes('COMPUTER') && v.includes('MASTER'))   return 'MC';
  if (v === 'BBA' || v === 'BB' || v.includes('BUSINESS') && v.includes('BACHELOR')) return 'BB';
  if (v === 'BCA' || v === 'BC' || v.includes('COMPUTER') && v.includes('BACHELOR')) return 'BC';
  return PROGRAM_CODES[v] || 'XX';
}

export function getProgramShortCode(program) {
  const code = getProgramCode(program);
  const map = { MB: 'MBA', MC: 'MCA', BB: 'BBA', BC: 'BCA' };
  return map[code] || code;
}

export function getIntakeCode(intake) {
  return INTAKE_CODES[(intake || '').toUpperCase().trim()] || '2';
}

// Returns full intake name for email: 'JUL' → 'July', 'JAN' → 'January'
export function getIntakeFullName(intake) {
  return INTAKE_FULL_NAMES[(intake || '').toUpperCase().trim()] || 'July';
}

export function getYearCode(academicYear) {
  const y = (academicYear || '').toString().trim();
  // Always return last 2 digits: '2026' -> '26', '26' -> '26'
  return y.length === 4 ? y.slice(2) : y;
}

export async function generateEnrollmentNumber(
  programCode,
  sessionCode,
  yearCode,
  admissionType = '0'
) {
  const { data, error } = await supabase.rpc('generate_enrollment_number', {
    p_program_code:   programCode,
    p_session_code:   sessionCode,
    p_year_code:      yearCode,
    p_admission_type: admissionType,
  });
  if (error) throw error;
  return data;
}