import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const CATEGORIES = [
  { value: "student", label: "Student support" },
  { value: "staff_helpdesk", label: "Staff helpdesk" },
  { value: "admissions_enquiry", label: "Admissions enquiry" },
];
const STATUSES = ["open", "in_progress", "resolved", "closed"];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", category: "student" });

  async function load() {
    setLoading(true);
    let q = supabase.from("tickets")
      .select("id, subject, body, category, status, created_at")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("category", filter);
    const { data, error } = await q;
    if (error) setErr(error.message);
    setTickets(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function createTicket(e) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("tickets").insert({
      subject: form.subject,
      body: form.body || null,
      category: form.category,
      created_by: u?.user?.id ?? null,
      status: "open",
    });
    if (error) return alert(error.message);
    setShowForm(false);
    setForm({ subject: "", body: "", category: "student" });
    load();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) return alert(error.message);
    load();
  }

  return (
    <div>
      <h1>Tickets</h1>
      <p className="muted">Student support, staff helpdesk and admissions enquiries — all in one place.</p>

      {err && (
        <div className="card" style={{ background: "#fef3c7", borderColor: "#fcd34d" }}>
          <strong>Table missing:</strong> {err}
          <div className="muted" style={{ marginTop: 6 }}>
            Create the <code>tickets</code> table — SQL is in <code>README.md</code>.
          </div>
        </div>
      )}

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={() => setShowForm(true)}>+ New ticket</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Subject</th><th>Category</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && !err && tickets.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 24, textAlign: "center" }}>No tickets.</td></tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{t.subject}</div>
                  {t.body && <div className="muted" style={{ maxWidth: 480 }}>{t.body}</div>}
                </td>
                <td><span className="badge">{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</span></td>
                <td>
                  <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="muted">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New ticket</h2>
            <form onSubmit={createTicket}>
              <div className="form-row single">
                <div>
                  <label>Subject</label>
                  <input required value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
              </div>
              <div className="form-row single">
                <div>
                  <label>Category</label>
                  <select value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row single">
                <div>
                  <label>Description</label>
                  <textarea rows={4} value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })} />
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
