import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

// Placeholder: replace `invoices` with your real fee/invoice table when ready.
export default function Finance() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_no, student_name, amount, status, due_date, created_at")
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>Finance</h1>
      <p className="muted">Fee invoices, payments and receipts.</p>
      {err && (
        <div className="card" style={{ background: "#fef3c7", borderColor: "#fcd34d" }}>
          <strong>Table missing:</strong> {err}
          <div className="muted" style={{ marginTop: 6 }}>
            Create an <code>invoices</code> table in Supabase to populate this page.
          </div>
        </div>
      )}
      {!err && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr>
              <th>Invoice #</th><th>Student</th><th>Amount</th><th>Status</th><th>Due</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: "center" }}>No invoices yet.</td></tr>
              )}
              {rows.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{i.invoice_no}</td>
                  <td>{i.student_name}</td>
                  <td>₹{i.amount}</td>
                  <td><span className={"badge " + (i.status || "")}>{i.status}</span></td>
                  <td>{i.due_date ? new Date(i.due_date).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
