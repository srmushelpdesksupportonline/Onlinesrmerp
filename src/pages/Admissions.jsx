import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const STATUSES = [
  "draft", "submitted", "under_review", "interview",
  "offered", "accepted", "rejected", "enrolled", "withdrawn",
];

export default function Admissions() {
  const [apps, setApps] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", program_id: "", intake: "",
  });

  async function load() {
    setLoading(true);
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("applications")
        .select("id, application_no, full_name, email, status, intake, created_at, programs(code,name)")
        .order("created_at", { ascending: false }),
      supabase.from("programs").select("id, code, name").eq("is_active", true).order("name"),
    ]);
    setApps(a || []);
    setPrograms(p || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createApp(e) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("applications").insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      program_id: form.program_id,
      intake: form.intake || null,
      applicant_user_id: u?.user?.id ?? null,
      status: "submitted",
    });
    if (error) return alert(error.message);
    setShowForm(false);
    setForm({ full_name: "", email: "", phone: "", program_id: "", intake: "" });
    load();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) return alert(error.message);
    load();
  }

  return (
    <div>
      <h1>Admissions</h1>
      <p className="muted">Applicants and their status pipeline.</p>

      <div className="toolbar">
        <button onClick={() => setShowForm(true)}>+ New application</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Application #</th><th>Applicant</th><th>Program</th>
              <th>Intake</th><th>Status</th><th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }} className="muted">No applications yet.</td></tr>
            )}
            {apps.map((a) => (
              <tr key={a.id}>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{a.application_no}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{a.full_name}</div>
                  <div className="muted">{a.email}</div>
                </td>
                <td>{a.programs?.code}</td>
                <td>{a.intake || "—"}</td>
                <td>
                  <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="muted">{new Date(a.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New application</h2>
            <form onSubmit={createApp}>
              <div className="form-row single">
                <div>
                  <label>Full name</label>
                  <input required value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div>
                  <label>Email</label>
                  <input type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div>
                  <label>Program</label>
                  <select required value={form.program_id}
                    onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
                    <option value="">Select…</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Intake</label>
                  <input placeholder="e.g. Jan 2026" value={form.intake}
                    onChange={(e) => setForm({ ...form, intake: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
