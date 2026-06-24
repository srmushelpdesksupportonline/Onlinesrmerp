import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../supabaseClient";
import {
  getPrograms,
  getSpecialisationGroups,
  getSubjects,
  upsertSubject,
  deleteSubject,
  upsertSpecialisationGroup,
  deleteSpecialisationGroup,
} from "../../services/academicService";

const COURSE_TYPES = ["Th", "OP", "P"];
const EMPTY_SUBJECT = {
  id: null,
  program_id: "",
  semester_no: "",
  course_code: "",
  course_name: "",
  course_type: "Th",
  credits: "",
  is_elective: false,
  specialisation_group_id: "",
  is_bridge: false,
};

const SEED_DATA = {
  MBA: [
    { semester_no:1, course_code:"EMBA24C101", course_name:"Managerial Economics", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMBA24C102", course_name:"Financial Accounting", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMBA24C103", course_name:"Marketing Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMBA24C104", course_name:"Production and Operations Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMBA24C105", course_name:"Communication Skills for Managers", course_type:"Th", credits:2, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMBA24C201", course_name:"Legal Aspects of Business", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMBA24C202", course_name:"Business Analytics", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMBA24C203", course_name:"Human Resource Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMBA24C204", course_name:"Financial Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMBA24C205", course_name:"Business Statistics and Quantitative Methods", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMBA24C301", course_name:"Research Methodology in Business", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMBA24C302", course_name:"Strategic Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMBA24C303", course_name:"Consumer Behaviour", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EMBA24C401", course_name:"Entrepreneurship and Design Thinking", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EMBA24C402", course_name:"Financial Institutions and Markets", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EMBA24P405", course_name:"Project", course_type:"P", credits:6, is_elective:false, is_bridge:false },
  ],
  MCA: [
    { semester_no:1, course_code:"EMCA24B101", course_name:"Basic Mathematics (Bridge Course)", course_type:"Th", credits:null, is_elective:false, is_bridge:true },
    { semester_no:1, course_code:"EMCA24B102", course_name:"Fundamentals of Computer (Bridge Course)", course_type:"Th", credits:null, is_elective:false, is_bridge:true },
    { semester_no:1, course_code:"EMCA24C101", course_name:"Programming in Java", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMCA24C102", course_name:"Operating System", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMCA24C103", course_name:"Database Technology", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMCA24C104", course_name:"Computer Networks", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMCA24L105", course_name:"Programming in Java - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EMCA24L106", course_name:"Operating System and Database Technology - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24C201", course_name:"Python Programming", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24C202", course_name:"Advanced Data Structure and Algorithms", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24C203", course_name:"Advanced Web Application Development", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24C204", course_name:"Optimization Techniques", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24L205", course_name:"Advanced Data Structure and Algorithms - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EMCA24L206", course_name:"Advanced Web Application Development - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMCA24C301", course_name:"Artificial Intelligence and Machine Learning", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMCA24C302", course_name:"IT Infrastructure Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EMCA24P305", course_name:"Mini Project", course_type:"P", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EMCA24P401", course_name:"Project Work", course_type:"P", credits:12, is_elective:false, is_bridge:false },
  ],
  BBA: [
    { semester_no:1, course_code:"EBBA25C101", course_name:"Communicative English", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBBA25C102", course_name:"Principles of Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBBA25C103", course_name:"Financial Accounting", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBBA25C104", course_name:"Business Economics", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBBA25C105", course_name:"Business Mathematics", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBBA25C201", course_name:"Organisational Behaviour", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBBA25C202", course_name:"Business Statistics", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBBA25C203", course_name:"Cost Accounting", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBBA25C204", course_name:"Business Law", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBBA25C205", course_name:"Computer Applications in Business", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBBA25C301", course_name:"Operations Research in Business", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBBA25C302", course_name:"Financial Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBBA25C303", course_name:"Human Resource Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBBA25C304", course_name:"Marketing Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBBA25C305", course_name:"Legal Aspects of Business", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBBA25C401", course_name:"Strategic Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBBA25C402", course_name:"Basics of Consumer Behaviour", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBBA25C403", course_name:"Advertising and Sales Promotion", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBBA25C404", course_name:"Leadership and Team Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBBA25C405", course_name:"Entrepreneurship Development", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBBA25C501", course_name:"Introduction to Research Methods", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBBA25C502", course_name:"Project Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBBA25C503", course_name:"Total Quality Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBBA25C601", course_name:"Ethics and Corporate Governance in Business", course_type:"Th", credits:2, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBBA25C602", course_name:"Small Business Management", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBBA25P605", course_name:"Project", course_type:"P", credits:6, is_elective:false, is_bridge:false },
  ],
  BCA: [
    { semester_no:1, course_code:"EBCA25C101", course_name:"Professional Communication", course_type:"Th", credits:2, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBCA25C102", course_name:"Introduction to Data Science", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBCA25C103", course_name:"Programming for Problem Solving", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBCA25C104", course_name:"Computer Fundamentals", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBCA25C105", course_name:"Discrete Mathematical Structures", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:1, course_code:"EBCA25C106", course_name:"Environmental Science", course_type:"Th", credits:2, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25C201", course_name:"Programming in Java", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25C202", course_name:"Data Structures and Algorithms", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25C203", course_name:"Database Systems", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25C204", course_name:"Operating System Concepts", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25C205", course_name:"Introduction to Cloud Computing", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25L206", course_name:"Data Structures and DBMS - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:2, course_code:"EBCA25L207", course_name:"Programming in Java - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25C301", course_name:"Python Programming", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25C302", course_name:"Exploratory Data Analysis", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25C303", course_name:"Introduction to Artificial Intelligence", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25C304", course_name:"Statistics with R", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25L305", course_name:"Exploratory Data Analysis - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:3, course_code:"EBCA25L306", course_name:"Python Programming - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25C401", course_name:"Programming for Analysis", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25C402", course_name:"Data Visualization", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25C403", course_name:"Machine Learning", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25C404", course_name:"Data Pre-processing Techniques", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25C405", course_name:"Data Mining and Warehousing", course_type:"Th", credits:3, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25L406", course_name:"Programming for Analysis - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:4, course_code:"EBCA25L407", course_name:"Data Visualization - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBCA25C501", course_name:"Web Technologies", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBCA25C502", course_name:"Data Communication and Networks", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBCA25L505", course_name:"Web Technologies - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:5, course_code:"EBCA25L506", course_name:"Data Communication and Networks - Online Practical", course_type:"OP", credits:2, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBCA25C601", course_name:"Innovation and Entrepreneurship", course_type:"Th", credits:2, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBCA25C602", course_name:"Software Engineering", course_type:"Th", credits:4, is_elective:false, is_bridge:false },
    { semester_no:6, course_code:"EBCA25P605", course_name:"Project Work", course_type:"P", credits:6, is_elective:false, is_bridge:false },
  ],
};

function SubjectModal({ subject, programs, specGroups, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_SUBJECT, ...subject });
  const [saving, setSaving] = useState(false);

  const filteredGroups = specGroups.filter(
    (g) => !form.program_id || g.program_id === Number(form.program_id)
  );

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.program_id || !form.semester_no || !form.course_code || !form.course_name) {
      alert("Program, Semester, Course Code and Course Name are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        program_id: Number(form.program_id),
        semester_no: Number(form.semester_no),
        credits: form.credits === "" ? null : Number(form.credits),
        specialisation_group_id: form.specialisation_group_id === "" ? null : Number(form.specialisation_group_id),
      };
      if (!payload.id) delete payload.id;
      await upsertSubject(payload);
      onSave();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <h2 style={{ margin: "0 0 16px" }}>{form.id ? "Edit Subject" : "Add Subject"}</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Program *</label>
            <select value={form.program_id} onChange={(e) => set("program_id", e.target.value)}>
              <option value="">Select program</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Semester *</label>
            <select value={form.semester_no} onChange={(e) => set("semester_no", e.target.value)}>
              <option value="">Select</option>
              {[1,2,3,4,5,6].map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Course Code *</label>
            <input value={form.course_code} onChange={(e) => set("course_code", e.target.value)} placeholder="e.g. EMBA24C101" />
          </div>
          <div className="form-group">
            <label>Course Type *</label>
            <select value={form.course_type} onChange={(e) => set("course_type", e.target.value)}>
              {COURSE_TYPES.map((t) => <option key={t} value={t}>{t === "Th" ? "Th — Theory" : t === "OP" ? "OP — Online Practical" : "P — Project/Internship"}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row single">
          <div className="form-group">
            <label>Course Name *</label>
            <input value={form.course_name} onChange={(e) => set("course_name", e.target.value)} placeholder="e.g. Managerial Economics" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Credits</label>
            <input type="number" value={form.credits} onChange={(e) => set("credits", e.target.value)} placeholder="e.g. 4 (blank for bridge)" />
          </div>
          <div className="form-group">
            <label>Specialisation Group</label>
            <select value={form.specialisation_group_id} onChange={(e) => set("specialisation_group_id", e.target.value)}>
              <option value="">None</option>
              {filteredGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="elective" checked={form.is_elective} onChange={(e) => set("is_elective", e.target.checked)} style={{ width: "auto" }} />
            <label htmlFor="elective" style={{ margin: 0 }}>Elective subject</label>
          </div>
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="bridge" checked={form.is_bridge} onChange={(e) => set("is_bridge", e.target.checked)} style={{ width: "auto" }} />
            <label htmlFor="bridge" style={{ margin: 0 }}>Bridge course (no credit)</label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Subject"}</button>
        </div>
      </div>
    </div>
  );
}

function SpecGroupModal({ group, programs, onSave, onClose }) {
  const [form, setForm] = useState({ id: null, program_id: "", name: "", ...group });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.program_id || !form.name) { alert("Program and name required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, program_id: Number(form.program_id) };
      if (!payload.id) delete payload.id;
      await upsertSpecialisationGroup(payload);
      onSave();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <h2 style={{ margin: "0 0 16px" }}>{form.id ? "Edit" : "Add"} Specialisation Group</h2>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Program *</label>
          <select value={form.program_id} onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}>
            <option value="">Select</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Group Name *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Finance" />
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function GroupMappingModal({ group, allSubjects, groupSubjectMap, onSave, onClose }) {
  const currentIds = groupSubjectMap[group.id] || [];
  const [selected, setSelected] = useState(new Set(currentIds));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Remove all existing mappings for this group
      await supabase
        .from('specialisation_group_subjects')
        .delete()
        .eq('group_id', group.id);

      // Insert new mappings
      if (selected.size > 0) {
        const rows = Array.from(selected).map(subject_id => ({
          group_id: group.id,
          subject_id,
        }));
        const { error } = await supabase
          .from('specialisation_group_subjects')
          .insert(rows);
        if (error) throw error;
      }
      onSave();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = allSubjects.filter(s =>
    !search ||
    s.course_name.toLowerCase().includes(search.toLowerCase()) ||
    s.course_code.toLowerCase().includes(search.toLowerCase())
  );

  // Group by semester
  const bySem = {};
  filtered.forEach(s => {
    if (!bySem[s.semester_no]) bySem[s.semester_no] = [];
    bySem[s.semester_no].push(s);
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 580, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Manage Subjects — {group.name}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
          Select which subjects belong to this specialisation group. These will appear as elective options for students.
        </p>
        <input
          placeholder="Search subjects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, outline: "none" }}
        />
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e8ead4", borderRadius: 8 }}>
          {Object.entries(bySem).sort(([a],[b]) => Number(a)-Number(b)).map(([sem, subs]) => (
            <div key={sem}>
              <div style={{ padding: "6px 12px", background: "#f8f9f4", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8ead4" }}>
                Semester {sem}
              </div>
              {subs.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    cursor: "pointer", borderBottom: "1px solid #f4f5f0",
                    background: selected.has(s.id) ? "#f0fdf4" : "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    style={{ accentColor: "#3d4f12", width: 15, height: 15, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  />
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{s.course_code}</span>
                  <span style={{ fontSize: 13, color: selected.has(s.id) ? "#065f46" : "#374151", fontWeight: selected.has(s.id) ? 600 : 400 }}>{s.course_name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{s.credits ?? "—"} cr</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{selected.size} subject{selected.size !== 1 ? "s" : ""} selected</span>
          <div className="modal-actions" style={{ margin: 0 }}>
            <button className="secondary" onClick={onClose}>Cancel</button>
            <button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Mapping"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcademicsSchemes() {
  const [programs, setPrograms]         = useState([]);
  const [specGroups, setSpecGroups]     = useState([]);
  const [subjects, setSubjects]         = useState([]);
  const [activeProg, setActiveProg]     = useState(null);
  const [openSems, setOpenSems]         = useState({});
  const [subjectModal, setSubjectModal] = useState(null);
  const [groupModal, setGroupModal]     = useState(null);
  const [seeding, setSeeding]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [groupSubjectMap, setGroupSubjectMap] = useState({}); // { group_id: [subject_id, ...] }
  const [groupMappingModal, setGroupMappingModal] = useState(null); // group being edited

  async function load() {
    setLoading(true);
    try {
      const [p, g, s] = await Promise.all([getPrograms(), getSpecialisationGroups(), getSubjects()]);
      setPrograms(p);
      setSpecGroups(g);
      setSubjects(s);
      if (!activeProg && p.length) setActiveProg(p[0]);

      // Fetch group-subject mappings
      const { data: mappings } = await supabase
        .from('specialisation_group_subjects')
        .select('group_id, subject_id');
      const map = {};
      for (const m of mappings || []) {
        if (!map[m.group_id]) map[m.group_id] = [];
        map[m.group_id].push(m.subject_id);
      }
      setGroupSubjectMap(map);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSeedProgram() {
    if (!activeProg) return;
    const code = activeProg.code;
    const rows = SEED_DATA[code];
    if (!rows) { alert("No seed data for " + code); return; }
    if (!window.confirm(`This will seed ${rows.length} subjects for ${code}. Existing subjects with the same course code will be skipped. Continue?`)) return;
    setSeeding(true);
    try {
      for (const row of rows) {
        try {
          await upsertSubject({ ...row, program_id: activeProg.id });
        } catch (e) {
          // skip duplicate
        }
      }
      await load();
      alert("Seed complete.");
    } catch (e) {
      alert(e.message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleDeleteSubject(id) {
    if (!window.confirm("Delete this subject?")) return;
    try {
      await deleteSubject(id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeleteGroup(id) {
    if (!window.confirm("Delete this specialisation group? All linked subjects will lose their group.")) return;
    try {
      await deleteSpecialisationGroup(id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  function toggleSem(n) {
    setOpenSems((s) => ({ ...s, [n]: !s[n] }));
  }

  const progSubjects = subjects.filter((s) => s.program_id === activeProg?.id);
  const semNumbers = [...new Set(progSubjects.map((s) => s.semester_no))].sort((a, b) => a - b);
  const progGroups = specGroups.filter((g) => g.program_id === activeProg?.id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0 }}>Scheme Management</h1>
          <p className="muted">Manage programs, semesters, subjects and specialisation groups.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => setGroupModal({})}>+ Specialisation Group</button>
          <button className="secondary" onClick={handleSeedProgram} disabled={seeding || !activeProg}>
            {seeding ? "Seeding…" : `Seed ${activeProg?.code || ""} Subjects`}
          </button>
          <button onClick={() => setSubjectModal({})}>+ Add Subject</button>
        </div>
      </div>

      {/* Program tabs */}
      <div className="program-tabs">
        {programs.map((p) => (
          <button
            key={p.id}
            className={"program-tab" + (activeProg?.id === p.id ? " active" : "")}
            onClick={() => setActiveProg(p)}
          >
            {p.code}
            <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({p.semesters} sem · {p.total_credits} cr)</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {/* Specialisation groups for this program */}
          {progGroups.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <strong style={{ fontSize: 14 }}>Specialisation Groups — {activeProg?.code}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {progGroups.map((g) => {
                  const mappedIds = groupSubjectMap[g.id] || [];
                  const mappedSubjects = subjects.filter(s => mappedIds.includes(s.id));
                  return (
                    <div key={g.id} style={{ border: "1px solid #e8ead4", borderRadius: 8, padding: 12, background: "#fafbf7" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#2d3a0e" }}>{g.name}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn-icon" onClick={() => setGroupMappingModal(g)} style={{ padding: "2px 8px", fontSize: 11 }}>Manage Subjects</button>
                          <button className="btn-icon" onClick={() => setGroupModal(g)} style={{ padding: "2px 6px" }}>✏️</button>
                          <button className="btn-icon danger" onClick={() => handleDeleteGroup(g.id)} style={{ padding: "2px 6px" }}>✕</button>
                        </div>
                      </div>
                      {mappedSubjects.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>No subjects mapped yet</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {mappedSubjects.map(s => (
                            <div key={s.id} style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{s.course_code}</span>
                              <span>{s.course_name}</span>
                              <span style={{ marginLeft: "auto", background: "#e8ead4", color: "#2d3a0e", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>Sem {s.semester_no}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Semester accordions */}
          {semNumbers.length === 0 ? (
            <div className="empty-state">
              <p>No subjects yet for {activeProg?.code}.</p>
              <p>Click <strong>Seed {activeProg?.code} Subjects</strong> to populate from the official scheme, or add manually.</p>
            </div>
          ) : (
            semNumbers.map((sem) => {
              const semSubjects = progSubjects.filter((s) => s.semester_no === sem);
              const totalCredits = semSubjects.reduce((s, x) => s + (x.credits || 0), 0);
              const isOpen = openSems[sem] !== false; // default open
              return (
                <div key={sem} className="sem-block">
                  <div className="sem-header" onClick={() => toggleSem(sem)}>
                    <span>Semester {sem} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({semSubjects.length} subjects · {totalCredits} credits)</span></span>
                    <span>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div className="sem-body">
                      <table>
                        <thead>
                          <tr>
                            <th>Course Code</th>
                            <th>Course Name</th>
                            <th>Type</th>
                            <th>Credits</th>
                            <th>Elective</th>
                            <th>Specialisation Group</th>
                            <th>Bridge</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {semSubjects.map((s) => (
                            <tr key={s.id}>
                              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.course_code}</td>
                              <td>{s.course_name}</td>
                              <td>
                                <span className="badge">{s.course_type}</span>
                              </td>
                              <td>{s.credits ?? <span className="muted">—</span>}</td>
                              <td>{s.is_elective ? "✓" : ""}</td>
                              <td>
                                {(() => {
                                  const groups = progGroups.filter(g => (groupSubjectMap[g.id] || []).includes(s.id));
                                  return groups.length > 0
                                    ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {groups.map(g => (
                                          <span key={g.id} style={{ background: "#e8ead4", color: "#2d3a0e", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{g.name}</span>
                                        ))}
                                      </div>
                                    : <span className="muted">—</span>;
                                })()}
                              </td>
                              <td>{s.is_bridge ? <span className="badge">Bridge</span> : ""}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="btn-icon" onClick={() => setSubjectModal(s)}>✏️</button>
                                  <button className="btn-icon danger" onClick={() => handleDeleteSubject(s.id)}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {groupMappingModal && (
        <GroupMappingModal
          group={groupMappingModal}
          allSubjects={progSubjects}
          groupSubjectMap={groupSubjectMap}
          onSave={() => { setGroupMappingModal(null); load(); }}
          onClose={() => setGroupMappingModal(null)}
        />
      )}
      {subjectModal !== null && (
        <SubjectModal
          subject={subjectModal}
          programs={programs}
          specGroups={specGroups}
          onSave={() => { setSubjectModal(null); load(); }}
          onClose={() => setSubjectModal(null)}
        />
      )}
      {groupModal !== null && (
        <SpecGroupModal
          group={groupModal}
          programs={programs}
          onSave={() => { setGroupModal(null); load(); }}
          onClose={() => setGroupModal(null)}
        />
      )}
    </div>
  );
}
