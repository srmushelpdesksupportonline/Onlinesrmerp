import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";

const PROGRAMS   = ["MBA","MCA","BBA","BCA"];
const CATEGORIES = ["CORE","ELECTIVE_DEFAULT","SPECIALISATION_ELECTIVE","BRIDGE"];
const COURSE_TYPES = ["Th","OP","P","I"];
const SPEC_TYPES = ["Group","Open","Open Group"];

const CATEGORY_LABEL = {
  CORE:                    "Core",
  ELECTIVE_DEFAULT:        "Elective (Default)",
  SPECIALISATION_ELECTIVE: "Specialisation Elective",
  BRIDGE:                  "Bridge",
};

const CATEGORY_STYLE = {
  CORE:                    { bg: "#dbeafe", text: "#1e40af" },
  ELECTIVE_DEFAULT:        { bg: "#ede9fe", text: "#5b21b6" },
  SPECIALISATION_ELECTIVE: { bg: "#fef3c7", text: "#92400e" },
  BRIDGE:                  { bg: "#f3f4f6", text: "#6b7280" },
};

// ── Course Modal (Add / Edit) ─────────────────────────────────────────────────
function CourseModal({ course, arId, programs, specGroups, onSave, onClose }) {
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
function CreateARModal({ existingARs, programs, onSave, onClose }) {
  const lastAR   = existingARs[0];
  const nextNum  = String(existingARs.length + 1).padStart(2, "0");
  const [form, setForm] = useState({
    ar_number:    `AR-${nextNum}`,
    ar_date:      "",
    scheme_name:  "",
    copyFromId:   lastAR?.id || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreate() {
    if (!form.ar_date || !form.scheme_name) {
      setError("AR Date and Scheme Name are required."); return;
    }
    setSaving(true); setError("");
    try {
      // Create one scheme per program (use integer programs table for academic_schemes)
      const intProgs = window._intPrograms || [];
      for (const prog of intProgs) {
        const { data: newScheme, error: se } = await supabase
          .from("academic_schemes")
          .insert({
            program_id:  prog.id,
            scheme_name: form.scheme_name,
            session:     form.ar_date.includes("JAN") ? "JAN" : "JULY",
            scheme_year: 2025,
            ar_number:   form.ar_number,
            ar_date:     form.ar_date,
            is_active:   false,
          })
          .select()
          .single();
        if (se) throw se;

        // Copy courses from previous AR for this program
        if (form.copyFromId) {
          const { data: sourceCourses } = await supabase
            .from("courses")
            .select("*")
            .eq("scheme_id", form.copyFromId)
            .eq("program_id", prog.id);

          if (sourceCourses && sourceCourses.length > 0) {
            const copies = sourceCourses.map(({ id, created_at, ...rest }) => ({
              ...rest,
              scheme_id: newScheme.id,
            }));
            const { error: ce } = await supabase.from("courses").insert(copies);
            if (ce) throw ce;
          }
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
      <div style={{ ...S.modal, maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Create New Academic Regulation</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        <div style={{ background: "#f0f2e8", border: "1px solid #e8ead4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#374151" }}>
          All courses from <strong>{lastAR?.ar_number || "AR-01"}</strong> will be copied to the new AR as a starting point. You can edit, delete or add courses after creation.
        </div>

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
        <div style={{ ...S.fg, marginBottom: 12 }}>
          <label style={S.label}>Scheme Name * <span style={{ fontWeight: 400, color: "#9ca3af" }}>(e.g. July 2025)</span></label>
          <input value={form.scheme_name} onChange={e => set("scheme_name", e.target.value)} style={S.input} placeholder="July 2025" />
        </div>
        <div style={{ ...S.fg, marginBottom: 16 }}>
          <label style={S.label}>Copy courses from</label>
          <select value={form.copyFromId} onChange={e => set("copyFromId", e.target.value)} style={S.input}>
            <option value="">Start blank</option>
            {existingARs.map(a => <option key={a.id} value={a.id}>{a.ar_number} — {a.scheme_name}</option>)}
          </select>
        </div>

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
  const [groupSubjectMap, setGroupSubjectMap] = useState({}); // { course_id: [group_name, ...] }

  // Load programs + spec groups once
  useEffect(() => {
    async function init() {
      const [{ data: progs }, { data: intProgs }, { data: groups }] = await Promise.all([
        supabase.from("academic_programs").select("id, program_code, program_name, total_semesters").order("program_code"),
        supabase.from("programs").select("id, program_code, program_name, total_semesters").order("program_code"),
        supabase.from("specialisation_groups").select("id, name, program_id").order("name"),
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
      // Get all scheme IDs for this AR number
      const { data: schemes } = await supabase
        .from("academic_schemes")
        .select("id")
        .eq("ar_number", activeAR.ar_number);

      const schemeIds = (schemes || []).map(s => s.id);
      if (!schemeIds.length) { setCourses([]); return; }

      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          academic_programs(program_code, program_name),
          specialisation_groups(name)
        `)
        .in("scheme_id", schemeIds)
        .order("semester")
        .order("course_code");

      if (error) throw error;
      const courseList = data || [];
      setCourses(courseList);

      // Load group-subject mappings via course_code (bridge between subjects and courses tables)
      if (courseList.length > 0) {
        const { data: mappings } = await supabase
          .from("specialisation_group_subjects")
          .select("subjects(course_code), specialisation_groups(name)");

        // Build map: course_code -> [group_name, ...]
        const map = {};
        for (const m of mappings || []) {
          const code = m.subjects?.course_code;
          const name = m.specialisation_groups?.name;
          if (code && name) {
            if (!map[code]) map[code] = [];
            if (!map[code].includes(name)) map[code].push(name);
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
      // Check via groupSubjectMap (course_code -> group names)
      const courseGroups = groupSubjectMap[c.course_code] || [];
      // Find the selected group name
      const selectedGroup = specGroups.find(g => String(g.id) === String(filterSpecGroup));
      if (!selectedGroup || !courseGroups.includes(selectedGroup.name)) return false;
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

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f4f5f0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 24px", background: "#fff", borderBottom: "1px solid #e8ead4", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a1f0c" }}>Course Master</h2>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Academic Regulation (AR) — Course catalog per regulation version
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowCreate(true)} style={S.primaryBtn}>+ Create New AR</button>
        </div>
      </div>

      {/* ── AR Tabs ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8ead4", padding: "0 24px", display: "flex", gap: 4, flexShrink: 0 }}>
        {ars.length === 0 && (
          <div style={{ padding: "12px 0", fontSize: 13, color: "#9ca3af" }}>No Academic Regulations yet. Click "+ Create New AR" to begin.</div>
        )}
        {ars.map(ar => (
          <button
            key={ar.id}
            onClick={() => setActiveAR(ar)}
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: activeAR?.ar_number === ar.ar_number ? 700 : 500,
              color: activeAR?.ar_number === ar.ar_number ? "#2d3a0e" : "#6b7280",
              borderBottom: activeAR?.ar_number === ar.ar_number ? "2px solid #c8a84b" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {ar.ar_number}
            {ar.ar_date && <span style={{ fontSize: 11, marginLeft: 6, color: "#9ca3af", fontWeight: 400 }}>{ar.ar_date}</span>}
          </button>
        ))}
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
                    // specGroups.program_id is integer (from programs table)
                    const intProg = (window._intPrograms || []).find(p => p.program_code === filterProgram);
                    return intProg && Number(g.program_id) === Number(intProg.id);
                  })
                  .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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

          {/* ── Course Count ── */}
          <div style={{ padding: "8px 24px", background: "#f8f9f4", borderBottom: "1px solid #e8ead4", fontSize: 13, color: "#6b7280", flexShrink: 0 }}>
            Showing <strong style={{ color: "#2d3a0e" }}>{filtered.length}</strong> of <strong style={{ color: "#2d3a0e" }}>{courses.length}</strong> courses in <strong style={{ color: "#2d3a0e" }}>{activeAR.ar_number}</strong>
            {activeAR.ar_date && <span style={{ marginLeft: 8, color: "#c8a84b", fontWeight: 600 }}>· {activeAR.ar_date}</span>}
          </div>

          {/* ── Table ── */}
          <div style={{ flex: 1, padding: "16px 24px", overflowX: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
                <div style={{ fontWeight: 600 }}>No courses found</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Try changing filters or add a new course</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <thead>
                  <tr style={{ background: "#f8f9f4" }}>
                    {["Program","Sem","Course Code","Course Name","Credits","Category","Specialisation","Spec. Group","IA Max","IA Min","ESE Max","ESE Min","AR","Date",""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#3d4f12", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #e8ead4", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
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
                                  {groups.map((g, i) => (
                                    <span key={i} style={{ background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{g}</span>
                                  ))}
                                </div>
                              );
                            }
                            // Fall back to direct FK group
                            if (c.specialisation_groups?.name) {
                              return <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{c.specialisation_groups.name}</span>;
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
                        <td style={{ padding: "9px 12px" }}>
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
            )}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateARModal
          existingARs={ars}
          programs={programs}
          onSave={() => { setShowCreate(false); loadARs(); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {courseModal && (
        <CourseModal
          course={courseModal._new ? null : courseModal}
          arId={activeAR?.id}
          programs={programs}
          specGroups={specGroups}
          onSave={() => { setCourseModal(null); loadCourses(); }}
          onClose={() => setCourseModal(null)}
        />
      )}
    </div>
  );
}

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
