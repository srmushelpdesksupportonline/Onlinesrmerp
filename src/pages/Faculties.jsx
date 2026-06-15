import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

// Lists users with the `faculty` role from the user_roles + profiles tables.
export default function Faculties() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles:profiles!user_roles_user_id_fkey(full_name, email)")
        .eq("role", "faculty");
      if (error) console.error(error);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>Faculties</h1>
      <p className="muted">Users assigned the “faculty” role.</p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={3} className="muted" style={{ padding: 24, textAlign: "center" }}>
                No faculty assigned yet. Promote a user by inserting into <code>user_roles</code>.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td>{r.profiles?.full_name || "—"}</td>
                <td>{r.profiles?.email || "—"}</td>
                <td><span className="badge">{r.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
