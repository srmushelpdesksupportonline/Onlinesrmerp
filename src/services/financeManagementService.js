import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMIC YEARS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAcademicYears() {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAcademicYear({ label, start_date, end_date, is_active }) {
  // If setting active, deactivate all others first
  if (is_active) {
    await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true);
  }
  const { data, error } = await supabase
    .from('academic_years')
    .insert({ label, start_date, end_date, is_active: !!is_active })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAcademicYear(id, updates) {
  if (updates.is_active) {
    await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true);
  }
  const { data, error } = await supabase
    .from('academic_years')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAcademicYear(id) {
  const { error } = await supabase.from('academic_years').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFeeBlocks(filters = {}) {
  let query = supabase
    .from('fee_blocks')
    .select(`
      *,
      academic_years ( label ),
      fee_components ( id, component_name, amount, is_optional, sort_order )
    `)
    .order('created_at', { ascending: false });

  if (filters.program_code) query = query.eq('program_code', filters.program_code);
  if (filters.status)       query = query.eq('status', filters.status);
  if (filters.fee_type)     query = query.eq('fee_type', filters.fee_type);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(block => ({
    ...block,
    academic_year_label: block.academic_years?.label || '—',
    total_amount: (block.fee_components || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0),
    fee_components: (block.fee_components || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function createFeeBlock({ block_name, program_code, academic_year_id, semester, fee_type, description, status = 'ACTIVE' }) {
  const { data, error } = await supabase
    .from('fee_blocks')
    .insert({ block_name, program_code, academic_year_id: academic_year_id || null, semester: semester || null, fee_type, description: description || null, status })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFeeBlock(id, updates) {
  const { data, error } = await supabase
    .from('fee_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeeBlock(id) {
  const { error } = await supabase.from('fee_blocks').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function createFeeComponent({ block_id, component_name, amount, is_optional = false, sort_order = 0 }) {
  const { data, error } = await supabase
    .from('fee_components')
    .insert({ block_id, component_name, amount: parseFloat(amount), is_optional, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFeeComponent(id, updates) {
  const { data, error } = await supabase
    .from('fee_components')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeeComponent(id) {
  const { error } = await supabase.from('fee_components').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertFeeComponents(block_id, components) {
  // Delete existing and re-insert (simplest for a small list)
  await supabase.from('fee_components').delete().eq('block_id', block_id);
  if (!components || components.length === 0) return [];
  const rows = components.map((c, i) => ({
    block_id,
    component_name: c.component_name,
    amount:         parseFloat(c.amount || 0),
    is_optional:    !!c.is_optional,
    sort_order:     i,
  }));
  const { data, error } = await supabase.from('fee_components').insert(rows).select();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFeeAssignments(filters = {}) {
  let query = supabase
    .from('fee_assignments')
    .select(`
      *,
      fee_blocks ( block_name, program_code, fee_type, status,
        fee_components ( amount )
      ),
      academic_years ( label )
    `)
    .order('assigned_at', { ascending: false });

  if (filters.program_code)    query = query.eq('program_code', filters.program_code);
  if (filters.enrollment_no)   query = query.eq('enrollment_no', filters.enrollment_no);
  if (filters.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(a => ({
    ...a,
    block_name:          a.fee_blocks?.block_name || '—',
    block_program_code:  a.fee_blocks?.program_code || '—',
    block_fee_type:      a.fee_blocks?.fee_type || '—',
    block_status:        a.fee_blocks?.status || '—',
    block_total:         (a.fee_blocks?.fee_components || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0),
    academic_year_label: a.academic_years?.label || '—',
  }));
}

export async function createFeeAssignment({ block_id, enrollment_no, program_code, semester, academic_year_id, batch, assigned_by, notes }) {
  const { data, error } = await supabase
    .from('fee_assignments')
    .insert({
      block_id,
      enrollment_no:     enrollment_no || null,
      program_code:      program_code  || null,
      semester:          semester      || null,
      academic_year_id:  academic_year_id || null,
      batch:             batch         || null,
      assigned_by:       assigned_by   || null,
      notes:             notes         || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeeAssignment(id) {
  const { error } = await supabase.from('fee_assignments').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE FEES
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGeneratedFees(filters = {}) {
  let query = supabase
    .from('generated_fees')
    .select(`
      *,
      fee_blocks ( block_name, fee_type )
    `)
    .order('generated_at', { ascending: false });

  if (filters.enrollment_no) query = query.eq('enrollment_no', filters.enrollment_no);
  if (filters.block_id)      query = query.eq('block_id', filters.block_id);
  if (filters.status)        query = query.eq('status', filters.status);
  if (filters.program_code)  query = query.eq('program_code', filters.program_code);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(r => ({
    ...r,
    block_name: r.fee_blocks?.block_name || '—',
    fee_type:   r.fee_blocks?.fee_type   || '—',
  }));
}

// Check eligibility conditions for a student against the configured rules
function checkConditions(student, financeRow, conditions) {
  // conditions: { require_no_backlogs, require_full_fee_paid, semester, program_code, batch }
  if (conditions.program_code && student.program_code !== conditions.program_code) return false;
  if (conditions.batch && financeRow?.batch !== conditions.batch) return false;
  if (conditions.require_full_fee_paid && financeRow?.payment_status !== 'COMPLETED') return false;
  return true;
}

export async function generateFeesForBlock({ block_id, conditions = {}, generated_by }) {
  // 1. Load the block with its components
  const { data: block, error: blockErr } = await supabase
    .from('fee_blocks')
    .select('*, fee_components(*)')
    .eq('id', block_id)
    .single();
  if (blockErr) throw blockErr;

  const total_amount = (block.fee_components || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  // 2. Load all students matching program_code filter
  let studentQuery = supabase
    .from('student_master')
    .select('id, enrollment_no, full_name, program_code, program_name')
    .not('enrollment_no', 'is', null);

  if (conditions.program_code) studentQuery = studentQuery.eq('program_code', conditions.program_code);

  const { data: students, error: stuErr } = await studentQuery;
  if (stuErr) throw stuErr;

  // 3. Load finance rows for these students
  const enrollmentNos = (students || []).map(s => s.enrollment_no);
  const { data: financeRows } = await supabase
    .from('student_finance')
    .select('enrollment_no, payment_status, batch, balance_due')
    .in('enrollment_no', enrollmentNos);

  const financeMap = {};
  (financeRows || []).forEach(f => { financeMap[f.enrollment_no] = f; });

  // 4. Filter by conditions
  const eligible = (students || []).filter(s =>
    checkConditions(
      { ...s, program_code: s.program_code || s.program_name },
      financeMap[s.enrollment_no],
      conditions
    )
  );

  if (eligible.length === 0) return { inserted: 0, skipped: 0 };

  // 5. Skip students who already have a generated fee for this block
  const { data: existing } = await supabase
    .from('generated_fees')
    .select('enrollment_no')
    .eq('block_id', block_id)
    .in('enrollment_no', eligible.map(s => s.enrollment_no));

  const existingSet = new Set((existing || []).map(r => r.enrollment_no));
  const toInsert = eligible.filter(s => !existingSet.has(s.enrollment_no));

  if (toInsert.length === 0) return { inserted: 0, skipped: eligible.length };

  // 6. Build rows
  const rows = toInsert.map(s => ({
    block_id,
    enrollment_no: s.enrollment_no,
    student_name:  s.full_name || null,
    program_code:  s.program_code || null,
    semester:      conditions.semester || block.semester || null,
    total_amount,
    paid_amount:   0,
    status:        'UNPAID',
    payment_link:  conditions.payment_link_base
      ? `${conditions.payment_link_base}?amount=${total_amount}&ref=${s.enrollment_no}`
      : null,
    generated_by:  generated_by || null,
    conditions:    conditions,
  }));

  const { error: insertErr } = await supabase.from('generated_fees').insert(rows);
  if (insertErr) throw insertErr;

  return { inserted: toInsert.length, skipped: eligible.length - toInsert.length };
}

export async function markGeneratedFeePaid(id, paid_amount) {
  const { data, error } = await supabase
    .from('generated_fees')
    .update({
      paid_amount,
      status:  paid_amount >= 0 ? 'PAID' : 'PARTIAL',
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT OVERVIEW (extends existing student_finance)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchStudentOverview(filters = {}) {
  let query = supabase
    .from('student_finance')
    .select(`
      *,
      student_master (
        full_name, personal_email, official_email, mobile, specialization, raw_data
      )
    `)
    .order('created_at', { ascending: false });

  if (filters.program_code)   query = query.eq('program_code',   filters.program_code);
  if (filters.payment_status) query = query.eq('payment_status', filters.payment_status);
  if (filters.batch)          query = query.eq('batch',          filters.batch);

  const { data, error } = await query;
  if (error) throw error;

  // Also pull generated_fees per student for semester-wise breakdown
  const enrollmentNos = (data || []).map(r => r.enrollment_no);
  let genFeesMap = {};

  if (enrollmentNos.length > 0) {
    const { data: genFees } = await supabase
      .from('generated_fees')
      .select('enrollment_no, block_id, semester, total_amount, paid_amount, status, fee_blocks(block_name, fee_type)')
      .in('enrollment_no', enrollmentNos)
      .order('semester', { ascending: true });

    (genFees || []).forEach(gf => {
      if (!genFeesMap[gf.enrollment_no]) genFeesMap[gf.enrollment_no] = [];
      genFeesMap[gf.enrollment_no].push(gf);
    });
  }

  return (data || []).map(row => ({
    ...row,
    full_name:      row.student_master?.full_name      || '',
    personal_email: row.student_master?.personal_email || '',
    official_email: row.student_master?.official_email || '',
    mobile:         row.student_master?.mobile         || '',
    specialization: row.student_master?.specialization || '',
    raw_data:       row.student_master?.raw_data       || {},
    semester_fees:  genFeesMap[row.enrollment_no]      || [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE OVERVIEW SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinanceOverviewSummary() {
  const [
    { data: sfRows,    error: e1 },
    { data: blocks,    error: e2 },
    { data: genFees,   error: e3 },
    { data: acYears,   error: e4 },
  ] = await Promise.all([
    supabase.from('student_finance').select('net_fee, total_paid, balance_due, payment_status'),
    supabase.from('fee_blocks').select('id, status'),
    supabase.from('generated_fees').select('total_amount, paid_amount, status'),
    supabase.from('academic_years').select('label').eq('is_active', true).limit(1),
  ]);

  if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

  const sf = sfRows || [];
  const gf = genFees || [];

  return {
    active_academic_year:  acYears?.[0]?.label || '—',
    total_students:        sf.length,
    total_net_fee:         sf.reduce((s, r) => s + parseFloat(r.net_fee     || 0), 0),
    total_collected:       sf.reduce((s, r) => s + parseFloat(r.total_paid  || 0), 0),
    total_outstanding:     sf.reduce((s, r) => s + parseFloat(r.balance_due || 0), 0),
    pending_count:         sf.filter(r => r.payment_status === 'PENDING').length,
    partial_count:         sf.filter(r => r.payment_status === 'PARTIAL').length,
    completed_count:       sf.filter(r => r.payment_status === 'COMPLETED').length,
    active_blocks:         (blocks || []).filter(b => b.status === 'ACTIVE').length,
    total_blocks:          (blocks || []).length,
    generated_fees_total:  gf.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0),
    generated_fees_paid:   gf.reduce((s, r) => s + parseFloat(r.paid_amount  || 0), 0),
    generated_fees_unpaid: gf.filter(r => r.status === 'UNPAID').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export const PROGRAM_CODES = ['MBA', 'MCA', 'BBA', 'BCA'];
export const FEE_TYPES      = ['SEMESTER', 'ANNUAL', 'COURSE'];
// Batch values are now combined month+year (e.g. 'Jan-2025'), so they can't be
// a fixed array like the old ['JAN', 'JUL'] intake options — fetch the distinct
// set actually in use from student_finance instead.
export async function fetchBatchOptions() {
  const { data, error } = await supabase
    .from('student_finance')
    .select('batch')
    .not('batch', 'is', null);
  if (error) throw error;
  const unique = [...new Set((data || []).map(r => r.batch))];
  return unique.sort();
}

export const STATUS_COLORS = {
  ACTIVE:   { bg: '#DCFCE7', text: '#166534' },
  INACTIVE: { bg: '#F3F4F6', text: '#6B7280' },
  UNPAID:   { bg: '#FEF9C3', text: '#854D0E' },
  PARTIAL:  { bg: '#DBEAFE', text: '#1E40AF' },
  PAID:     { bg: '#DCFCE7', text: '#166534' },
  PENDING:  { bg: '#FEF9C3', text: '#854D0E' },
  COMPLETED:{ bg: '#DCFCE7', text: '#166534' },
};

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

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPaymentHistory(financeId) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('finance_id', financeId)
    .order('payment_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function recordPayment({
  financeId, enrollmentNo, amount, paymentMethod,
  paymentDate, transactionRef, paymentFor, receiptNo, notes,
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
      payment_for:     paymentFor     || null,
      status:          'SUCCESS',
      receipt_no:      receiptNo      || null,
      notes:           notes          || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}