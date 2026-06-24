import { useState } from 'react';

const DEPARTMENTS = ['All','Management','Computer Science','Commerce','General'];

const MOCK_FACULTIES = [
  { id: 1, name: 'Dr. Ramesh Kumar',    department: 'Management',       subjects: ['Strategic Management','Business Ethics'], designation: 'Professor', email: 'ramesh.k@srmus.edu.in', mobile: '9876543210', status: 'ACTIVE' },
  { id: 2, name: 'Dr. Priya Sharma',    department: 'Computer Science', subjects: ['Data Structures','Machine Learning'],    designation: 'Associate Professor', email: 'priya.s@srmus.edu.in', mobile: '9876543211', status: 'ACTIVE' },
  { id: 3, name: 'Dr. Suresh Babu',     department: 'Management',       subjects: ['Financial Management','Accounting'],     designation: 'Assistant Professor', email: 'suresh.b@srmus.edu.in', mobile: '9876543212', status: 'ACTIVE' },
  { id: 4, name: 'Dr. Anitha Reddy',    department: 'Computer Science', subjects: ['Web Technology','Cloud Computing'],      designation: 'Professor', email: 'anitha.r@srmus.edu.in', mobile: '9876543213', status: 'ACTIVE' },
  { id: 5, name: 'Prof. Karthik M',     department: 'Commerce',         subjects: ['Business Law','Marketing'],              designation: 'Assistant Professor', email: 'karthik.m@srmus.edu.in', mobile: '9876543214', status: 'ACTIVE' },
  { id: 6, name: 'Dr. Meena Iyer',      department: 'General',          subjects: ['Business English','Communication'],      designation: 'Associate Professor', email: 'meena.i@srmus.edu.in', mobile: '9876543215', status: 'INACTIVE' },
];

function FacultyCard({ faculty }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: '#1D4ED8', flexShrink: 0,
        }}>
          {faculty.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{faculty.name}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{faculty.designation} · {faculty.department}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {faculty.subjects.map(s => (
              <span key={s} style={{ background: '#F0F9FF', color: '#0369A1', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{s}</span>
            ))}
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          background: faculty.status === 'ACTIVE' ? '#DCFCE7' : '#F3F4F6',
          color: faculty.status === 'ACTIVE' ? '#166534' : '#6B7280',
        }}>{faculty.status}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280' }}>
        <span>✉ {faculty.email}</span>
        <span>📱 {faculty.mobile}</span>
      </div>
    </div>
  );
}

export default function Faculties() {
  const [search,      setSearch]      = useState('');
  const [department,  setDepartment]  = useState('All');
  const [showAddModal,setShowAddModal]= useState(false);

  const filtered = MOCK_FACULTIES.filter(f => {
    const matchesDept = department === 'All' || f.department === department;
    const matchesSearch = !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.subjects.some(s => s.toLowerCase().includes(search.toLowerCase()));
    return matchesDept && matchesSearch;
  });

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Faculties</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{MOCK_FACULTIES.length} faculty members</div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ background: '#1D4ED8', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
        >+ Add Faculty</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Faculty', value: MOCK_FACULTIES.length,                                color: '#6366F1' },
          { label: 'Active',        value: MOCK_FACULTIES.filter(f => f.status === 'ACTIVE').length,   color: '#10B981' },
          { label: 'Departments',   value: DEPARTMENTS.length - 1,                               color: '#0EA5E9' },
          { label: 'Subjects',      value: [...new Set(MOCK_FACULTIES.flatMap(f => f.subjects))].length, color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="🔍 Search faculty or subject…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', width: 280 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {DEPARTMENTS.map(d => (
            <button
              key={d}
              onClick={() => setDepartment(d)}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: department === d ? '#1D4ED8' : '#fff',
                color: department === d ? '#fff' : '#374151',
                borderColor: department === d ? '#1D4ED8' : '#D1D5DB',
              }}
            >{d}</button>
          ))}
        </div>
      </div>

      {/* Faculty Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {filtered.map(f => <FacultyCard key={f.id} faculty={f} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
            No faculty found
          </div>
        )}
      </div>

      {/* Add Faculty Modal placeholder */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Add Faculty</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>
            {[
              { label: 'Full Name',    placeholder: 'Dr. Firstname Lastname' },
              { label: 'Designation', placeholder: 'Professor / Associate / Assistant' },
              { label: 'Department',  placeholder: 'Management / Computer Science…' },
              { label: 'Email',       placeholder: 'faculty@srmus.edu.in' },
              { label: 'Mobile',      placeholder: '10-digit mobile number' },
              { label: 'Subjects',    placeholder: 'Comma-separated subjects' },
            ].map(({ label, placeholder }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowAddModal(false)} style={{ background: '#fff', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button style={{ background: '#1D4ED8', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save Faculty</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
