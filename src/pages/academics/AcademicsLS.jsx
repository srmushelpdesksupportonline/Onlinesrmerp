import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getPrograms,
  getSubjects,
  getLsSessions,
  getLsAttendance,
  upsertLsSession,
  importLsAttendance,
} from "../../services/academicservice";

const INTAKES = ["JAN", "JUL"];
const INTAKE_YEARS = [2024, 2025, 2026];
const WEEKS = [1,2,3,4,5,6,7,8,9,10,11,12];

function filtersComplete(f) {
  return f.intakeYear && f.intake && f.programCode && f.semesterNo;
}

// Detect file platform from column headers
function detectPlatform(headers) {
  const h = headers.map((x) => String(x).toLowerCase());
  if (h.includes("duration (min)") || h.includes("webinar id")) return "zoho";
  if (h.includes("time joined") || h.includes("time exited")) return "google_meet";
  return "unknown";
}

// Parse Google Meet attendance export
function parseGoogleMeet(rows) {
  return rows.map((r) => ({
    email:        String(r["Email"] || "").toLowerCase().trim(),
    first_name:   String(r["First name"] || ""),
    last_name:    String(r["Last name"] || ""),
    duration_min: Number(r["Duration"] || 0),
    joined_time:  r["Time joined"] ? String(r["Time joined"]) : null,
    exited_time:  r["Time exited"] ? String(r["Time exited"]) : null,
  })).filter((r) => r.email);
}

// Parse Zoho Webinar attendee export
// Zoho has a multi-row metadata header. Actual attendee data starts after "Attendee Details" row.
function parseZoho(rawRows) {
  // Find the header row (row with "First Name", "Last Name", etc.)
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const vals = Object.values(rawRows[i]).map((v) => String(v || "").toLowerCase());
    if (vals.some((v) => v.includes("first name"))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];
  const headerRow = rawRows[headerIdx];
  const keys = Object.values(headerRow).map((v) => String(v));
  const attendees = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const vals = Object.values(rawRows[i]);
    const obj = {};
    keys.forEach((k, ki) => { obj[k] = vals[ki]; });
    if (!obj["Email"]) continue;
    attendees.push({
      email:        String(obj["Email"] || "").toLowerCase().trim(),
      first_name:   String(obj["First Name"] || ""),
      last_name:    String(obj["Last Name"] || ""),
      duration_min: Number(obj["Duration (min)"] || 0),
      joined_time:  obj["Joined Time"] ? String(obj["Joined Time"]) : null,
      exited_time:  null,
    });
  }
  return attendees.filter((r) => r.email);
}

function SessionMetaModal({ session, onSave, onClose }) {
  const [form, setForm] = useState({
    faculty_name: session?.faculty_name || "",
    video_link:   session?.video_link || "",
    session_date: session?.session_date || "",
    platform:     session?.platform || "google_meet",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <h2 style={{ margin: "0 0 16px" }}>Session Details — Week {session?.week_no}</h2>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Faculty Name</label>
          <input value={form.faculty_name} onChange={(e) => setForm((f) => ({ ...f, faculty_name: e.target.value }))} placeholder="e.g. Dr. Priya Sharma" />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Session Date</label>
          <input type="date" value={form.session_date} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Platform</label>
          <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
            <option value="google_meet">Google Meet</option>
            <option value="zoho">Zoho Webinar</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Video Link (Google Drive / Zoho Drive)</label>
          <input value={form.video_link} onChange={(e) => setForm((f) => ({ ...f, video_link: e.target.value }))} placeholder="https://drive.google.com/..." />
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AcademicsLS() {
  const [programs, setPrograms]         = useState([]);
  const [subjects, setSubjects]         = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);
  const [sessions, setSessions]         = useState([]);   // ls_sessions for active subject
  const [attendance, setAttendance]     = useState([]);   // flat attendance records
  const [filters, setFilters]           = useState({ programCode: "", intake: "", intakeYear: "", semesterNo: "" });
  const [loading, setLoading]           = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importWeek, setImportWeek]     = useState("");
  const [sessionModal, setSessionModal] = useState(null);
  const fileRef = useRef();

  useEffect(() => { getPrograms().then(setPrograms).catch(console.error); }, []);

  const selectedProg = programs.find((p) => p.code === filters.programCode);
  const maxSem = selectedProg?.semesters || 6;

  useEffect(() => {
    if (filters.programCode && filters.semesterNo) {
      const prog = programs.find((p) => p.code === filters.programCode);
      if (prog) {
        getSubjects({ programId: prog.id, semesterNo: Number(filters.semesterNo) })
          .then((s) => {
            const nonBridge = s.filter((x) => !x.is_bridge);
            setSubjects(nonBridge);
            setActiveSubject(null);
          })
          .catch(console.error);
      }
    } else {
      setSubjects([]);
      setActiveSubject(null);
    }
  }, [filters.programCode, filters.semesterNo, programs]);

  useEffect(() => {
    if (activeSubject && filtersComplete(filters)) {
      loadSessionsAndAttendance();
    } else {
      setSessions([]);
      setAttendance([]);
    }
  }, [activeSubject, filters]);

  async function loadSessionsAndAttendance() {
    setLoading(true);
    try {
      const sess = await getLsSessions({
        subjectId:   activeSubject.id,
        semesterNo:  Number(filters.semesterNo),
        intake:      filters.intake,
        programCode: filters.programCode,
      });
      setSessions(sess);
      if (sess.length > 0) {
        const allAtt = await Promise.all(sess.map((s) => getLsAttendance({ sessionId: s.id })));
        setAttendance(allAtt.flat());
      } else {
        setAttendance([]);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  const complete = filtersComplete(filters);

  // Build student list from attendance records
  const studentMap = {};
  attendance.forEach((a) => {
    const s = a.student_master;
    if (!s) return;
    if (!studentMap[s.enrollment_no]) {
      studentMap[s.enrollment_no] = {
        enrollment_no: s.enrollment_no,
        full_name:     s.full_name,
        official_email: s.official_email,
        attendance:    {},
      };
    }
    const sess = sessions.find((x) => x.id === a.session_id);
    if (sess) {
      studentMap[s.enrollment_no].attendance[sess.week_no] = a.is_present;
    }
  });
  const studentRows = Object.values(studentMap);

  function attendancePct(student) {
    const totalSessions = sessions.length;
    if (!totalSessions) return null;
    const present = Object.values(student.attendance).filter(Boolean).length;
    return ((present / totalSessions) * 100).toFixed(1);
  }

  async function handleSaveSessionMeta(weekNo, form) {
    const record = {
      subject_id:   activeSubject.id,
      semester_no:  Number(filters.semesterNo),
      academic_year: `${filters.intakeYear}-${String(Number(filters.intakeYear)+1).slice(2)}`,
      intake:       filters.intake,
      program_code: filters.programCode,
      week_no:      weekNo,
      ...form,
    };
    const existing = sessions.find((s) => s.week_no === weekNo);
    if (existing) record.id = existing.id;
    await upsertLsSession(record);
    await loadSessionsAndAttendance();
  }

  async function handleImportAttendance(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!activeSubject) { alert("Select a subject first."); fileRef.current.value = ""; return; }
    if (!importWeek) { alert("Select which week this attendance file is for."); fileRef.current.value = ""; return; }
    if (!complete) { alert("Complete all filters first."); fileRef.current.value = ""; return; }

    setImporting(true);
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        let rawRows;
        if (ext === "csv") {
          const wb = XLSX.read(ev.target.result, { type: "string" });
          rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          const wb2 = XLSX.read(ev.target.result, { type: "string" });
          rawRows = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);
        } else {
          const wb = XLSX.read(ev.target.result, { type: "array" });
          rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }

        const headers = Object.keys(rawRows[0] || {});
        const platform = detectPlatform(headers);
        let attendees = [];
        if (platform === "google_meet") attendees = parseGoogleMeet(rawRows);
        else if (platform === "zoho") attendees = parseZoho(rawRows);
        else { alert("Could not detect file format. Expected Google Meet or Zoho export."); return; }

        // Ensure session record exists for this week
        let sessionRecord = sessions.find((s) => s.week_no === Number(importWeek));
        if (!sessionRecord) {
          sessionRecord = await upsertLsSession({
            subject_id:   activeSubject.id,
            semester_no:  Number(filters.semesterNo),
            academic_year: `${filters.intakeYear}-${String(Number(filters.intakeYear)+1).slice(2)}`,
            intake:       filters.intake,
            program_code: filters.programCode,
            week_no:      Number(importWeek),
            platform,
          });
        }

        // Match attendees to students by email
        // We store email match and mark present; non-matched emails stored for review
        const attendanceRecords = attendees.map((a) => ({
          session_id:   sessionRecord.id,
          official_email: a.email,
          is_present:   true,
          duration_min: a.duration_min || null,
          joined_time:  a.joined_time || null,
          exited_time:  a.exited_time || null,
        }));

        await importLsAttendance(attendanceRecords);
        alert(`${attendanceRecords.length} attendance records imported for Week ${importWeek}.`);
        await loadSessionsAndAttendance();
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

  const sessionsByWeek = {};
  sessions.forEach((s) => { sessionsByWeek[s.week_no] = s; });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0 }}>Live Sessions</h1>
          <p className="muted">Track attendance per subject per week. Import Google Meet or Zoho exports.</p>
        </div>
      </div>

      {/* Mandatory filters */}
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
            * All filters required
          </div>
        )}
      </div>

      {/* Subject tabs */}
      {complete && subjects.length > 0 && (
        <div>
          <p className="section-title">Select subject</p>
          <div className="subject-tabs">
            {subjects.map((s) => (
              <button
                key={s.id}
                className={"subject-tab" + (activeSubject?.id === s.id ? " active" : "")}
                onClick={() => setActiveSubject(s)}
              >
                {s.course_code}
                <span style={{ fontSize: 10, display: "block", opacity: 0.8 }}>
                  {s.course_name.length > 22 ? s.course_name.slice(0, 20) + "…" : s.course_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import controls — only when subject is selected */}
      {activeSubject && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px" }}>
          <strong style={{ fontSize: 13 }}>Import attendance for:</strong>
          <select
            value={importWeek}
            onChange={(e) => setImportWeek(e.target.value)}
            style={{ width: 120 }}
          >
            <option value="">Select week</option>
            {WEEKS.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
          <input type="file" ref={fileRef} accept=".csv,.xlsx,.xls" onChange={handleImportAttendance} style={{ display: "none" }} />
          <button
            className="secondary"
            onClick={() => fileRef.current.click()}
            disabled={importing || !importWeek}
          >
            {importing ? "Importing…" : "Upload Google Meet / Zoho File"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Platform auto-detected from file columns</span>
        </div>
      )}

      {/* Attendance table */}
      {activeSubject && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          {loading ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : (
            <table>
              <thead>
                {/* Row 1: Faculty + video link above week columns */}
                <tr style={{ background: "#f0fdf4" }}>
                  <th colSpan={7}></th>
                  {WEEKS.map((w) => {
                    const sess = sessionsByWeek[w];
                    return (
                      <th key={w} className="week-header" style={{ background: "#f0fdf4", minWidth: 72 }}>
                        {sess ? (
                          <>
                            <span className="week-faculty">{sess.faculty_name || "—"}</span>
                            {sess.video_link
                              ? <a className="week-link" href={sess.video_link} target="_blank" rel="noreferrer">▶ Recording</a>
                              : <span className="week-link" style={{ color: "#9ca3af" }}>No link</span>}
                          </>
                        ) : (
                          <button
                            className="btn-icon"
                            style={{ fontSize: 10, padding: "2px 4px" }}
                            onClick={() => setSessionModal({ week_no: w })}
                          >
                            + Add
                          </button>
                        )}
                        {sess && (
                          <button
                            className="btn-icon"
                            style={{ fontSize: 9, padding: "1px 3px", marginTop: 2 }}
                            onClick={() => setSessionModal(sess)}
                          >
                            ✏️
                          </button>
                        )}
                      </th>
                    );
                  })}
                  <th></th>
                </tr>
                {/* Row 2: Column labels */}
                <tr>
                  <th>Enroll No.</th>
                  <th>Name</th>
                  <th>Official Email</th>
                  <th>Course</th>
                  <th>Specialisation</th>
                  <th>Year</th>
                  <th>Intake</th>
                  {WEEKS.map((w) => (
                    <th key={w} style={{ textAlign: "center", fontSize: 12 }}>W{w}</th>
                  ))}
                  <th style={{ textAlign: "center" }}>Overall %</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.length === 0 ? (
                  <tr>
                    <td colSpan={20}>
                      <div className="empty-state">
                        <p>No attendance data yet for <strong>{activeSubject.course_code}</strong>.</p>
                        <p style={{ fontSize: 12 }}>Import Google Meet or Zoho attendance files for each week.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  studentRows.map((s) => {
                    const pct = attendancePct(s);
                    return (
                      <tr key={s.enrollment_no}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.enrollment_no}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{s.full_name}</td>
                        <td style={{ fontSize: 12 }}>{s.official_email}</td>
                        <td><span className="badge">{filters.programCode}</span></td>
                        <td className="muted" style={{ fontSize: 12 }}>—</td>
                        <td>{filters.intakeYear}</td>
                        <td>{filters.intake}</td>
                        {WEEKS.map((w) => {
                          const present = s.attendance[w];
                          const sessionExists = !!sessionsByWeek[w];
                          return (
                            <td key={w} style={{ textAlign: "center" }}>
                              {sessionExists
                                ? present === true
                                  ? <span className="att-present">✓</span>
                                  : <span className="att-absent">✗</span>
                                : <span className="muted" style={{ fontSize: 10 }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center" }}>
                          {pct !== null
                            ? <span className={"pct-pill " + (Number(pct) >= 75 ? "good" : Number(pct) >= 50 ? "warn" : "bad")}>{pct}%</span>
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!complete && (
        <div className="empty-state">
          <p>Select Year, Intake, Course and Semester to view live session data.</p>
        </div>
      )}

      {complete && !activeSubject && subjects.length > 0 && (
        <div className="empty-state">
          <p>Select a subject above to view and import attendance.</p>
        </div>
      )}

      {sessionModal && (
        <SessionMetaModal
          session={sessionModal}
          onSave={(form) => handleSaveSessionMeta(sessionModal.week_no, form)}
          onClose={() => setSessionModal(null)}
        />
      )}
    </div>
  );
}
