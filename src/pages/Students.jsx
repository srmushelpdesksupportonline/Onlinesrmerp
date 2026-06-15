import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

// Students = applications with status 'enrolled'. Replace with a dedicated
// `students` table once you create one.
export default function Students() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, application_no, full_name, email, phone, intake, programs(code,name)")
        .eq("status", "enrolled")
        .order("created_at", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>Students</h1>
      <p className="muted">Enrolled students (sourced from applications with status “enrolled”).</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Roll #</th><th>Name</th><th>Email</th><th>Phone</th><th>Program</th><th>Intake</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 24, textAlign: "center" }}>No enrolled students yet.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.application_no}</td>
                <td>{s.full_name}</td>
                <td>{s.email}</td>
                <td>{s.phone || "—"}</td>
                <td>{s.programs?.code}</td>
                <td>{s.intake || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
