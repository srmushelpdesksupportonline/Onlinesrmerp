import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function Academics() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("programs")
        .select("id, code, name, duration_years, total_credits, is_active")
        .order("name");
      setPrograms(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>Academics</h1>
      <p className="muted">Programs offered. Add courses, semesters and enrollments here later.</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Duration</th><th>Credits</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && programs.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: "center" }}>No programs.</td></tr>
            )}
            {programs.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: "monospace" }}>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.duration_years} yrs</td>
                <td>{p.total_credits ?? "—"}</td>
                <td><span className={"badge " + (p.is_active ? "resolved" : "closed")}>
                  {p.is_active ? "active" : "inactive"}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
