import { supabase } from '../supabaseClient';

const BASE_URL = 'http://localhost:5173'; // Replace with live URL when deploying
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';
const FROM_EMAIL = 'noreply@srmusonline.in'; // Replace with verified Resend sender

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function semesterLabel(sem) {
  const suffixes = ['st','nd','rd','th','th','th'];
  return `${sem}${suffixes[sem - 1] || 'th'}`;
}

function programSemesters(programCode) {
  return ['MBA','MCA'].includes(programCode) ? 4 : 6;
}

// Semesters where elective selection is required
function requiresElectiveSelection(programCode, nextSemester) {
  if (['MBA','MCA'].includes(programCode) && nextSemester === 3) return true;
  if (['BBA','BCA'].includes(programCode) && nextSemester === 5) return true;
  return false;
}

export { requiresElectiveSelection, semesterLabel };

// ─── FETCH ACTIVE STUDENTS FOR A BATCH ───────────────────────────────────────

export async function fetchActiveStudentsForBatch({ programCode, intake } = {}) {
  let q = supabase
    .from('student_master')
    .select(`
      id, enrollment_no, full_name, official_email, program_name,
      intake, intake_year, academic_year, current_semester,
      specialisation_group_id, program_id,
      programs(program_code, program_name, level, total_semesters)
    `)
    .eq('student_status', 'ENROLLED')
    .order('enrollment_no');

  if (programCode) q = q.ilike('program_name', `%${programCode}%`);
  if (intake)      q = q.eq('intake', intake);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── CHECK FINANCE STATUS ─────────────────────────────────────────────────────

export async function checkNextSemFeePaid(enrollmentNo, nextSemester) {
  // Check if a payment_for = SEM_{nextSemester} exists and is SUCCESS
  const { data } = await supabase
    .from('payment_transactions')
    .select('id, amount, status')
    .eq('enrollment_no', enrollmentNo)
    .eq('payment_for', `SEM_${nextSemester}`)
    .eq('status', 'SUCCESS')
    .limit(1);
  return data && data.length > 0;
}

// ─── SEND EMAIL VIA RESEND ────────────────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent to', to);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

// ─── BUILD EMAIL HTML ─────────────────────────────────────────────────────────

function buildEmailHtml({ student, record, batch, feePaid, formUrl, paymentUrl, nextSem }) {
  const deadline = new Date(batch.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const semFee   = feePaid ? null : paymentUrl;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    
    <!-- Header -->
    <div style="background:#2d3a0e;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#c8a84b;letter-spacing:0.5px;">SRM University Sikkim</div>
      <div style="font-size:13px;color:#b8c8a0;margin-top:4px;">Centre for Distance and Online Education</div>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-left:1px solid #e8ead4;border-right:1px solid #e8ead4;">
      <p style="margin:0 0 8px;font-size:16px;color:#1a1f0c;">Dear <strong>${student.full_name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">
        It's time to re-register for the <strong>${semesterLabel(nextSem)} Semester</strong> of your 
        <strong>${student.programs?.program_name || student.program_name}</strong> program.
        Please complete your re-registration before <strong style="color:#c8a84b;">${deadline}</strong>.
      </p>

      <!-- Student Info -->
      <div style="background:#f8f9f4;border:1px solid #e8ead4;border-radius:8px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;font-size:13px;color:#374151;">
          <tr><td style="padding:3px 0;color:#6b7280;">Enrollment No</td><td style="font-weight:600;">${student.enrollment_no}</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280;">Program</td><td style="font-weight:600;">${student.programs?.program_name || student.program_name}</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280;">Next Semester</td><td style="font-weight:600;">${semesterLabel(nextSem)} Semester</td></tr>
          <tr><td style="padding:3px 0;color:#6b7280;">Deadline</td><td style="font-weight:600;color:#dc2626;">${deadline}</td></tr>
        </table>
      </div>

      ${!feePaid ? `
      <!-- Payment Section -->
      <div style="background:#fff8e6;border:1px solid #f0d080;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:8px;">💳 Semester Fee Payment Required</div>
        <p style="margin:0 0 12px;font-size:13px;color:#78350f;line-height:1.5;">
          Please pay your semester fee to proceed with re-registration. 
          Click the button below to make your payment securely via OrangePay.
        </p>
        <a href="${semFee}" style="display:inline-block;background:#c8a84b;color:#1a1f0c;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Pay Semester Fee →
        </a>
      </div>
      ` : `
      <!-- Fee Paid -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#065f46;">✓ Semester fee already paid</div>
      </div>
      `}

      <!-- Form Button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${formUrl}" style="display:inline-block;background:#2d3a0e;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Fill Re-Registration Form →
        </a>
        <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">This link expires on ${deadline}</p>
      </div>

      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">
        If you have any questions, please contact us at 
        <a href="mailto:studentcare.online@srmus.edu.in" style="color:#2d3a0e;">studentcare.online@srmus.edu.in</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9f4;border:1px solid #e8ead4;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">SRM University Sikkim | 5th Mile, Tadong, Gangtok – 737102 | www.onlinesrm.in</div>
    </div>

  </div>
</body>
</html>`;
}

// ─── TRIGGER BATCH ────────────────────────────────────────────────────────────

export async function triggerReregistrationBatch({
  triggeredBy,
  deadline,
  targetSemester,
  academicYear,
  intake,
  programCode,
  notes,
  selectedStudentIds,
}) {
  // 1. Create batch record
  const { data: batch, error: batchErr } = await supabase
    .from('reregistration_batches')
    .insert({
      triggered_by:    triggeredBy,
      deadline,
      target_semester: targetSemester,
      academic_year:   academicYear,
      intake:          intake || null,
      program_code:    programCode || null,
      total_sent:      0,
      notes:           notes || null,
    })
    .select()
    .single();
  if (batchErr) throw batchErr;

  // 2. Fetch selected students by ID (or all active if no selection)
  let students = [];
  if (selectedStudentIds && selectedStudentIds.length > 0) {
    const { data, error } = await supabase
      .from('student_master')
      .select(`
        id, enrollment_no, full_name, official_email, program_name,
        intake, intake_year, academic_year, current_semester,
        specialisation_group_id, program_id,
        programs(program_code, program_name, level, total_semesters)
      `)
      .in('id', selectedStudentIds);
    if (error) throw error;
    students = data || [];
  } else {
    students = await fetchActiveStudentsForBatch({ programCode, intake });
  }

  if (students.length === 0) {
    return { batch, sent: 0, errors: [] };
  }

  // 3. Create records + send emails
  let sent = 0;
  const errors = [];

  for (const student of students) {
    try {
      const feePaid = await checkNextSemFeePaid(student.enrollment_no, targetSemester);

      // Create record
      const { data: record, error: recErr } = await supabase
        .from('reregistration_records')
        .insert({
          batch_id:        batch.id,
          student_id:      student.id,
          enrollment_no:   student.enrollment_no,
          email_sent_to:   student.official_email,
          fee_paid_at_send: feePaid,
        })
        .select()
        .single();
      if (recErr) throw recErr;

      const formUrl    = `${BASE_URL}/reregister/${record.token}`;
      const paymentUrl = `https://pay.orangepay.in/srmus?amount=AMOUNT&enrollment=${student.enrollment_no}&semester=${targetSemester}`;

      // Send email
      await sendEmail({
        to:      student.official_email,
        subject: `Re-Registration for Semester ${targetSemester} — ${student.enrollment_no}`,
        html:    buildEmailHtml({
          student, record, batch, feePaid,
          formUrl, paymentUrl, nextSem: targetSemester,
        }),
      });

      // Update record with sent time
      await supabase
        .from('reregistration_records')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', record.id);

      sent++;
    } catch (e) {
      errors.push(`${student.enrollment_no}: ${e.message}`);
    }
  }

  // 4. Update batch total_sent
  await supabase
    .from('reregistration_batches')
    .update({ total_sent: sent })
    .eq('id', batch.id);

  return { batch, sent, errors };
}

// ─── FETCH BATCHES ────────────────────────────────────────────────────────────

export async function fetchBatches() {
  const { data, error } = await supabase
    .from('reregistration_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── FETCH RECORDS FOR A BATCH ────────────────────────────────────────────────

export async function fetchBatchRecords(batchId) {
  const { data, error } = await supabase
    .from('reregistration_records')
    .select(`
      *,
      student_master(
        full_name, official_email, program_name,
        intake, intake_year, current_semester,
        programs(program_code)
      ),
      specialisation_groups(name)
    `)
    .eq('batch_id', batchId)
    .order('enrollment_no');
  if (error) throw error;
  return data || [];
}

// ─── MARK DORMANT (after deadline) ───────────────────────────────────────────

export async function markDormantStudents(batchId) {
  const { data: batch } = await supabase
    .from('reregistration_batches')
    .select('deadline')
    .eq('id', batchId)
    .single();

  if (!batch) throw new Error('Batch not found');

  const today = new Date().toISOString().split('T')[0];
  if (today <= batch.deadline) {
    throw new Error(`Deadline (${batch.deadline}) has not passed yet.`);
  }

  const { error } = await supabase
    .from('reregistration_records')
    .update({ form_status: 'dormant' })
    .eq('batch_id', batchId)
    .eq('form_status', 'pending');
  if (error) throw error;

  // Count dormant
  const { count } = await supabase
    .from('reregistration_records')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('form_status', 'dormant');

  await supabase
    .from('reregistration_batches')
    .update({ total_dormant: count || 0, status: 'dormant_marked' })
    .eq('id', batchId);

  return count || 0;
}

// ─── FETCH RECORD BY TOKEN (public form) ─────────────────────────────────────

export async function fetchRecordByToken(token) {
  const { data, error } = await supabase
    .from('reregistration_records')
    .select(`
      *,
      reregistration_batches(deadline, target_semester, academic_year),
      student_master(
        id, full_name, official_email, enrollment_no, program_name,
        current_semester, specialisation_group_id,
        programs(program_code, program_name, total_semesters)
      )
    `)
    .eq('token', token)
    .single();
  if (error || !data) return null;
  return data;
}

// ─── SUBMIT FORM (public — no auth) ──────────────────────────────────────────

export async function submitReregistrationForm({
  token,
  choice,
  electiveGroupId,
  breakReason,
}) {
  // Fetch record
  const record = await fetchRecordByToken(token);
  if (!record) throw new Error('Invalid or expired link.');

  // Check deadline
  const today    = new Date().toISOString().split('T')[0];
  const deadline = record.reregistration_batches?.deadline;
  if (deadline && today > deadline) {
    throw new Error('This re-registration form has expired.');
  }

  if (record.form_status === 'submitted') {
    throw new Error('You have already submitted this form.');
  }

  // Update record
  const { error } = await supabase
    .from('reregistration_records')
    .update({
      form_status:      'submitted',
      choice,
      elective_group_id: electiveGroupId || null,
      break_reason:     breakReason || null,
      submitted_at:     new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('token', token);
  if (error) throw error;

  // If choice is 'continue' → update current_semester in student_master
  if (choice === 'continue') {
    const student   = record.student_master;
    const nextSem   = record.reregistration_batches?.target_semester;
    const updates   = { current_semester: nextSem };

    // Update specialisation group if elective was chosen
    if (electiveGroupId) updates.specialisation_group_id = electiveGroupId;

    await supabase
      .from('student_master')
      .update(updates)
      .eq('id', student.id);

    // Mark semester_updated
    await supabase
      .from('reregistration_records')
      .update({ semester_updated: true })
      .eq('token', token);
  }

  // Update batch responded count
  const { count } = await supabase
    .from('reregistration_records')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', record.batch_id)
    .eq('form_status', 'submitted');

  await supabase
    .from('reregistration_batches')
    .update({ total_responded: count || 0 })
    .eq('id', record.batch_id);

  return { success: true };
}

// ─── FETCH SPECIALISATION GROUPS FOR FORM ────────────────────────────────────

export async function fetchGroupsForProgram(programCode) {
  const { data, error } = await supabase
    .from('specialisation_groups')
    .select('id, name, group_code')
    .order('name');
  if (error) throw error;

  // Filter by program via join
  const { data: prog } = await supabase
    .from('programs')
    .select('id')
    .eq('program_code', programCode)
    .single();

  if (!prog) return data || [];

  const { data: groups } = await supabase
    .from('specialisation_groups')
    .select('id, name, group_code')
    .eq('program_id', prog.id)
    .order('name');

  return groups || [];
}