import { supabase } from "../supabaseClient";

// ─── PROGRAMS ────────────────────────────────────────────────
export async function getPrograms() {
  const { data, error } = await supabase
    .from("programs")
    .select("id, program_code, program_name, level, total_semesters, total_credits, is_active")
    .order("program_code");
  if (error) throw error;
  // Normalise to .code / .name / .semesters so all pages work without change
  return (data || []).map((p) => ({
    ...p,
    code:      p.program_code,
    name:      p.program_name,
    semesters: p.total_semesters,
  }));
}

// ─── SPECIALISATION GROUPS ───────────────────────────────────
export async function getSpecialisationGroups(programId) {
  let q = supabase.from("specialisation_groups").select("*");
  if (programId) q = q.eq("program_id", programId);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return data || [];
}

export async function upsertSpecialisationGroup(record) {
  const { data, error } = await supabase
    .from("specialisation_groups")
    .upsert(record, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSpecialisationGroup(id) {
  const { error } = await supabase
    .from("specialisation_groups")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── SUBJECTS ────────────────────────────────────────────────
export async function getSubjects({ programId, semesterNo } = {}) {
  let q = supabase
    .from("subjects")
    .select("*, programs(id, program_code, program_name, level, total_semesters), specialisation_groups(name)");
  if (programId) q = q.eq("program_id", programId);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  const { data, error } = await q.order("semester_no").order("course_code");
  if (error) throw error;
  return (data || []).map((s) => ({
    ...s,
    programs: s.programs ? {
      ...s.programs,
      code: s.programs.program_code,
      name: s.programs.program_name,
    } : null,
  }));
}

export async function upsertSubject(record) {
  const { data, error } = await supabase
    .from("subjects")
    .upsert(record, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(id) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw error;
}

// ─── STUDENTS ────────────────────────────────────────────────
export async function getStudents({ programCode, intake, intakeYear, semesterNo, status } = {}) {
  let q = supabase
    .from("student_master")
    .select(`
      *,
      programs(id, program_code, program_name, level, total_semesters),
      specialisation_groups(name)
    `);
  if (programCode) q = q.eq("program_name", programCode);
  if (intake) q = q.eq("intake", intake);
  if (intakeYear) q = q.eq("intake_year", intakeYear);
  if (semesterNo) q = q.eq("current_semester", semesterNo);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("enrollment_no");
  if (error) throw error;
  return data || [];
}

export async function getStudentsWithAcademics(filters = {}) {
  const { programCode, intake, intakeYear } = filters;
  let q = supabase
    .from("student_master")
    .select(`
      *,
      programs(id, program_code, program_name, level, total_semesters),
      specialisation_groups(name),
      cgpa_records(semester_no, sgpa, cgpa),
      marksheet_status(semester_no, document_type, status, sent_at),
      coursera_records(utilisation_pct)
    `);
  if (programCode) q = q.eq("program_name", programCode);
  if (intake) q = q.eq("intake", intake);
  if (intakeYear) q = q.eq("intake_year", intakeYear);
  const { data, error } = await q.order("enrollment_no");
  if (error) throw error;
  // Normalise programs shape so all pages use .code/.name/.semesters
  return (data || []).map((s) => ({
    ...s,
    programs: s.programs ? {
      ...s.programs,
      code:      s.programs.program_code,
      name:      s.programs.program_name,
      semesters: s.programs.total_semesters,
    } : null,
  }));
}

export async function importHistoricalStudents(records) {
  const { data, error } = await supabase
    .from("student_master")
    .upsert(records, { onConflict: "enrollment_no" })
    .select();
  if (error) throw error;
  return data;
}

// ─── CGPA RECORDS ────────────────────────────────────────────
export async function getCgpaRecords(studentId) {
  const { data, error } = await supabase
    .from("cgpa_records")
    .select("*")
    .eq("student_id", studentId)
    .order("semester_no");
  if (error) throw error;
  return data || [];
}

export async function importCgpaRecords(records) {
  const { data, error } = await supabase
    .from("cgpa_records")
    .upsert(records, { onConflict: "student_id,semester_no,academic_year" })
    .select();
  if (error) throw error;
  return data;
}

// ─── IA MARKS ────────────────────────────────────────────────
export async function getIaMarks({ studentId, subjectId, semesterNo, academicYear } = {}) {
  let q = supabase.from("ia_marks").select("*, subjects(course_code, course_name)");
  if (studentId) q = q.eq("student_id", studentId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  if (academicYear) q = q.eq("academic_year", academicYear);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function importIaMarks(records) {
  const { data, error } = await supabase
    .from("ia_marks")
    .upsert(records, { onConflict: "student_id,subject_id,semester_no,academic_year" })
    .select();
  if (error) throw error;
  return data;
}

// ─── ESE MARKS ───────────────────────────────────────────────
export async function importEseMarks(records) {
  const { data, error } = await supabase
    .from("ese_marks")
    .upsert(records, { onConflict: "student_id,subject_id,semester_no,academic_year" })
    .select();
  if (error) throw error;
  return data;
}

// ─── SEMESTER GRADES ─────────────────────────────────────────
export async function getSemesterGrades({ studentId, subjectId, semesterNo, academicYear } = {}) {
  let q = supabase
    .from("semester_grades")
    .select("*, subjects(course_code, course_name, credits, course_type)");
  if (studentId) q = q.eq("student_id", studentId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  if (academicYear) q = q.eq("academic_year", academicYear);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── GRADE CALCULATION HELPERS ───────────────────────────────
export function computeFinalIA(ia) {
  const ia1 = (Number(ia.ia1_part_a || 0) + Number(ia.ia1_part_b || 0));
  const ia2 = (Number(ia.ia2_part_a || 0) + Number(ia.ia2_part_b || 0));
  const avg = (ia1 + ia2) / 2;
  if (avg >= 15) return { final_ia: avg, used_ia3: false };
  if (ia.ia3_part_a !== null || ia.ia3_part_b !== null) {
    const ia3 = (Number(ia.ia3_part_a || 0) + Number(ia.ia3_part_b || 0));
    return { final_ia: ia3, used_ia3: true };
  }
  return { final_ia: avg, used_ia3: false };
}

export function computeGrade(total, level) {
  // level: 'PG' or 'UG'
  if (level === "PG") {
    if (total >= 95) return { grade: "O",  points: 10 };
    if (total >= 90) return { grade: "A+", points: 9 };
    if (total >= 85) return { grade: "A",  points: 8 };
    if (total >= 75) return { grade: "B+", points: 7 };
    if (total >= 65) return { grade: "B",  points: 6 };
    if (total >= 55) return { grade: "C",  points: 5 };
    if (total >= 50) return { grade: "P",  points: 4 };
    return { grade: "F", points: 0 };
  } else {
    if (total >= 95) return { grade: "O",  points: 10 };
    if (total >= 85) return { grade: "A+", points: 9 };
    if (total >= 75) return { grade: "A",  points: 8 };
    if (total >= 65) return { grade: "B+", points: 7 };
    if (total >= 55) return { grade: "B",  points: 6 };
    if (total >= 45) return { grade: "C",  points: 5 };
    if (total >= 40) return { grade: "P",  points: 4 };
    return { grade: "F", points: 0 };
  }
}

export function computeCGPA(gradesArray) {
  // gradesArray: [{ grade_points, credits }]
  const valid = gradesArray.filter(g => g.grade_points > 0 && g.credits > 0);
  if (!valid.length) return 0;
  const totalCredits = valid.reduce((s, g) => s + g.credits, 0);
  const weightedSum  = valid.reduce((s, g) => s + g.grade_points * g.credits, 0);
  return totalCredits > 0 ? +(weightedSum / totalCredits).toFixed(2) : 0;
}

// ─── LMS REPORTS ─────────────────────────────────────────────
export async function getLmsReports({ programCode, intake, intakeYear, semesterNo } = {}) {
  let q = supabase
    .from("lms_reports")
    .select(`
      *,
      student_master(enrollment_no, full_name, official_email, intake, intake_year,
        programs(program_code, program_name), specialisation_groups(name))
    `);
  if (programCode) q = q.eq("program_code", programCode);
  if (intake) q = q.eq("intake", intake);
  if (intakeYear) q = q.eq("intake_year", intakeYear);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  const { data, error } = await q.order("official_email");
  if (error) throw error;
  return data || [];
}

export async function importLmsReports(records) {
  const { data, error } = await supabase
    .from("lms_reports")
    .insert(records)
    .select();
  if (error) throw error;
  return data;
}

// ─── LIVE SESSIONS ───────────────────────────────────────────
export async function getLsSessions({ subjectId, semesterNo, academicYear, intake, programCode } = {}) {
  let q = supabase
    .from("ls_sessions")
    .select("*, subjects(course_code, course_name)");
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  if (academicYear) q = q.eq("academic_year", academicYear);
  if (intake) q = q.eq("intake", intake);
  if (programCode) q = q.eq("program_code", programCode);
  const { data, error } = await q.order("week_no");
  if (error) throw error;
  return data || [];
}

export async function upsertLsSession(record) {
  const { data, error } = await supabase
    .from("ls_sessions")
    .upsert(record, { onConflict: "subject_id,semester_no,academic_year,intake,week_no" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLsAttendance({ sessionId, studentId } = {}) {
  let q = supabase
    .from("ls_attendance")
    .select("*, student_master(enrollment_no, full_name, official_email)");
  if (sessionId) q = q.eq("session_id", sessionId);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function importLsAttendance(records) {
  const { data, error } = await supabase
    .from("ls_attendance")
    .upsert(records, { onConflict: "session_id,student_id" })
    .select();
  if (error) throw error;
  return data;
}

// ─── SEMESTER ELIGIBILITY ────────────────────────────────────
export async function getEligibility({ studentId, semesterNo, academicYear } = {}) {
  let q = supabase.from("semester_eligibility").select("*");
  if (studentId) q = q.eq("student_id", studentId);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  if (academicYear) q = q.eq("academic_year", academicYear);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertEligibility(record) {
  const { data, error } = await supabase
    .from("semester_eligibility")
    .upsert(record, { onConflict: "student_id,semester_no,academic_year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── COURSERA ────────────────────────────────────────────────
export async function getCourseraRecords({ programCode, intake, intakeYear, semesterNo } = {}) {
  let q = supabase
    .from("coursera_records")
    .select(`
      *,
      student_master(enrollment_no, full_name, official_email, intake, intake_year,
        programs(program_code, program_name), specialisation_groups(name))
    `);
  if (programCode) q = q.eq("program_code", programCode);
  if (intake) q = q.eq("intake", intake);
  if (intakeYear) q = q.eq("intake_year", intakeYear);
  if (semesterNo) q = q.eq("semester_no", semesterNo);
  const { data, error } = await q.order("official_email");
  if (error) throw error;
  return data || [];
}

export async function importCourseraRecords(records) {
  const { data, error } = await supabase
    .from("coursera_records")
    .insert(records)
    .select();
  if (error) throw error;
  return data;
}

// ─── FILTER HELPERS ──────────────────────────────────────────
export function getAcademicYears() {
  return ["2024-25", "2025-26", "2026-27"];
}

export function getIntakeYears() {
  return [2024, 2025, 2026];
}