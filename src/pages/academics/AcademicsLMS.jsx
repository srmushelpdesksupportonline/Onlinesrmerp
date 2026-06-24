import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { getPrograms, getLmsReports, importLmsReports } from "../../services/academicservice";

const INTAKES = ["JAN", "JUL"];
const INTAKE_YEARS = [2024, 2025, 2026];

const LMS_COLUMNS = [
  { key: "course_offering_code",   label: "Course Offering Code" },
  { key: "course_offering_name",   label: "Course Offering Name" },
  { key: "semester_name",          label: "Semester" },
  { key: "content_completed",      label: "Content Completed" },
  { key: "content_required",       label: "Content Required" },
  { key: "checklist_completed",    label: "Checklist Done" },
  { key: "quiz_completed",         label: "Quiz Completed" },
  { key: "total_quiz_attempts",    label: "Quiz Attempts" },
  { key: "discussion_post_created",label: "Discussion Created" },
  { key: "discussion_post_replies",label: "Discussion Replies" },
  { key: "discussion_post_read",   label: "Discussion Read" },
  { key: "number_of_assignment_submissions", label: "Assignment Submissions" },
  { key: "total_time_spent_in_content",      label: "Time in Content (min)" },
  { key: "number_of_logins",       label: "No. of Logins" },
  { key: "last_system_login",      label: "Last Login" },
  { key: "last_quiz_attempt_date", label: "Last Quiz Attempt" },
  { key: "last_scorm_completion_date", label: "Last SCORM Completion" },
];

function parseLmsRow(row) {
  return {
    course_offering_id:          row["Course Offering Id"] ?? null,
    course_offering_code:        row["Course Offering Code"] ?? "",
    course_offering_name:        row["Course Offering Name"] ?? "",
    semester_code:               row["Semester Code"] ?? "",
    semester_name:               row["Semester Name"] ?? "",
    official_email:              row["Username"] ?? "",
    content_completed:           Number(row["Content Completed"] ?? 0),
    content_required:            Number(row["Content Required"] ?? 0),
    checklist_completed:         Number(row["Checklist Completed"] ?? 0),
    quiz_completed:              Number(row["Quiz Completed"] ?? 0),
    total_quiz_attempts:         Number(row["Total Quiz Attempts"] ?? 0),
    discussion_post_created:     Number(row["Discussion Post Created"] ?? 0),
    discussion_post_replies:     Number(row["Discussion Post Replies"] ?? 0),
    discussion_post_read:        Number(row["Discussion Post Read"] ?? 0),
    number_of_assignment_submissions: Number(row["Number Of Assignment Submissions"] ?? 0),
    total_time_spent_in_content: Number(row["Total Time Spent In Content"] ?? 0),
    number_of_logins:            Number(row["Number Of Logins To The System"] ?? 0),
    last_system_login:           row["Last System Login"] ? String(row["Last System Login"]) : null,
    last_quiz_attempt_date:      row["Last Quiz Attempt Date"] ? String(row["Last Quiz Attempt Date"]) : null,
    last_scorm_completion_date:  row["Last SCORM Completion Date"] ? String(row["Last SCORM Completion Date"]) : null,
    last_scorm_visit_date:       row["Last SCORM Visit Date"] ? String(row["Last SCORM Visit Date"]) : null,
    last_assignment_submission_date: row["Last Assignment Submission Date"] ? String(row["Last Assignment Submission Date"]) : null,
    last_visited_date:           row["Last Visited Date"] ? String(row["Last Visited Date"]) : null,
    last_discussion_post_date:   row["Last Discussion Post Date"] ? String(row["Last Discussion Post Date"]) : null,
  };
}

function filtersComplete(f) {
  return f.intakeYear && f.intake && f.programCode && f.semesterNo;
}

export default function AcademicsLMS() {
  const [programs, setPrograms]   = useState([]);
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters]     = useState({ programCode: "", intake: "", intakeYear: "", semesterNo: "" });
  const fileRef = useRef();

  useEffect(() => {
    getPrograms().then(setPrograms).catch(console.error);
  }, []);

  function setFilter(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  async function loadData() {
    if (!filtersComplete(filters)) return;
    setLoading(true);
    try {
      const data = await getLmsReports({
        programCode: filters.programCode,
        intake:      filters.intake,
        intakeYear:  Number(filters.intakeYear),
        semesterNo:  Number(filters.semesterNo),
      });
      setRows(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (filtersComplete(filters)) loadData();
    else setRows([]);
  }, [filters]);

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!filtersComplete(filters)) {
      alert("Please select Year, Intake, Course and Semester before importing.");
      fileRef.current.value = "";
      return;
    }
    setImporting(true);
    const reader = new FileReader();
    const ext = file.name.split(".").pop().toLowerCase();
    reader.onload = async (ev) => {
      let data;
      if (ext === "csv") {
        const wb = XLSX.read(ev.target.result, { type: "string" });
        data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      try {
        const records = data.map((row) => ({
          ...parseLmsRow(row),
          program_code: filters.programCode,
          intake:       filters.intake,
          intake_year:  Number(filters.intakeYear),
          semester_no:  Number(filters.semesterNo),
          academic_year: filters.intakeYear === "2025" ? "2025-26" : filters.intakeYear === "2026" ? "2026-27" : "2024-25",
        }));
        await importLmsReports(records);
        alert(`${records.length} LMS records imported.`);
        await loadData();
      } catch (err) {
        alert(err.message);
      } finally {
        setImporting(false);
        fileRef.current.value = "";
      }
    };
    if (ext === "csv") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  const selectedProg = programs.find((p) => p.code === filters.programCode);
  const maxSem = selectedProg?.semesters || 6;
  const complete = filtersComplete(filters);

  function loginEligible(r) {
    const logins = r.number_of_logins ?? 0;
    return logins >= 8;
  }

  function contentPct(r) {
    if (!r.content_required) return null;
    return ((r.content_completed / r.content_required) * 100).toFixed(1);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0 }}>LMS Reports</h1>
          <p className="muted">Import and view student LMS activity data per batch and semester.</p>
        </div>
        <div className="import-bar">
          <input
            type="file"
            ref={fileRef}
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button
            className="secondary"
            onClick={() => fileRef.current.click()}
            disabled={importing}
          >
            {importing ? "Importing…" : "Import LMS Report (.csv / .xlsx)"}
          </button>
        </div>
      </div>

      {/* Mandatory filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="required-dot">Year</label>
          <select value={filters.intakeYear} onChange={(e) => setFilter("intakeYear", e.target.value)}>
            <option value="">Select year</option>
            {INTAKE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="required-dot">Intake</label>
          <select value={filters.intake} onChange={(e) => setFilter("intake", e.target.value)}>
            <option value="">Select intake</option>
            {INTAKES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="required-dot">Course</label>
          <select value={filters.programCode} onChange={(e) => setFilter("programCode", e.target.value)}>
            <option value="">Select course</option>
            {programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="required-dot">Semester</label>
          <select value={filters.semesterNo} onChange={(e) => setFilter("semesterNo", e.target.value)}>
            <option value="">Select semester</option>
            {[1,2,3,4,5,6].filter((s) => s <= maxSem).map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>
        {!complete && (
          <div style={{ alignSelf: "flex-end", fontSize: 12, color: "#ef4444", paddingBottom: 4 }}>
            * All filters required to display data
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {!complete ? (
          <div className="empty-state">
            <p>Select Year, Intake, Course and Semester to load LMS data.</p>
          </div>
        ) : loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p>No LMS data found for this selection.</p>
            <p style={{ fontSize: 12 }}>Import the LMS Report CSV exported from your LMS for this batch.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Enroll No.</th>
                <th>Name</th>
                <th>Official Email</th>
                <th>Course</th>
                <th>Specialisation</th>
                <th>Year</th>
                <th>Intake</th>
                {LMS_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>Content %</th>
                <th>Login Eligible (≥8)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = r.student_master;
                const pct = contentPct(r);
                const eligible = loginEligible(r);
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s?.enrollment_no || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{s?.full_name || "—"}</td>
                    <td style={{ fontSize: 12 }}>{r.official_email || "—"}</td>
                    <td><span className="badge">{s?.programs?.code || filters.programCode}</span></td>
                    <td style={{ fontSize: 12 }}>{s?.specialisation_groups?.name || "—"}</td>
                    <td>{s?.intake_year || filters.intakeYear}</td>
                    <td>{s?.intake || filters.intake}</td>
                    {LMS_COLUMNS.map((c) => (
                      <td key={c.key} style={{ textAlign: "center" }}>
                        {r[c.key] !== null && r[c.key] !== undefined
                          ? String(r[c.key]).replace("T", " ").replace(".0000000Z", "").split(".")[0]
                          : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      {pct !== null
                        ? <span className={"pct-pill " + (Number(pct) >= 75 ? "good" : Number(pct) >= 50 ? "warn" : "bad")}>{pct}%</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {eligible
                        ? <span className="elig-badge eligible">Yes ({r.number_of_logins})</span>
                        : <span className="elig-badge ineligible">No ({r.number_of_logins ?? 0})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 0 && (
        <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>{rows.length} records shown.</p>
      )}
    </div>
  );
}
