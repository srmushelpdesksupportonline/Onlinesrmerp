import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PROGRAMS = ['MBA','MCA','BBA','BCA'];

// Display order within a semester: bridge → core → elective-default → (by code)
const CATEGORY_RANK = { BRIDGE: 0, CORE: 1, ELECTIVE_DEFAULT: 2, SPECIALISATION_ELECTIVE: 3 };
const TYPE_LABEL = { Th: 'Theory', OP: 'Online Practical', P: 'Project', I: 'Internship' };

function SubjectCard({ course, index, registered }) {
  const isElective = course.category === 'ELECTIVE_DEFAULT';
  const isBridge   = course.is_bridge;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      border: `1px solid ${registered ? '#BBF7D0' : '#E5E7EB'}`,
      borderRadius: 8, marginBottom: 8,
      background: registered ? '#F0FDF4' : '#fff',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: registered ? '#16A34A' : '#E5E7EB',
        color: registered ? '#fff' : '#6B7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>{index + 1}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{course.course_name}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace' }}>{course.course_code}</span>
          <span>·</span>
          <span>{TYPE_LABEL[course.course_type] || course.course_type}</span>
          <span>·</span>
          <span>{course.credits == null ? 'NA credits' : `${course.credits} credit${course.credits === 1 ? '' : 's'}`}</span>
          {isBridge && (
            <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#92400E' }}>Bridge</span>
          )}
          {isElective && (
            <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#5B21B6' }}>Elective (default)</span>
          )}
        </div>
        {isElective && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            Default option — or a course from the selected specialisation group.
          </div>
        )}
      </div>

      <span style={{
        padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
        background: registered ? '#DCFCE7' : '#F3F4F6',
        color: registered ? '#166534' : '#9CA3AF', flexShrink: 0,
      }}>
        {registered ? 'Registered' : 'Pending'}
      </span>
    </div>
  );
}

export default function Academics() {
  const [students,        setStudents]        = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [program,         setProgram]         = useState('MBA');
  const [semester,        setSemester]        = useState(1);
  const [searchText,      setSearchText]      = useState('');
  const [loading,         setLoading]         = useState(false);

  // Live curriculum (replaces the old hardcoded SUBJECTS / SEMESTERS)
  const [totalSemesters,  setTotalSemesters]  = useState(4);
  const [coursesBySem,    setCoursesBySem]    = useState({});   // { [sem]: Course[] }
  const [curriculumError, setCurriculumError] = useState(null);

  useEffect(() => {
    loadStudents();
    loadCurriculum();
  }, [program]);

  async function loadStudents() {
    setLoading(true);
    const { data } = await supabase
      .from('student_master')
      .select('id, enrollment_no, full_name, program_name, specialization, current_semester, student_status')
      .ilike('program_name', `%${program}%`)
      .order('enrollment_no');
    setStudents(data || []);
    setLoading(false);
  }

  // Pull the active scheme + its courses for the selected program from the academic schema.
  async function loadCurriculum() {
    setCurriculumError(null);
    setCoursesBySem({});

    const { data: prog, error: progErr } = await supabase
      .from('academic_programs')
      .select('id, total_semesters')
      .eq('program_code', program)
      .maybeSingle();

    if (progErr || !prog) {
      setCurriculumError('Program not found in academic schema.');
      setTotalSemesters(4);
      return;
    }
    setTotalSemesters(prog.total_semesters || 4);

    const { data: scheme, error: schemeErr } = await supabase
      .from('academic_schemes')
      .select('id')
      .eq('program_id', prog.id)
      .eq('is_active', true)
      .order('scheme_year', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schemeErr || !scheme) {
      setCurriculumError('No active scheme found for this program.');
      return;
    }

    // Courses a student takes by default: core, bridge, and the default elective per slot.
    // (Specialisation-elective selection comes with student registration — Part B.)
    const { data: courses, error: coursesErr } = await supabase
      .from('courses')
      .select('course_code, course_name, course_type, credits, semester, category, is_bridge')
      .eq('scheme_id', scheme.id)
      .in('category', ['CORE', 'BRIDGE', 'ELECTIVE_DEFAULT']);

    if (coursesErr) {
      setCurriculumError('Failed to load courses.');
      return;
    }

    const grouped = {};
    (courses || []).forEach(c => {
      (grouped[c.semester] ||= []).push(c);
    });
    Object.values(grouped).forEach(list =>
      list.sort((a, b) =>
        (CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category]) ||
        a.course_code.localeCompare(b.course_code)
      )
    );
    setCoursesBySem(grouped);
  }

  const subjects = coursesBySem[semester] || [];
  const semCredits = subjects.reduce((sum, c) => sum + (c.credits || 0), 0);

  const filteredStudents = students.filter(s =>
    !searchText ||
    s.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.enrollment_no?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Academics</h2>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Semester-wise subject registration per student</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 160px)' }}>

        {/* Left — Student List */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {PROGRAMS.map(p => (
                <button
                  key={p}
                  onClick={() => { setProgram(p); setSelectedStudent(null); setSemester(1); }}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: program === p ? '#1D4ED8' : '#F3F4F6',
                    color: program === p ? '#fff' : '#374151',
                  }}
                >{p}</button>
              ))}
            </div>
            <input
              placeholder="🔍 Search student…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No students found</div>
            ) : filteredStudents.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedStudent(s); setSemester(s.current_semester || 1); }}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                  background: selectedStudent?.id === s.id ? '#EFF6FF' : '',
                  borderLeft: selectedStudent?.id === s.id ? '3px solid #1D4ED8' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{s.full_name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {s.enrollment_no} · Sem {s.current_semester || 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Subject Registration */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedStudent ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 12, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48 }}>📚</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a student to view subjects</div>
              <div style={{ fontSize: 13 }}>Choose from the list on the left</div>
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedStudent.full_name}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                      {selectedStudent.enrollment_no} · {selectedStudent.program_name} · {selectedStudent.specialization}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {Array.from({ length: totalSemesters || 4 }, (_, i) => i + 1).map(s => (
                      <button
                        key={s}
                        onClick={() => setSemester(s)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          fontWeight: 700, fontSize: 13,
                          background: semester === s ? '#1D4ED8' : s <= (selectedStudent.current_semester || 1) ? '#DBEAFE' : '#F3F4F6',
                          color: semester === s ? '#fff' : s <= (selectedStudent.current_semester || 1) ? '#1E40AF' : '#9CA3AF',
                        }}
                      >S{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Semester {semester} — Subjects</div>
                  <div style={{ fontSize: 13, color: '#6B7280' }}>
                    {subjects.length} subjects{semCredits ? ` · ${semCredits} credits` : ''}
                  </div>
                </div>

                {curriculumError ? (
                  <div style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 14, fontSize: 13 }}>
                    {curriculumError}
                  </div>
                ) : subjects.length === 0 ? (
                  <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40, fontSize: 13 }}>No subjects defined for this semester.</div>
                ) : subjects.map((course, i) => (
                  <SubjectCard
                    key={course.course_code}
                    course={course}
                    index={i}
                    registered={semester < (selectedStudent.current_semester || 1)}
                  />
                ))}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ background: '#fff', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Download Timetable</button>
                <button style={{ background: '#1D4ED8', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Register All Subjects</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
