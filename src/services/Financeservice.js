import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const PRE_ADMISSION_FEE = 10000;

export const FEE_STRUCTURES = {
  MBA: { full_program_fee: 110000, total_semesters: 4 },
  MCA: { full_program_fee: 100000, total_semesters: 4 },
  BBA: { full_program_fee: 117000, total_semesters: 6 },
  BCA: { full_program_fee: 117000, total_semesters: 6 },
};

export function getSemesterFee(programCode) {
  const f = FEE_STRUCTURES[programCode];
  if (!f) return 0;
  return f.full_program_fee / f.total_semesters;
}

export function getAnnualFee(programCode) {
  const f = FEE_STRUCTURES[programCode];
  if (!f) return 0;
  return f.full_program_fee / (f.total_semesters / 2);
}

export const SCHOLARSHIPS = {
  DEFENCE:  { code: 'DEFENCE',  name: 'Defence Personnel Scholarship',         pct: 20 },
  ALUMNI:   { code: 'ALUMNI',   name: 'SRM Alumni Scholarship',                pct: 20 },
  REGIONAL: { code: 'REGIONAL', name: 'Sikkim & Northeast Region Scholarship', pct: 30 },
};

const PLAN_MAP = {
  'FULL COURSE FEE': 'FULL',
  'ANNUAL FEE':      'ANNUAL',
  'SEMESTER FEE':    'SEMESTER',
  'EMI':             'EMI',
};

const DISCOUNT_MAP = {
  FULL:     { type: 'FULL_COURSE', pct: 10 },
  ANNUAL:   { type: 'ANNUAL',      pct: 5  },
  SEMESTER: { type: null,          pct: 0  },
  EMI:      { type: null,          pct: 0  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHOLARSHIP DETECTION FROM raw_data
// ─────────────────────────────────────────────────────────────────────────────

export function detectScholarship(rawData) {
  if (!rawData) return null;

  const scholarshipType = (rawData['Scholarship Type'] || '').toString().toUpperCase().trim();
  if (scholarshipType && SCHOLARSHIPS[scholarshipType]) return SCHOLARSHIPS[scholarshipType];

  const isDefence  = (rawData['Are You A Defense Personnel Member?'] || '').toString().toUpperCase().trim() === 'YES';
  const isRegional = (rawData['Are You From Northeast Region?'] || '').toString().toUpperCase().trim() === 'YES';
  const isAlumni   = (rawData['Are You An SRM Group Alumni?'] || '').toString().toUpperCase().trim() === 'YES';
  const eligible   = (rawData['Are You Eligible For Any Scholarship?'] || '').toString().toUpperCase().trim();

  if (!isDefence && !isRegional && !isAlumni && eligible !== 'YES') return null;

  const candidates = [];
  if (isDefence)  candidates.push(SCHOLARSHIPS.DEFENCE);
  if (isRegional) candidates.push(SCHOLARSHIPS.REGIONAL);
  if (isAlumni)   candidates.push(SCHOLARSHIPS.ALUMNI);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.pct > best.pct ? c : best), candidates[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT PLAN DETECTION FROM raw_data
// ─────────────────────────────────────────────────────────────────────────────

export function detectPaymentPlan(rawData) {
  if (!rawData) return 'SEMESTER';
  const PLAN_MAP = { 'FULL COURSE FEE': 'FULL', 'ANNUAL FEE': 'ANNUAL', 'SEMESTER FEE': 'SEMESTER', 'EMI': 'EMI' };

  const willing = (rawData['What Are You Willing To Pay'] || '').toString().toUpperCase().trim();
  if (PLAN_MAP[willing]) return PLAN_MAP[willing];

  const method = (rawData['Payment Method'] || '').toString().toUpperCase().trim();
  if (method === 'EMI') return 'EMI';

  const tokenName = (rawData['Token Fee Name'] || '').toString().toUpperCase().trim();
  if (tokenName.includes('FULL COURSE') || tokenName.includes('FULL PROGRAM')) return 'FULL';
  if (tokenName.includes('ANNUAL'))   return 'ANNUAL';
  if (tokenName.includes('SEMESTER')) return 'SEMESTER';

  return 'SEMESTER';
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function calculateFees(programCode, paymentPlan, scholarship) {
  const structure = FEE_STRUCTURES[programCode];
  if (!structure) throw new Error(`Unknown program code: ${programCode}`);

  const { full_program_fee, total_semesters } = structure;
  const semester_fee = full_program_fee / total_semesters;
  const annual_fee   = full_program_fee / (total_semesters / 2);

  const scholarshipPct     = scholarship ? scholarship.pct : 0;
  const scholarship_amount = round2(full_program_fee * scholarshipPct / 100);
  const after_scholarship  = round2(full_program_fee - scholarship_amount);

  const discountDef     = DISCOUNT_MAP[paymentPlan] || DISCOUNT_MAP.SEMESTER;
  const discount_pct    = discountDef.pct;
  const discount_type   = discountDef.type;
  const discount_amount = round2(after_scholarship * discount_pct / 100);
  const net_fee         = round2(after_scholarship - discount_amount);

  return {
    full_program_fee,
    total_semesters,
    semester_fee:      round2(semester_fee),
    annual_fee:        round2(annual_fee),
    scholarship_code:  scholarship?.code  || null,
    scholarship_name:  scholarship?.name  || null,
    scholarship_pct:   scholarshipPct,
    scholarship_amount,
    discount_type,
    discount_pct,
    discount_amount,
    net_fee,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MERRITTO PAYMENT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function parseDateSafe(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

export function extractMerrittoPayment(rawData) {
  if (!rawData) return null;
  const amount = parseFloat(rawData['Token Fee Amount']) || 0;
  if (amount <= 0) return null;

  return {
    amount,
    transactionRef: rawData['Token Fee Transcation ID']
      ? String(rawData['Token Fee Transcation ID'])
      : null,
    paymentDate:   parseDateSafe(rawData['Token Fee Date']),
    paymentMethod: (rawData['Token Fee Method'] || 'ONLINE').toString().toUpperCase(),
    paymentFor:    detectPaymentPlan(rawData),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISE PROGRAM CODE
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseProgramCode(val) {
  if (!val) return 'MBA';
  const v = val.toString().toUpperCase();
  if (v === 'MBA' || v === 'MB') return 'MBA';
  if (v === 'MCA' || v === 'MC') return 'MCA';
  if (v === 'BBA' || v === 'BB') return 'BBA';
  if (v === 'BCA' || v === 'BC') return 'BCA';
  if (v.includes('MBA') || (v.includes('BUSINESS') && v.includes('MASTER')))   return 'MBA';
  if (v.includes('MCA') || (v.includes('COMPUTER') && v.includes('MASTER')))   return 'MCA';
  if (v.includes('BBA') || (v.includes('BUSINESS') && v.includes('BACHELOR'))) return 'BBA';
  if (v.includes('BCA') || (v.includes('COMPUTER') && v.includes('BACHELOR'))) return 'BCA';
  return v.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP FINANCE RECORD
// ─────────────────────────────────────────────────────────────────────────────

export async function setupStudentFinance(student) {
  const programCode  = normaliseProgramCode(student.program_name || student.program_code);
  const rawData      = student.raw_data || {};

  // intake and academic_year live in raw_data (not flat columns in student_master)
  const intake       = rawData['Intake'] || rawData['intake'] || student.intake || null;
  const academicYear = rawData['Academic Year'] || rawData['academic_year'] || student.academic_year || null;

  const scholarship     = detectScholarship(rawData);
  const paymentPlan     = detectPaymentPlan(rawData);
  const fees            = calculateFees(programCode, paymentPlan, scholarship);
  const merrittoPayment = extractMerrittoPayment(rawData);
  const merrittoPaid    = merrittoPayment ? merrittoPayment.amount : 0;

  const { data: financeRow, error: financeErr } = await supabase
    .from('student_finance')
    .insert({
      student_id:         student.id,
      enrollment_no:      student.enrollment_no,
      program_code:       programCode,
      program_name:       student.program_name,
      intake:             intake,
      academic_year:      academicYear,

      full_program_fee:   fees.full_program_fee,
      total_semesters:    fees.total_semesters,
      semester_fee:       fees.semester_fee,
      annual_fee:         fees.annual_fee,

      payment_plan:       paymentPlan,
      emi_partner:        paymentPlan === 'EMI' ? 'GRAYQUEST' : null,
      emi_tenure_months:  null,
      emi_monthly_amount: null,

      scholarship_code:   fees.scholarship_code,
      scholarship_name:   fees.scholarship_name,
      scholarship_pct:    fees.scholarship_pct,
      scholarship_amount: fees.scholarship_amount,

      discount_type:      fees.discount_type,
      discount_pct:       fees.discount_pct,
      discount_amount:    fees.discount_amount,

      net_fee:            fees.net_fee,

      pre_admission_paid: PRE_ADMISSION_FEE,
      merritto_paid:      merrittoPaid,
    })
    .select()
    .single();

  if (financeErr) throw financeErr;

  const financeId = financeRow.id;

  const txns = [
    {
      finance_id:      financeId,
      enrollment_no:   student.enrollment_no,
      payment_source:  'PRE_ADMISSION',
      transaction_ref: null,
      amount:          PRE_ADMISSION_FEE,
      payment_method:  'CASH',
      payment_date:    student.created_at
        ? new Date(student.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      payment_for:     'PRE_ADMISSION',
      status:          'SUCCESS',
      notes:           'Pre-admission fee collected separately before Merritto',
    },
  ];

  if (merrittoPayment && merrittoPayment.amount > 0) {
    txns.push({
      finance_id:      financeId,
      enrollment_no:   student.enrollment_no,
      payment_source:  'MERRITTO',
      transaction_ref: merrittoPayment.transactionRef,
      amount:          merrittoPayment.amount,
      payment_method:  merrittoPayment.paymentMethod,
      payment_date:    merrittoPayment.paymentDate,
      payment_for:     merrittoPayment.paymentFor,
      status:          'SUCCESS',
      notes:           'Payment collected via Merritto (Token Fee)',
    });
  }

  const { error: txnErr } = await supabase
    .from('payment_transactions')
    .insert(txns);

  if (txnErr) throw txnErr;

  return financeRow;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD ERP PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPayment({
  financeId,
  enrollmentNo,
  amount,
  paymentMethod,
  paymentDate,
  transactionRef,
  paymentFor,
  receiptNo,
  notes,
}) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .insert({
      finance_id:      financeId,
      enrollment_no:   enrollmentNo,
      payment_source:  'ERP',
      transaction_ref: transactionRef || null,
      amount,
      payment_method:  paymentMethod,
      payment_date:    paymentDate,
      payment_for:     paymentFor || null,
      status:          'SUCCESS',
      receipt_no:      receiptNo || null,
      notes:           notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH RECORDS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinanceRecords(filters = {}) {
  let query = supabase
    .from('student_finance')
    .select(`
      *,
      student_master (
        full_name,
        personal_email,
        official_email,
        mobile,
        specialization,
        raw_data
      )
    `)
    .order('created_at', { ascending: false });

  if (filters.program_code)   query = query.eq('program_code',   filters.program_code);
  if (filters.payment_status) query = query.eq('payment_status', filters.payment_status);
  if (filters.academic_year)  query = query.eq('academic_year',  filters.academic_year);
  if (filters.intake)         query = query.eq('intake',         filters.intake);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    ...row,
    full_name:      row.student_master?.full_name      || '',
    personal_email: row.student_master?.personal_email || '',
    official_email: row.student_master?.official_email || '',
    mobile:         row.student_master?.mobile         || '',
    specialization: row.student_master?.specialization || '',
    raw_data:       row.student_master?.raw_data       || {},
  }));
}

export async function fetchStudentsWithoutFinance() {
  const { data: students, error } = await supabase
    .from('student_master')
.select('id, enrollment_no, full_name, program_name, raw_data, created_at, official_email, mobile')
    .not('enrollment_no', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: existing } = await supabase
    .from('student_finance')
    .select('enrollment_no');

  const existingSet = new Set((existing || []).map(r => r.enrollment_no));
  return (students || []).filter(s => !existingSet.has(s.enrollment_no));
}

export async function fetchPaymentHistory(financeId) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('finance_id', financeId)
    .order('payment_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchRevenueByMonth() {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('payment_date, amount, status')
    .eq('status', 'SUCCESS');

  if (error) throw error;

  const byMonth = {};
  for (const row of data || []) {
    const month = row.payment_date ? row.payment_date.slice(0, 7) : 'Unknown';
    byMonth[month] = (byMonth[month] || 0) + parseFloat(row.amount || 0);
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

export async function fetchOutstandingByProgram() {
  const { data, error } = await supabase
    .from('student_finance')
    .select('program_code, balance_due, payment_status');

  if (error) throw error;

  const byProgram = {};
  for (const row of data || []) {
    const p = row.program_code;
    if (!byProgram[p]) byProgram[p] = { program_code: p, total_outstanding: 0, student_count: 0 };
    if (parseFloat(row.balance_due || 0) > 0) {
      byProgram[p].total_outstanding += parseFloat(row.balance_due || 0);
      byProgram[p].student_count += 1;
    }
  }
  return Object.values(byProgram);
}

export async function fetchScholarshipSummary() {
  const { data, error } = await supabase
    .from('student_finance')
    .select('scholarship_code, scholarship_name, scholarship_amount, scholarship_pct')
    .not('scholarship_code', 'is', null);

  if (error) throw error;

  const summary = {};
  for (const row of data || []) {
    const code = row.scholarship_code;
    if (!summary[code]) {
      summary[code] = {
        scholarship_code: code,
        scholarship_name: row.scholarship_name,
        scholarship_pct:  row.scholarship_pct,
        total_discount:   0,
        student_count:    0,
      };
    }
    summary[code].total_discount += parseFloat(row.scholarship_amount || 0);
    summary[code].student_count  += 1;
  }
  return Object.values(summary);
}

export async function fetchPaymentMethodBreakdown() {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('payment_method, amount, status')
    .eq('status', 'SUCCESS');

  if (error) throw error;

  const byMethod = {};
  for (const row of data || []) {
    const m = row.payment_method || 'UNKNOWN';
    byMethod[m] = (byMethod[m] || 0) + parseFloat(row.amount || 0);
  }
  return Object.entries(byMethod).map(([method, total]) => ({ method, total }));
}

export async function fetchFinanceSummary() {
  const { data, error } = await supabase
    .from('student_finance')
    .select('net_fee, total_paid, balance_due, payment_status');

  if (error) throw error;

  const rows = data || [];
  return {
    total_students:    rows.length,
    total_net_fee:     rows.reduce((s, r) => s + parseFloat(r.net_fee     || 0), 0),
    total_collected:   rows.reduce((s, r) => s + parseFloat(r.total_paid  || 0), 0),
    total_outstanding: rows.reduce((s, r) => s + parseFloat(r.balance_due || 0), 0),
    pending_count:     rows.filter(r => r.payment_status === 'PENDING').length,
    partial_count:     rows.filter(r => r.payment_status === 'PARTIAL').length,
    completed_count:   rows.filter(r => r.payment_status === 'COMPLETED').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────

export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const PAYMENT_PLAN_LABELS = {
  FULL:     'Full Course',
  ANNUAL:   'Annual',
  SEMESTER: 'Semester',
  EMI:      'EMI (Grayquest)',
};

export const PAYMENT_STATUS_COLORS = {
  PENDING:   { bg: '#FEF9C3', text: '#854D0E' },
  PARTIAL:   { bg: '#DBEAFE', text: '#1E40AF' },
  COMPLETED: { bg: '#DCFCE7', text: '#166534' },
};