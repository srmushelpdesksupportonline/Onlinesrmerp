import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../supabaseClient";

const PROGRAMS   = ["MBA","MCA","BBA","BCA"];
const CATEGORIES = ["CORE","ELECTIVE_DEFAULT","SPECIALISATION_ELECTIVE","BRIDGE"];
const COURSE_TYPES = ["Th","OP","P","I"];
const COURSE_TYPE_LABEL = {
  Th:  "Theory",
  OP:  "Online Practical",
  P:   "Project",
  I:   "Internship",
};
const COURSE_TYPE_STYLE = {
  Th:  { bg: "#dbeafe", text: "#1e40af" },
  OP:  { bg: "#d1fae5", text: "#065f46" },
  P:   { bg: "#fef3c7", text: "#92400e" },
  I:   { bg: "#ede9fe", text: "#5b21b6" },
};
const SPEC_TYPES = ["Group","Open","Open Group"];

const CATEGORY_LABEL = {
  CORE:                    "Core",
  ELECTIVE_DEFAULT:        "Elective",
  SPECIALISATION_ELECTIVE: "Spec. Elective",
  BRIDGE:                  "Bridge",
};

const CATEGORY_STYLE = {
  CORE:                    { bg: "#dbeafe", text: "#1e40af" },
  ELECTIVE_DEFAULT:        { bg: "#ede9fe", text: "#5b21b6" },
  SPECIALISATION_ELECTIVE: { bg: "#fef3c7", text: "#92400e" },
  BRIDGE:                  { bg: "#f3f4f6", text: "#6b7280" },
};

// ── Course Modal (Add / Edit) ─────────────────────────────────────────────────
function CourseModal({ course, arId: activeARNumber, programs, specGroups, onSave, onClose }) {
  const isNew = !course?.id;
  const [form, setForm] = useState({
    program_id:              course?.program_id || "",
    semester:                course?.semester || "",
    course_code:             course?.course_code || "",
    course_name:             course?.course_name || "",
    course_type:             course?.course_type || "Th",
    credits:                 course?.credits ?? "",
    category:                course?.category || "CORE",
    is_bridge:               course?.is_bridge || false,
    specialisation_type:     course?.specialisation_type || "",
    specialisation_group_id: course?.specialisation_group_id || "",
    ia_max:                  course?.ia_max ?? 30,
    ia_min:                  course?.ia_min ?? 15,
    ese_max:                 course?.ese_max ?? 70,
    ese_min:                 course?.ese_min ?? 35,
    source_note:             course?.source_note || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const filteredGroups = specGroups.filter(g =>
    !form.program_id || g.program_id_text === form.program_id
  );

  async function handleSave() {
    if (!form.program_id || !form.semester || !form.course_code || !form.course_name) {
      setError("Program, Semester, Course Code and Course Name are required."); return;
    }
    setSaving(true); setError("");
    try {
      const payload = {
        scheme_id:               arId,
        program_id:              form.program_id,
        semester:                Number(form.semester),
        course_code:             form.course_code.trim(),
        course_name:             form.course_name.trim(),
        course_type:             form.course_type,
        credits:                 form.credits === "" ? null : Number(form.credits),
        category:                form.category,
        is_bridge:               form.is_bridge,
        specialisation_type:     form.specialisation_type || null,
        specialisation_group_id: form.specialisation_group_id || null,
        ia_max:                  Number(form.ia_max),
        ia_min:                  Number(form.ia_min),
        ese_max:                 Number(form.ese_max),
        ese_min:                 Number(form.ese_min),
        source_note:             form.source_note || null,
      };
      if (isNew) {
        const { error: e } = await supabase.from("courses").insert(payload);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("courses").update(payload).eq("id", course.id);
        if (e) throw e;
      }
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 620 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{isNew ? "Add Course" : "Edit Course"}</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={S.fg}>
            <label style={S.label}>Program *</label>
            <select value={form.program_id} onChange={e => set("program_id", e.target.value)} style={S.input}>
              <option value="">Select</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.program_code} — {p.program_name}</option>)}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Semester *</label>
            <select value={form.semester} onChange={e => set("semester", e.target.value)} style={S.input}>
              <option value="">Select</option>
              {[1,2,3,4,5,6].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Course Code *</label>
            <input value={form.course_code} onChange={e => set("course_code", e.target.value)} placeholder="e.g. EMBA24C101" style={S.input} />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Course Type</label>
            <select value={form.course_type} onChange={e => set("course_type", e.target.value)} style={S.input}>
              {COURSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ ...S.fg, marginBottom: 12 }}>
          <label style={S.label}>Course Name *</label>
          <input value={form.course_name} onChange={e => set("course_name", e.target.value)} placeholder="e.g. Managerial Economics" style={S.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={S.fg}>
            <label style={S.label}>Credits</label>
            <input type="number" value={form.credits} onChange={e => set("credits", e.target.value)} placeholder="e.g. 4" style={S.input} />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} style={S.input}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div style={S.fg}>
            <label style={S.label}>Specialisation Type</label>
            <select value={form.specialisation_type} onChange={e => set("specialisation_type", e.target.value)} style={S.input}>
              <option value="">None</option>
              {SPEC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {form.specialisation_type === "Group" && (
          <div style={{ ...S.fg, marginBottom: 12 }}>
            <label style={S.label}>Specialisation Group</label>
            <select value={form.specialisation_group_id} onChange={e => set("specialisation_group_id", e.target.value)} style={S.input}>
              <option value="">Select group</option>
              {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>IA & ESE Marks</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[
              { key: "ia_max",  label: "IA Max"  },
              { key: "ia_min",  label: "IA Min"  },
              { key: "ese_max", label: "ESE Max" },
              { key: "ese_min", label: "ESE Min" },
            ].map(({ key, label }) => (
              <div key={key} style={S.fg}>
                <label style={S.label}>{label}</label>
                <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} style={S.input} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_bridge} onChange={e => set("is_bridge", e.target.checked)} style={{ accentColor: "#3d4f12" }} />
            Bridge course (no credit)
          </label>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={S.primaryBtn}>
            {saving ? "Saving…" : isNew ? "Add Course" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create AR Modal ────────────────────────────────────────────────────────────
function CreateARModal({ existingARs, programs, specGroups, onSave, onClose }) {
  const lastAR  = existingARs[existingARs.length - 1];
  const nextNum = String(existingARs.length + 1).padStart(2, "0");
  const fileRef = useRef();

  const [mode, setMode]       = useState("copy");   // "copy" | "upload"
  const [form, setForm]       = useState({
    ar_number:   `AR-${nextNum}`,
    ar_date:     "",
    scheme_name: "",
    copyFromAR:  lastAR?.ar_number || "",
  });
  const [uploadFile,    setUploadFile]    = useState(null);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Parse uploaded Excel/CSV file
  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf);
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    setUploadPreview(rows.slice(0, 5));
  }

  // Create schemes for all 4 programs and return map { program_code: scheme_id }
  async function createSchemes() {
    const intProgs = window._intPrograms || [];
    const schemeMap = {};
    for (const prog of intProgs) {
      const { data: newScheme, error: se } = await supabase
        .from("academic_schemes")
        .insert({
          program_id:  prog.id,
          scheme_name: form.scheme_name,
          session:     form.ar_date.includes("JAN") ? "JAN" : "JULY",
          scheme_year: parseInt(form.ar_date.slice(-2)) + 2000 || 2025,
          ar_number:   form.ar_number,
          ar_date:     form.ar_date,
          is_active:   false,
        })
        .select()
        .single();
      if (se) throw se;
      schemeMap[prog.program_code] = { schemeId: newScheme.id, progId: prog.id };
    }
    return schemeMap;
  }

  async function handleCreate() {
    if (!form.ar_date || !form.scheme_name) {
      setError("AR Date and Scheme Name are required."); return;
    }
    if (mode === "upload" && !uploadFile) {
      setError("Please select a file to upload."); return;
    }
    setSaving(true); setError("");
    try {
      const schemeMap = await createSchemes();
      const intProgs  = window._intPrograms || [];

      if (mode === "copy") {
        // Copy from existing AR — per program
        let totalCopied = 0;
        const copyErrors = [];

        for (const prog of intProgs) {
          const { schemeId } = schemeMap[prog.program_code] || {};
          if (!schemeId) continue;

          if (!form.copyFromAR) continue;

          // Find source scheme for this program in the selected AR
          const { data: sourceSchemes, error: ssErr } = await supabase
            .from("academic_schemes")
            .select("id")
            .eq("ar_number", form.copyFromAR)
            .eq("program_id", prog.id)
            .limit(1);

          if (ssErr || !sourceSchemes?.length) {
            copyErrors.push(`No source scheme for ${prog.program_code} in ${form.copyFromAR}`);
            continue;
          }

          const sourceSchemeId = sourceSchemes[0].id;

          // Find UUID program_id in academic_programs
          const uuidProg = (programs || []).find(p => p.program_code === prog.program_code);
          if (!uuidProg) {
            copyErrors.push(`UUID program not found for ${prog.program_code}`);
            continue;
          }

          // Fetch source courses
          const { data: sourceCourses, error: scErr } = await supabase
            .from("courses")
            .select("*")
            .eq("scheme_id", sourceSchemeId)
            .eq("program_id", uuidProg.id);

          if (scErr) { copyErrors.push(`Fetch error ${prog.program_code}: ${scErr.message}`); continue; }
          if (!sourceCourses?.length) { copyErrors.push(`No courses found for ${prog.program_code} in ${form.copyFromAR}`); continue; }

          // Insert courses - no suffix needed, unique constraint is (code, scheme_id, program_id)
          for (const { id, created_at, scheme_id, ...rest } of sourceCourses) {
            const { error: ie } = await supabase.from("courses").insert({
              ...rest,
              scheme_id: form.ar_number,
            });
            if (ie) copyErrors.push(`${rest.course_code}: ${ie.message}`);
            else totalCopied++;
          }
        }

        if (copyErrors.length > 0) {
          console.warn("Copy errors:", copyErrors);
          if (totalCopied === 0) throw new Error("No courses were copied. Errors:\n" + copyErrors.slice(0, 3).join("\n"));
        }
      } else {
        // Upload from file
        const buf  = await uploadFile.arrayBuffer();
        const wb   = XLSX.read(buf);
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const PROG_MAP = {
          MBA: "MBA", MCA: "MCA", BBA: "BBA", BCA: "BCA",
          "Master of Business Administration": "MBA",
          "Master of Computer Applications": "MCA",
          "Bachelor of Business Administration": "BBA",
          "Bachelor of Computer Applications": "BCA",
        };
        const TYPE_MAP = {
          "Theory": "Th", "Th": "Th",
          "Online Practical": "OP", "OP": "OP",
          "Project": "P", "P": "P",
          "Internship": "I", "I": "I",
          "Project/Internship": "P",
        };
        const SPEC_TYPE_MAP = {
          "Group": "Group", "Open": "Open", "Open Group": "Open Group",
          "—": null, "": null,
        };
        const CAT_MAP = {
          "Core": "CORE", "CORE": "CORE",
          "Elective": "ELECTIVE_DEFAULT", "ELECTIVE_DEFAULT": "ELECTIVE_DEFAULT",
          "Elective (Default)": "ELECTIVE_DEFAULT",
          "Specialisation Elective": "SPECIALISATION_ELECTIVE",
          "SPECIALISATION_ELECTIVE": "SPECIALISATION_ELECTIVE",
          "Bridge": "BRIDGE", "BRIDGE": "BRIDGE",
        };

        const toInsert = [];
        for (const row of rows) {
          const progCode = PROG_MAP[String(row["Program"] || "").trim()];
          if (!progCode) continue;
          const { schemeId } = schemeMap[progCode] || {};
          const uuidProg = (programs || []).find(p => p.program_code === progCode);
          if (!schemeId || !uuidProg) continue;

          // Match spec group by name
          const groupName = String(row["Specialisation Group"] || "").trim();
          const matchedGroup = specGroups.find(g => g.name === groupName);

          toInsert.push({
            program_id:              uuidProg.id,
            scheme_id:               form.ar_number,
            course_code:             String(row["Course Code"] || "").trim(),
            course_name:             String(row["Course Name"] || "").trim(),
            course_type:             TYPE_MAP[String(row["Course Type"] || "Th").trim()] || "Th",
            credits:                 row["Credits"] !== "" ? Number(row["Credits"]) : null,
            semester:                Number(row["Semester"] || 1),
            category:                CAT_MAP[String(row["Category"] || "Core").trim()] || "CORE",
            is_bridge:               String(row["Category"] || "").toLowerCase().includes("bridge"),
            specialisation_type:     SPEC_TYPE_MAP[String(row["Specialisation Type"] || "").trim()] ?? (String(row["Specialisation Type"] || "").trim() || null),
            specialisation_group_id: matchedGroup?.id || null,
            ia_max:                  Number(row["IA Max"] || 30),
            ia_min:                  Number(row["IA Min"] || 15),
            ese_max:                 Number(row["ESE Max"] || 70),
            ese_min:                 Number(row["ESE Min"] || 35),
          });
        }

        if (toInsert.length > 0) {
          const { error: ie } = await supabase.from("courses").insert(toInsert);
          if (ie) throw ie;
        }
      }
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Create New Academic Regulation</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* AR details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={S.fg}>
            <label style={S.label}>AR Number</label>
            <input value={form.ar_number} onChange={e => set("ar_number", e.target.value)} style={S.input} placeholder="AR-02" />
          </div>
          <div style={S.fg}>
            <label style={S.label}>AR Date * <span style={{ fontWeight: 400, color: "#9ca3af" }}>(e.g. AR-07/25)</span></label>
            <input value={form.ar_date} onChange={e => set("ar_date", e.target.value)} style={S.input} placeholder="AR-07/25" />
          </div>
        </div>
        <div style={{ ...S.fg, marginBottom: 16 }}>
          <label style={S.label}>Scheme Name * <span style={{ fontWeight: 400, color: "#9ca3af" }}>(e.g. July 2025)</span></label>
          <input value={form.scheme_name} onChange={e => set("scheme_name", e.target.value)} style={S.input} placeholder="July 2025" />
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1.5px solid #d1d5db" }}>
          {[["copy","📋 Copy from existing AR"], ["upload","📤 Upload file"]].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: mode === m ? 700 : 400,
                background: mode === m ? "#2d3a0e" : "#fff",
                color: mode === m ? "#fff" : "#374151",
              }}
            >{label}</button>
          ))}
        </div>

        {/* Copy mode */}
        {mode === "copy" && (
          <div style={{ ...S.fg, marginBottom: 16 }}>
            <label style={S.label}>Copy courses from</label>
            <select value={form.copyFromAR} onChange={e => set("copyFromAR", e.target.value)} style={S.input}>
              <option value="">Start blank</option>
              {existingARs.map(a => <option key={a.ar_number} value={a.ar_number}>{a.ar_number} — {a.scheme_name}</option>)}
            </select>
            {form.copyFromAR && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                All courses from <strong>{form.copyFromAR}</strong> will be copied. You can edit after creation.
              </div>
            )}
          </div>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <div style={{ marginBottom: 16 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer", background: uploadFile ? "#f0fdf4" : "#fafafa", marginBottom: 10 }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{uploadFile ? uploadFile.name : "Click to select Excel or CSV file"}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>.xlsx, .csv — columns: Program, Semester, Course Code, Course Name, Course Type, Credits, Category, Specialisation Type, Specialisation Group, IA Max, IA Min, ESE Max, ESE Min, AR, Date</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileChange} />
            </div>
            {uploadPreview.length > 0 && (
              <div style={{ overflowX: "auto", border: "1px solid #e8ead4", borderRadius: 8 }}>
                <table style={{ fontSize: 11, borderCollapse: "collapse", minWidth: "100%" }}>
                  <thead><tr style={{ background: "#f8f9f4" }}>{Object.keys(uploadPreview[0]).slice(0, 6).map(k => <th key={k} style={{ padding: "5px 8px", textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e8ead4", whiteSpace: "nowrap" }}>{k}</th>)}</tr></thead>
                  <tbody>{uploadPreview.map((r, i) => <tr key={i} style={{ borderBottom: "1px solid #f4f5f0" }}>{Object.values(r).slice(0, 6).map((v, j) => <td key={j} style={{ padding: "4px 8px", color: "#374151" }}>{String(v).slice(0, 25)}</td>)}</tr>)}</tbody>
                </table>
                <div style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>Preview — first 5 rows, first 6 columns</div>
              </div>
            )}
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={S.primaryBtn}>
            {saving ? "Creating…" : `Create ${form.ar_number}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function GroupBadge({ code, name, onClick }) {
  const [show, setShow] = React.useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={e => { e.stopPropagation(); onClick && onClick(); }}
    >
      <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>
        {code}
      </span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1a1f0c", color: "#fff",
          padding: "5px 10px", borderRadius: 6, fontSize: 12,
          whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}>
          {name}
          <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", borderWidth: 4, borderStyle: "solid", borderColor: "#1a1f0c transparent transparent transparent" }} />
        </span>
      )}
    </span>
  );
}

export default function CourseMaster() {
  const [ars,         setArs]         = useState([]);  // distinct AR versions
  const [activeAR,    setActiveAR]    = useState(null);
  const [courses,     setCourses]     = useState([]);
  const [programs,    setPrograms]    = useState([]);
  const [specGroups,  setSpecGroups]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [courseModal, setCourseModal] = useState(null);

  // Filters
  const [filterProgram,  setFilterProgram]  = useState("");
  const [filterSem,      setFilterSem]      = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSpecGroup,setFilterSpecGroup]= useState("");
  const [search,         setSearch]         = useState("");
  const [groupSubjectMap, setGroupSubjectMap] = useState({});
  const [editingAR,   setEditingAR]   = useState(false);
  const [editARForm,  setEditARForm]  = useState({ ar_number: "", ar_date: "" });
  const [savingAR,    setSavingAR]    = useState(false);

  // Load programs + spec groups once
  useEffect(() => {
    async function init() {
      const [{ data: progs }, { data: intProgs }, { data: groups }] = await Promise.all([
        supabase.from("academic_programs").select("id, program_code, program_name, total_semesters").order("program_code"),
        supabase.from("programs").select("id, program_code, program_name, total_semesters").order("program_code"),
        supabase.from("specialisation_groups").select("id, name, group_code, program_id").order("name"),
      ]);
      // academic_programs (UUID) used for courses FK
      setPrograms(progs || []);
      // programs (integer) used for academic_schemes FK — store separately
      window._intPrograms = intProgs || [];
      const enriched = (groups || []).map(g => ({
        ...g,
        program_id_text: g.program_id,
      }));
      setSpecGroups(enriched);
    }
    init();
  }, []);

  // Load ARs (distinct scheme versions)
  const loadARs = useCallback(async () => {
    // Get one scheme per AR number (just take first program's scheme as representative)
    const { data, error } = await supabase
      .from("academic_schemes")
      .select("id, scheme_name, ar_number, ar_date, is_active, program_id")
      .order("ar_number", { ascending: true });
    if (error) { console.error(error); return; }

    // Deduplicate by ar_number — keep unique ARs
    const seen = new Set();
    const unique = [];
    for (const s of data || []) {
      if (!seen.has(s.ar_number)) {
        seen.add(s.ar_number);
        unique.push(s);
      }
    }
    setArs(unique);
    if (unique.length && !activeAR) setActiveAR(unique[unique.length - 1]);
  }, []);

  useEffect(() => { loadARs(); }, [loadARs]);

  // Load courses for active AR
  const loadCourses = useCallback(async () => {
    if (!activeAR) return;
    setLoading(true);
    try {
      // scheme_id is now ar_number text (e.g. "AR-01") — filter directly
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          academic_programs(program_code, program_name),
          specialisation_groups(name, group_code)
        `)
        .eq("scheme_id", activeAR.ar_number)
        .order("semester")
        .order("course_code");

      if (error) throw error;
      const courseList = data || [];
      setCourses(courseList);

      // Load group-subject mappings via course_code (bridge between subjects and courses tables)
      if (courseList.length > 0) {
        const { data: mappings } = await supabase
          .from("specialisation_group_subjects")
          .select("subjects(course_code), specialisation_groups(name, group_code)");

        // Build map: course_code -> [group_name, ...]
        const map = {};
        for (const m of mappings || []) {
          const code     = m.subjects?.course_code;
          const shortCode = m.specialisation_groups?.group_code || m.specialisation_groups?.name || "";
          const fullName  = m.specialisation_groups?.name || "";
          if (code && shortCode) {
            if (!map[code]) map[code] = [];
            if (!map[code].find(g => g.code === shortCode)) {
              map[code].push({ code: shortCode, name: fullName });
            }
          }
        }
        setGroupSubjectMap(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeAR]);

  useEffect(() => { loadCourses(); }, [activeAR, loadCourses]);

  async function handleDeleteCourse(id) {
    if (!window.confirm("Delete this course?")) return;
    await supabase.from("courses").delete().eq("id", id);
    loadCourses();
  }

  // Filtered courses
  const filtered = courses.filter(c => {
    if (filterProgram  && c.academic_programs?.program_code !== filterProgram) return false;
    if (filterSem      && c.semester !== Number(filterSem))                    return false;
    if (filterCategory) {
      if (filterCategory === "ELECTIVE") {
        if (!["ELECTIVE_DEFAULT","SPECIALISATION_ELECTIVE"].includes(c.category)) return false;
      } else {
        if (c.category !== filterCategory) return false;
      }
    }
    if (filterSpecGroup) {
      const courseGroups = groupSubjectMap[c.course_code] || [];
      const selectedGroup = specGroups.find(g => String(g.id) === String(filterSpecGroup));
      if (!selectedGroup) return false;
      // Must match both group name AND program
      const intProg = (window._intPrograms || []).find(p => p.program_code === c.academic_programs?.program_code);
      if (intProg && Number(selectedGroup.program_id) !== Number(intProg.id)) return false;
      const match = courseGroups.find(g =>
        (g.name || g) === selectedGroup.name ||
        (g.code || g) === selectedGroup.group_code
      );
      if (!match) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.course_code?.toLowerCase().includes(q) &&
          !c.course_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const maxSem = programs.find(p => p.program_code === filterProgram)?.total_semesters || 6;

  // Get AR-level scheme IDs for add course
  const activeSchemeForProgram = async (programCode) => {
    const prog = programs.find(p => p.program_code === programCode);
    if (!prog) return null;
    const { data } = await supabase
      .from("academic_schemes")
      .select("id")
      .eq("ar_number", activeAR?.ar_number)
      .eq("program_id", prog.id)
      .single();
    return data?.id || null;
  };

  async function handleDeleteAR(ar) {
    if (ars.length <= 1) {
      alert("Cannot delete the only AR. At least one AR must exist."); return;
    }
    if (!window.confirm(`Delete ${ar.ar_number} (${ar.ar_date})? This will permanently delete all courses in this AR. This cannot be undone.`)) return;
    try {
      // Delete all courses with this ar_number as scheme_id
      await supabase.from("courses").delete().eq("scheme_id", ar.ar_number);
      // Delete all academic_schemes for this ar_number
      await supabase.from("academic_schemes").delete().eq("ar_number", ar.ar_number);

      // Switch to first available AR
      setActiveAR(null);
      await loadARs();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  async function handleSaveAREdit() {
    if (!editARForm.ar_number || !editARForm.ar_date) return;
    setSavingAR(true);
    try {
      // Update all academic_schemes with this ar_number
      const { error } = await supabase
        .from("academic_schemes")
        .update({ ar_number: editARForm.ar_number, ar_date: editARForm.ar_date })
        .eq("ar_number", activeAR.ar_number);
      if (error) throw error;
      // Also update courses.scheme_id since it stores ar_number as text
      if (editARForm.ar_number !== activeAR.ar_number) {
        await supabase
          .from("courses")
          .update({ scheme_id: editARForm.ar_number })
          .eq("scheme_id", activeAR.ar_number);
      }
      setEditingAR(false);
      setActiveAR(prev => ({ ...prev, ar_number: editARForm.ar_number, ar_date: editARForm.ar_date }));
      await loadARs();
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSavingAR(false);
    }
  }

  function startEditAR() {
    setEditARForm({ ar_number: activeAR.ar_number, ar_date: activeAR.ar_date || "" });
    setEditingAR(true);
  }

  function handleDownloadAR() {
    if (!activeAR || courses.length === 0) return;
    const rows = courses.map(c => ({
      "Program":               c.academic_programs?.program_code || "",
      "Semester":              c.semester,
      "Course Code":           c.course_code,
      "Course Name":           c.course_name,
      "Course Type":           COURSE_TYPE_LABEL[c.course_type] || c.course_type || "",
      "Credits":               c.credits ?? "",
      "Category":              CATEGORY_LABEL[c.category] || c.category || "",
      "Specialisation Type":   c.category === "ELECTIVE_DEFAULT" ? "Open" : c.category === "SPECIALISATION_ELECTIVE" ? "Group" : "",
      "Specialisation Group":  (groupSubjectMap[c.course_code] || []).map(g => g.code || g).join(", ") || c.specialisation_groups?.group_code || c.specialisation_groups?.name || "",
      "IA Max":                c.ia_max ?? 30,
      "IA Min":                c.ia_min ?? 15,
      "ESE Max":               c.ese_max ?? 70,
      "ESE Min":               c.ese_min ?? 35,
      "AR":                    activeAR.ar_number,
      "Date":                  activeAR.ar_date || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeAR.ar_number);
    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] || "").length)) + 2
    }));
    ws["!cols"] = colWidths;
    XLSX.writeFile(wb, `CourseMaster_${activeAR.ar_number}_${activeAR.ar_date || ""}.xlsx`);
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f4f5f0", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 24px", background: "#fff", borderBottom: "1px solid #e8ead4", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a1f0c" }}>Course Master</h2>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Academic Regulation (AR) — Course catalog per regulation version
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeAR && courses.length > 0 && (
            <button onClick={handleDownloadAR} style={S.outlineBtn}>
              ⬇ Download {activeAR.ar_number}
            </button>
          )}
          <button onClick={() => setShowCreate(true)} style={S.primaryBtn}>+ Create New AR</button>
        </div>
      </div>

      {/* ── AR Tabs ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8ead4", padding: "0 24px", display: "flex", gap: 4, flexShrink: 0 }}>
        {ars.length === 0 && (
          <div style={{ padding: "12px 0", fontSize: 13, color: "#9ca3af" }}>No Academic Regulations yet. Click "+ Create New AR" to begin.</div>
        )}
        {ars.map(ar => {
          const isActive = activeAR?.ar_number === ar.ar_number;
          return (
            <div key={ar.id} style={{ display: "flex", alignItems: "center", borderBottom: isActive ? "2px solid #c8a84b" : "2px solid transparent", marginBottom: -1 }}>
              <button
                onClick={() => setActiveAR(ar)}
                style={{
                  padding: "12px 16px 12px 20px",
                  border: "none", background: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#2d3a0e" : "#6b7280",
                }}
              >
                {ar.ar_number}
                {ar.ar_date && <span style={{ fontSize: 11, marginLeft: 6, color: "#9ca3af", fontWeight: 400 }}>{ar.ar_date}</span>}
              </button>
              {isActive && ars.length > 1 && (
                <button
                  onClick={() => handleDeleteAR(ar)}
                  title={`Delete ${ar.ar_number}`}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#dc2626", fontSize: 13, padding: "4px 6px",
                    borderRadius: 4, lineHeight: 1,
                  }}
                >✕</button>
              )}
            </div>
          );
        })}
      </div>

      {activeAR && (
        <>
          {/* ── Filters + Search ── */}
          <div style={{ padding: "10px 24px", background: "#fff", borderBottom: "1px solid #e8ead4", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", flexShrink: 0 }}>
            <div style={S.fg}>
              <label style={S.label}>Program</label>
              <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); setFilterSem(""); setFilterSpecGroup(""); }} style={S.filterSel}>
                <option value="">All Programs</option>
                {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.label}>Semester</label>
              <select value={filterSem} onChange={e => setFilterSem(e.target.value)} style={S.filterSel}>
                <option value="">All Semesters</option>
                {(["MBA","MCA"].includes(filterProgram) ? [1,2,3,4] : [1,2,3,4,5,6]).map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.label}>Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={S.filterSel}>
                <option value="">All Categories</option>
                <option value="CORE">Core</option>
                <option value="ELECTIVE">Elective</option>
                <option value="BRIDGE">Bridge</option>
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.label}>Specialisation Group</label>
              <select value={filterSpecGroup} onChange={e => setFilterSpecGroup(e.target.value)} style={S.filterSel}>
                <option value="">All Groups</option>
                {specGroups
                  .filter(g => {
                    if (!filterProgram) return true;
                    const intProg = (window._intPrograms || []).find(p => p.program_code === filterProgram);
                    return intProg && Number(g.program_id) === Number(intProg.id);
                  })
                  .map(g => {
                    const intProg = (window._intPrograms || []).find(p => Number(p.id) === Number(g.program_id));
                    const progLabel = intProg ? ` — ${intProg.program_code}` : "";
                    return <option key={g.id} value={g.id}>{g.name}{g.group_code ? ` (${g.group_code})` : ""}{progLabel}</option>;
                  })}
              </select>
            </div>
            <div style={{ ...S.fg, flex: 1, minWidth: 200 }}>
              <label style={S.label}>Search</label>
              <input
                placeholder="Course code or name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.filterSel, width: "100%" }}
              />
            </div>
            <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
              {(filterProgram || filterSem || filterCategory || filterSpecGroup || search) && (
                <button onClick={() => { setFilterProgram(""); setFilterSem(""); setFilterCategory(""); setFilterSpecGroup(""); setSearch(""); }} style={S.outlineBtn}>Clear</button>
              )}
              <button
                onClick={() => setCourseModal({ _new: true })}
                style={S.primaryBtn}
              >
                + Add Course
              </button>
            </div>
          </div>

          {/* ── Course Count + AR Edit ── */}
          <div style={{ padding: "8px 24px", background: "#f8f9f4", borderBottom: "1px solid #e8ead4", fontSize: 13, color: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              Showing <strong style={{ color: "#2d3a0e" }}>{filtered.length}</strong> of <strong style={{ color: "#2d3a0e" }}>{courses.length}</strong> courses in{" "}
              {editingAR ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                  <input
                    value={editARForm.ar_number}
                    onChange={e => setEditARForm(f => ({ ...f, ar_number: e.target.value }))}
                    placeholder="AR-02"
                    style={{ padding: "3px 8px", border: "1.5px solid #c8a84b", borderRadius: 6, fontSize: 13, width: 80, outline: "none", fontWeight: 700, color: "#2d3a0e" }}
                  />
                  <input
                    value={editARForm.ar_date}
                    onChange={e => setEditARForm(f => ({ ...f, ar_date: e.target.value }))}
                    placeholder="AR-07/25"
                    style={{ padding: "3px 8px", border: "1.5px solid #c8a84b", borderRadius: 6, fontSize: 13, width: 90, outline: "none", color: "#c8a84b" }}
                  />
                  <button onClick={handleSaveAREdit} disabled={savingAR} style={{ padding: "3px 10px", background: "#3d4f12", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {savingAR ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditingAR(false)} style={{ padding: "3px 8px", background: "none", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span>
                  <strong style={{ color: "#2d3a0e", marginLeft: 4 }}>{activeAR.ar_number}</strong>
                  {activeAR.ar_date && <span style={{ marginLeft: 6, color: "#c8a84b", fontWeight: 600 }}>· {activeAR.ar_date}</span>}
                  <button onClick={startEditAR} style={{ marginLeft: 10, padding: "2px 8px", background: "none", border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", fontSize: 11, color: "#6b7280" }}>
                    ✏️ Edit AR
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          <div style={{ flex: 1, padding: "16px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
                <div style={{ fontWeight: 600 }}>No courses found</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Try changing filters or add a new course</div>
              </div>
            ) : (
              <div style={{ overflow: "auto", flex: 1, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
                  {/* ── Group row ── */}
                  <tr style={{ background: "#f0f2e8" }}>
                    <th colSpan={2} style={{ ...TH.group, position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}></th>
                    <th colSpan={5} style={{ ...TH.group, borderLeft: "1px solid #e8ead4", position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}>Course</th>
                    <th colSpan={2} style={{ ...TH.group, borderLeft: "1px solid #e8ead4", position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}>Specialisation</th>
                    <th colSpan={2} style={{ ...TH.group, borderLeft: "1px solid #e8ead4", position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}>IA</th>
                    <th colSpan={2} style={{ ...TH.group, borderLeft: "1px solid #e8ead4", position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}>ESE</th>
                    <th colSpan={2} style={{ ...TH.group, borderLeft: "1px solid #e8ead4", position: "sticky", top: 0, zIndex: 3, background: "#f0f2e8" }}>AR</th>
                    <th style={{ ...TH.group, position: "sticky", top: 0, right: 0, zIndex: 4, background: "#f0f2e8", boxShadow: "-2px 0 4px rgba(0,0,0,0.06)" }}></th>
                  </tr>
                  {/* ── Sub-header row ── */}
                  <tr style={{ background: "#f8f9f4" }}>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Program</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Sem</th>
                    <th style={{ ...TH.sub, borderLeft: "1px solid #e8ead4", position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Code</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Name</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Type</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Credits</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Category</th>
                    <th style={{ ...TH.sub, borderLeft: "1px solid #e8ead4", position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Type</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Group</th>
                    <th style={{ ...TH.sub, borderLeft: "1px solid #e8ead4", position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Max</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Min</th>
                    <th style={{ ...TH.sub, borderLeft: "1px solid #e8ead4", position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Max</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Min</th>
                    <th style={{ ...TH.sub, borderLeft: "1px solid #e8ead4", position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>No</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, zIndex: 3, background: "#f8f9f4" }}>Date</th>
                    <th style={{ ...TH.sub, position: "sticky", top: 29, right: 0, zIndex: 4, background: "#f8f9f4", boxShadow: "-2px 0 4px rgba(0,0,0,0.06)" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const catStyle = CATEGORY_STYLE[c.category] || { bg: "#f3f4f6", text: "#374151" };
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f4f5f0", background: i % 2 === 0 ? "#fff" : "#fafbf7" }}>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ background: "#e8ead4", color: "#2d3a0e", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                            {c.academic_programs?.program_code || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 600 }}>{c.semester}</td>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{c.course_code}</td>
                        <td style={{ padding: "9px 12px", minWidth: 200 }}>
                          {c.course_name}
                          {c.is_bridge && <span style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>Bridge</span>}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          {(() => {
                            const st = COURSE_TYPE_STYLE[c.course_type] || { bg: "#f3f4f6", text: "#374151" };
                            return (
                              <span style={{ background: st.bg, color: st.text, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                                {COURSE_TYPE_LABEL[c.course_type] || c.course_type || "—"}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>{c.credits ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ background: catStyle.bg, color: catStyle.text, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {CATEGORY_LABEL[c.category] || c.category}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12 }}>
                          {c.category === "ELECTIVE_DEFAULT" ? (
                            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Open</span>
                          ) : c.category === "SPECIALISATION_ELECTIVE" ? (
                            <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Group</span>
                          ) : c.is_bridge ? (
                            <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>—</span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 12 }}>
                          {(() => {
                            const groups = groupSubjectMap[c.course_code] || [];
                            if (groups.length > 0) {
                              return (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  {groups.map((g, i) => {
                                    const grp = specGroups.find(sg => sg.name === (g.name || g) || sg.group_code === (g.code || g));
                                    return <GroupBadge key={i} code={g.code || g} name={g.name || g} onClick={() => grp && setFilterSpecGroup(String(grp.id))} />;
                                  })}
                                </div>
                              );
                            }
                            // Fall back to direct FK group
                            if (c.specialisation_groups?.group_code || c.specialisation_groups?.name) {
                              const grp = specGroups.find(sg => sg.id === c.specialisation_group_id);
                              return <GroupBadge code={c.specialisation_groups.group_code || c.specialisation_groups.name} name={c.specialisation_groups.name} onClick={() => grp && setFilterSpecGroup(String(grp.id))} />;
                            }
                            return <span style={{ color: "#9ca3af" }}>—</span>;
                          })()}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>{c.ia_max ?? 30}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>{c.ia_min ?? 15}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>{c.ese_max ?? 70}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>{c.ese_min ?? 35}</td>
                        <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: "#2d3a0e", whiteSpace: "nowrap" }}>{activeAR.ar_number}</td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: "#c8a84b", fontWeight: 600, whiteSpace: "nowrap" }}>{activeAR.ar_date || "—"}</td>
                        <td style={{ padding: "9px 12px", position: "sticky", right: 0, background: i % 2 === 0 ? "#fff" : "#fafbf7", zIndex: 1, boxShadow: "-2px 0 4px rgba(0,0,0,0.06)" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => setCourseModal(c)}
                              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}
                            >✏️</button>
                            <button
                              onClick={() => handleDeleteCourse(c.id)}
                              style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "#dc2626" }}
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateARModal
          existingARs={ars}
          programs={programs}
          specGroups={specGroups}
          onSave={() => { setShowCreate(false); loadARs(); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {courseModal && (
        <CourseModal
          course={courseModal._new ? null : courseModal}
          arId={activeAR?.ar_number}
          programs={programs}
          specGroups={specGroups}
          onSave={() => { setCourseModal(null); loadCourses(); }}
          onClose={() => setCourseModal(null)}
        />
      )}
    </div>
  );
}

const TH = {
  group: {
    padding: "6px 12px",
    textAlign: "center",
    color: "#2d3a0e",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e8ead4",
    whiteSpace: "nowrap",
  },
  sub: {
    padding: "8px 12px",
    textAlign: "left",
    color: "#3d4f12",
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "2px solid #e8ead4",
    whiteSpace: "nowrap",
  },
};

const S = {
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:     { background: "#fff", borderRadius: 14, padding: 28, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%" },
  closeBtn:  { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" },
  input:     { width: "100%", padding: "9px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  fg:        { display: "flex", flexDirection: "column", gap: 4 },
  label:     { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" },
  primaryBtn:{ background: "#3d4f12", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" },
  outlineBtn:{ background: "#fff", color: "#374151", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  errorBox:  { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "8px 14px", fontSize: 13, marginBottom: 12 },
  filterSel: { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 130 },
};
