import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getPrograms,
  getSubjects,
  getStudentsWithAcademics,
  importHistoricalStudents,
  importCgpaRecords,
  computeGrade,
} from "../../services/academicservice";

const INTAKES = ["JAN", "JUL"];
const INTAKE_YEARS = [2024, 2025, 2026];
const STATUSES = ["active", "withdrawn", "completed"];

function GradeBadge({ grade }) {
  if (!grade) return <span className="muted">—</span>;
  const cls = grade === "O" ? "grade-O"
    : grade === "A+" ? "grade-Ap"
    : grade === "A"  ? "grade-A"
    : grade === "B+" ? "grade-Bp"
    : grade === "B"  ? "grade-B"
    : grade === "C"  ? "grade-C"
    : grade === "P"  ? "grade-P"
    : "grade-F";
  return <span className={"grade-badge " + cls}>{grade}</span>;
}

function PctPill({ pct }) {
  if (pct === null || pct === undefined) return <span className="muted">—</span>;
  const cls = pct >= 75 ? "good" : pct >= 50 ? "warn" : "bad";
  return <span className={"pct-pill " + cls}>{Number(pct).toFixed(1)}%</span>;
}

function EligBadge({ status }) {
  if (!status) return <span className="elig-badge pending">Pending</span>;
  const label = status === true || status === "eligible" ? "Eligible" : "Not Eligible";
  const cls   = label === "Eligible" ? "eligible" : "ineligible";
  return <span className={"elig-badge " + cls}>{label}</span>;
}

function IaCell({ combined, partA, partB }) {
  if (combined === null || combined === undefined) return <span className="muted">—</span>;
  const cls = combined >= 15 ? "ia-pass" : "ia-fail";
  return (
    <div className="ia-cell">
      <span className={cls}>{combined}</span>
      <div className="ia-tooltip">Part A: {partA ?? "—"} / Part B: {partB ?? "—"}</div>
    </div>
  );
}

function HistoricalImportModal({ students, programs, onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsArrayBuffer(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      try {
        await onImport(rows);
        onClose();
      } catch (e) {
        alert(e.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <h2 style={{ margin: "0 0 8px" }}>Import Historical Student Data</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Upload an Excel file exported from your current ERP. Required columns: <code>enrollment_no</code>, <code>full_name</code>, <code>official_email</code>, <code>program_code</code>, <code>intake</code>, <code>intake_year</code>, <code>academic_year</code>, <code>status</code>. Optional: <code>specialisation_group_id</code>, <code>personal_email</code>, <code>mobile</code>.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={handleFile} style={{ marginBottom: 12 }} />
        {preview.length > 0 && (
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Preview (first 5 rows):</p>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>{Object.keys(preview[0]).map((k) => <th key={k}>{k}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CgpaImportModal({ onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      try {
        await onImport(rows);
        onClose();
      } catch (e) {
        alert(e.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <h2 style={{ margin: "0 0 8px" }}>Import Historical GPA / CGPA</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Required columns: <code>enrollment_no</code>, <code>semester_no</code>, <code>academic_year</code>, <code>sgpa</code>, <code>cgpa</code>.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: 12 }} />
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing…" : "Import GPA"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcademicsOverview() {
  const [programs, setPrograms]             = useState([]);
  const [subjects, setSubjects]             = useState([]);
  const [students, setStudents]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [filters, setFilters]               = useState({ programCode: "", intake: "", intakeYear: "", semesterNo: "", status: "active" });
  const [activeSubject, setActiveSubject]   = useState(null);
  const [showStudentImport, setShowStudentImport] = useState(false);
  const [showCgpaImport, setShowCgpaImport] = useState(false);

  useEffect(() => {
    getPrograms().then(setPrograms).catch(console.error);
  }, []);

  useEffect(() => {
    if (filters.programCode && filters.semesterNo) {
      const prog = programs.find((p) => p.code === filters.programCode);
      if (prog) {
        getSubjects({ programId: prog.id, semesterNo: Number(filters.semesterNo) })
          .then(setSubjects)
          .catch(console.error);
      }
    } else {
      setSubjects([]);
      setActiveSubject(null);
    }
  }, [filters.programCode, filters.semesterNo, programs]);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await getStudentsWithAcademics({
        programCode: filters.programCode || undefined,
        intake: filters.intake || undefined,
        intakeYear: filters.intakeYear ? Number(filters.intakeYear) : undefined,
      });
      const filtered = filters.status ? data.filter((s) => s.status === filters.status) : data;
      setStudents(filtered);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(k, v) {
    setFilters((f) => ({ ...f, [k]: v }));
    if (k === "programCode" || k === "semesterNo") setActiveSubject(null);
  }

  // Get max semesters for selected program
  const selectedProg = programs.find((p) => p.code === filters.programCode);
  const maxSem = selectedProg?.semesters || 6;

  // Build GPA columns dynamically
  const semCount = selectedProg ? selectedProg.semesters : 6;

  function getSgpa(student, sem) {
    const rec = student.cgpa_records?.find((r) => r.semester_no === sem);
    return rec?.sgpa ?? null;
  }

  function getLatestCgpa(student) {
    if (!student.cgpa_records?.length) return null;
    const sorted = [...student.cgpa_records].sort((a, b) => b.semester_no - a.semester_no);
    return sorted[0]?.cgpa ?? null;
  }

  function getMarksheetStatus(student, sem) {
    const rec = student.marksheet_status?.find((r) => r.semester_no === sem && r.document_type === "marksheet");
    return rec?.status ?? "pending";
  }

  function getDegreeStatus(student) {
    const rec = student.marksheet_status?.find((r) => r.document_type === "degree_certificate");
    return rec?.status ?? "pending";
  }

  function getCourseraUtilisation(student) {
    if (!student.coursera_records?.length) return null;
    const avg = student.coursera_records.reduce((s, r) => s + (r.utilisation_pct || 0), 0) / student.coursera_records.length;
    return avg;
  }

  async function handleStudentImport(rows) {
    const records = rows.map((r) => ({
      enrollment_no:   String(r.enrollment_no || ""),
      full_name:       String(r.full_name || ""),
      official_email:  String(r.official_email || ""),
      personal_email:  r.personal_email ? String(r.personal_email) : null,
      mobile:          r.mobile ? String(r.mobile) : null,
      intake:          String(r.intake || ""),
      intake_year:     Number(r.intake_year),
      academic_year:   String(r.academic_year || ""),
      status:          String(r.status || "active"),
      application_no:  r.application_no ? String(r.application_no) : null,
    }));
    await importHistoricalStudents(records);
    alert(`${records.length} students imported.`);
    await loadStudents();
  }

  async function handleCgpaImport(rows) {
    // Must match enrollment_no to student_id first — done via service
    // For now we store with enrollment_no and the backend can resolve
    const records = rows.map((r) => ({
      enrollment_no: String(r.enrollment_no),
      semester_no:   Number(r.semester_no),
      academic_year: String(r.academic_year),
      sgpa:          Number(r.sgpa),
      cgpa:          Number(r.cgpa),
      is_imported:   true,
    }));
    await importCgpaRecords(records);
    alert(`${records.length} GPA records imported.`);
    await loadStudents();
  }

  const nonBridgeSubjects = subjects.filter((s) => !s.is_bridge);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0 }}>Academics — Student Overview</h1>
          <p className="muted">View all students with GPA, grades and academic status.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => setShowCgpaImport(true)}>Import GPA / CGPA</button>
          <button className="secondary" onClick={() => setShowStudentImport(true)}>Import Students</button>
          <button onClick={loadStudents} disabled={loading}>{loading ? "Loading…" : "Load Students"}</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Course</label>
          <select value={filters.programCode} onChange={(e) => setFilter("programCode", e.target.value)}>
            <option value="">All Courses</option>
            {programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Intake</label>
          <select value={filters.intake} onChange={(e) => setFilter("intake", e.target.value)}>
            <option value="">All</option>
            {INTAKES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Year</label>
          <select value={filters.intakeYear} onChange={(e) => setFilter("intakeYear", e.target.value)}>
            <option value="">All Years</option>
            {INTAKE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Semester</label>
          <select value={filters.semesterNo} onChange={(e) => setFilter("semesterNo", e.target.value)}>
            <option value="">All</option>
            {[1,2,3,4,5,6].filter((s) => s <= maxSem).map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject tabs — shown only when semester is selected */}
      {filters.semesterNo && nonBridgeSubjects.length > 0 && (
        <div>
          <p className="section-title">Select subject to see subject-level columns</p>
          <div className="subject-tabs">
            <button
              className={"subject-tab" + (!activeSubject ? " active" : "")}
              onClick={() => setActiveSubject(null)}
            >
              Overview
            </button>
            {nonBridgeSubjects.map((s) => (
              <button
                key={s.id}
                className={"subject-tab" + (activeSubject?.id === s.id ? " active" : "")}
                onClick={() => setActiveSubject(s)}
              >
                {s.course_code}
                <span style={{ fontSize: 10, display: "block", opacity: 0.8 }}>{s.course_name.length > 20 ? s.course_name.slice(0,18)+"…" : s.course_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {students.length === 0 && !loading ? (
          <div className="empty-state">
            <p>No students loaded. Apply filters and click <strong>Load Students</strong>.</p>
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

                {!activeSubject ? (
                  <>
                    <th>Coursera %</th>
                    {Array.from({ length: semCount }, (_, i) => i + 1).map((s) => (
                      <th key={s}>S{s} GPA</th>
                    ))}
                    <th>CGPA</th>
                    {Array.from({ length: semCount }, (_, i) => i + 1).map((s) => (
                      <th key={s}>Marksheet S{s}</th>
                    ))}
                    <th>Marksheet Overall</th>
                    <th>Degree Cert.</th>
                  </>
                ) : (
                  <>
                    <th>LMS Participation</th>
                    <th>LS Attendance</th>
                    <th>Assignment 1</th>
                    <th>Assignment 2</th>
                    <th>Final IA</th>
                    <th>ESE (of 70)</th>
                    <th>Total</th>
                    <th>Grade</th>
                    <th>Eligibility</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={20} style={{ padding: 24, textAlign: "center" }}>Loading…</td></tr>
              )}
              {!loading && students.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{s.enrollment_no}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{s.full_name}</td>
                  <td style={{ fontSize: 12 }}>{s.official_email || <span className="muted">—</span>}</td>
                  <td><span className="badge">{s.programs?.code || "—"}</span></td>
                  <td style={{ fontSize: 12 }}>{s.specialisation_groups?.name || <span className="muted">—</span>}</td>
                  <td>{s.intake_year || "—"}</td>
                  <td>{s.intake || "—"}</td>

                  {!activeSubject ? (
                    <>
                      <td><PctPill pct={getCourseraUtilisation(s)} /></td>
                      {Array.from({ length: semCount }, (_, i) => i + 1).map((sem) => (
                        <td key={sem} style={{ textAlign: "center" }}>
                          {getSgpa(s, sem) !== null ? <strong>{getSgpa(s, sem).toFixed(2)}</strong> : <span className="muted">—</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>
                        {getLatestCgpa(s) !== null ? <strong>{getLatestCgpa(s).toFixed(2)}</strong> : <span className="muted">—</span>}
                      </td>
                      {Array.from({ length: semCount }, (_, i) => i + 1).map((sem) => (
                        <td key={sem} style={{ textAlign: "center" }}>
                          {getMarksheetStatus(s, sem) === "sent"
                            ? <span className="badge resolved">Sent</span>
                            : <span className="badge">Pending</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>
                        {getMarksheetStatus(s, null) === "sent"
                          ? <span className="badge resolved">Sent</span>
                          : <span className="badge">Pending</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {getDegreeStatus(s) === "sent"
                          ? <span className="badge resolved">Issued</span>
                          : <span className="badge">Pending</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><span className="muted">—</span></td>
                      <td style={{ textAlign: "center" }}><GradeBadge grade={null} /></td>
                      <td style={{ textAlign: "center" }}><EligBadge status={null} /></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        {students.length > 0 && `${students.length} student${students.length !== 1 ? "s" : ""} shown. Subject-level data (IA, ESE, grades) populates once marks are imported via the LMS and grades import.`}
      </p>

      {showStudentImport && (
        <HistoricalImportModal
          programs={programs}
          onImport={handleStudentImport}
          onClose={() => setShowStudentImport(false)}
        />
      )}
      {showCgpaImport && (
        <CgpaImportModal
          onImport={handleCgpaImport}
          onClose={() => setShowCgpaImport(false)}
        />
      )}
    </div>
  );
}
