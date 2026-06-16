import { supabase } from "../supabaseClient";

export async function getExistingAdmissions() {

  const { data, error } = await supabase
    .from("merrito_import")
    .select("application_no");

  console.log("Admissions Error:", error);
  console.log("Admissions Data:", data);

  return data || [];
}

export async function getExistingStudents() {

  const { data, error } = await supabase
    .from("student_master")
    .select("application_no");

  return data || [];
}

export async function insertAdmissions(records) {

  const { data, error } =
    await supabase
      .from("merrito_import")
      .insert(records);

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}