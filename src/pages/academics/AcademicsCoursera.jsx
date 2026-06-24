import { useState, useEffect } from "react";
import { getPrograms } from "../../services/academicservice";

const INTAKES = ["JAN", "JUL"];
const INTAKE_YEARS = [2024, 2025, 2026];

function filtersComplete(f) {
  return f.intakeYear && f.intake && f.programCode && f.semesterNo;
}

export default function AcademicsCoursera() {
  const [programs, setPrograms] = useState([]);
  const [filters, setFilters]   = useState({ programCode: "", intake: "", intakeYear: "", semesterNo: "" });

  useEffect(() => { getPrograms().then(setPrograms).catch(console.error); }, []);

  const selectedProg = programs.find((p) => p.code === filters.programCode);
  const maxSem = selectedProg?.semesters || 6;
  const complete = filtersComplete(filters);

  function setFilter(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0 }}>Coursera</h1>
          <p className="muted">Track student Coursera utilisation per batch and semester.</p>
        </div>
        <button disabled style={{ opacity: 0.5 }}>Import Coursera Report</button>
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

      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h3 style={{ margin: "0 0 8px", color: "#374151" }}>Coursera Report Columns Coming Monday</h3>
        <p className="muted" style={{ maxWidth: 420, margin: "0 auto" }}>
          Once the Coursera report format is shared, this module will be fully built out. The filter bar, student base columns and import functionality are already structured and ready.
        </p>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Columns will include: Enroll No., Name, Official Email, Course, Specialisation, Year, Intake + all Coursera report fields. Utilisation % will be shown in the Student Overview.
        </p>
      </div>
    </div>
  );
}
