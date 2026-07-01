import { useState, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { supabase } from '../supabaseClient';

ModuleRegistry.registerModules([AllCommunityModule]);

const STORAGE_KEY = 'studentPageColumns_v3';
const PIN_STORAGE_KEY = 'studentPagePinnedCols_v1';

// Enrollment No, Full Name, Official Email come first as requested
const DEFAULT_COLUMNS = [
  'enrollment_no','full_name','official_email','application_no','program_name',
  'specialization','personal_email','mobile',
  'login_password','email_activation_status','student_status',
  'scholarship_type','willing_to_pay','payment_method_chosen',
];

// These 3 are pinned left by default but CAN be unpinned by the user
const DEFAULT_PINNED = ['enrollment_no', 'full_name', 'official_email'];

const SCHEMA_COLUMNS = [
  { field: 'application_no',           label: 'Application No',           group: 'ERP' },
  { field: 'enrollment_no',            label: 'Enrollment No',            group: 'ERP' },
  { field: 'full_name',                label: 'Full Name',                group: 'ERP' },
  { field: 'official_email',           label: 'Official Email',           group: 'ERP' },
  { field: 'login_password',           label: 'Login Password',           group: 'ERP' },
  { field: 'email_activation_status',  label: 'Email Status',             group: 'ERP' },
  { field: 'student_status',           label: 'Student Status',           group: 'ERP' },
  { field: 'current_semester',         label: 'Current Semester',         group: 'ERP' },
  { field: 'admission_type',           label: 'Admission Type',           group: 'ERP' },
  { field: 'admission_date',           label: 'Admission Date',           group: 'ERP' },
  { field: 'password_generated',       label: 'Password Generated',       group: 'ERP' },
  { field: 'welcome_email_sent',       label: 'Welcome Email Sent',       group: 'ERP' },
  { field: 'created_at',               label: 'Enrolled On',              group: 'ERP' },
  { field: 'nationality',              label: 'Nationality',              group: 'Basic Details' },
  { field: 'studied_from_india',       label: 'Studied From India',       group: 'Basic Details' },
  { field: 'program_name',             label: 'Program',                  group: 'Program Details' },
  { field: 'specialization',           label: 'Specialization',           group: 'Program Details' },
  { field: 'dynamic_series',           label: 'Dynamic Series',           group: 'Program Details' },
  { field: 'title',                    label: 'Title',                    group: 'Personal Details' },
  { field: 'gender',                   label: 'Gender',                   group: 'Personal Details' },
  { field: 'dob',                      label: 'Date of Birth',            group: 'Personal Details' },
  { field: 'mobile',                   label: 'Mobile',                   group: 'Personal Details' },
  { field: 'whatsapp_no',              label: 'WhatsApp No',              group: 'Personal Details' },
  { field: 'personal_email',           label: 'Personal Email',           group: 'Personal Details' },
  { field: 'alternate_email',          label: 'Alternate Email',          group: 'Personal Details' },
  { field: 'parent_title',             label: 'Parent Title',             group: 'Personal Details' },
  { field: 'parent_name',              label: 'Parent Name',              group: 'Personal Details' },
  { field: 'parent_mobile',            label: 'Parent Mobile',            group: 'Personal Details' },
  { field: 'parent_email',             label: 'Parent Email',             group: 'Personal Details' },
  { field: 'class_10_school',          label: '10th School',              group: 'Class Xth/SSC' },
  { field: 'class_10_board',           label: '10th Board',               group: 'Class Xth/SSC' },
  { field: 'class_10_year',            label: '10th Year',                group: 'Class Xth/SSC' },
  { field: 'class_10_marking_scheme',  label: '10th Marking Scheme',      group: 'Class Xth/SSC' },
  { field: 'class_10_percentage',      label: '10th Percentage/CGPA',     group: 'Class Xth/SSC' },
  { field: 'qualification_status_12',  label: 'Qual. Status for XII',     group: 'Class Xth/SSC' },
  { field: 'class_12_school',          label: '12th School',              group: 'Class XIIth/HSC' },
  { field: 'class_12_board',           label: '12th Board',               group: 'Class XIIth/HSC' },
  { field: 'class_12_stream',          label: '12th Stream',              group: 'Class XIIth/HSC' },
  { field: 'class_12_year',            label: '12th Year',                group: 'Class XIIth/HSC' },
  { field: 'class_12_marking_scheme',  label: '12th Marking Scheme',      group: 'Class XIIth/HSC' },
  { field: 'class_12_percentage',      label: '12th Percentage/CGPA',     group: 'Class XIIth/HSC' },
  { field: 'qualification_status_pg',  label: 'Qual. Status for PG',      group: 'Graduation' },
  { field: 'ug_college',               label: 'UG College/University',    group: 'Graduation' },
  { field: 'ug_degree',                label: 'UG Degree',                group: 'Graduation' },
  { field: 'ug_year',                  label: 'UG Year of Passing',       group: 'Graduation' },
  { field: 'ug_mode',                  label: 'UG Mode of Study',         group: 'Graduation' },
  { field: 'ug_marking_scheme',        label: 'UG Marking Scheme',        group: 'Graduation' },
  { field: 'ug_percentage',            label: 'UG Percentage/CGPA',       group: 'Graduation' },
  { field: 'aadhaar_no',               label: 'Aadhaar No',               group: 'Aadhaar & IDs' },
  { field: 'aadhaar_name',             label: 'Name as per Aadhaar',      group: 'Aadhaar & IDs' },
  { field: 'aadhaar_linked_mobile',    label: 'Aadhaar Linked Mobile',    group: 'Aadhaar & IDs' },
  { field: 'abc_id',                   label: 'ABC ID',                   group: 'Aadhaar & IDs' },
  { field: 'deb_id',                   label: 'DEB ID',                   group: 'Aadhaar & IDs' },
  { field: 'deb_status',               label: 'DEB Status',               group: 'Aadhaar & IDs' },
  { field: 'country',                  label: 'Country',                  group: 'Address' },
  { field: 'state',                    label: 'State',                    group: 'Address' },
  { field: 'district',                 label: 'District',                 group: 'Address' },
  { field: 'city',                     label: 'City',                     group: 'Address' },
  { field: 'address_line_1',           label: 'Address Line 1',           group: 'Address' },
  { field: 'address_line_2',           label: 'Address Line 2',           group: 'Address' },
  { field: 'pincode',                  label: 'Pincode',                  group: 'Address' },
  { field: 'permanent_country',        label: 'Perm. Country',            group: 'Address' },
  { field: 'permanent_state',          label: 'Perm. State',              group: 'Address' },
  { field: 'permanent_city',           label: 'Perm. City',               group: 'Address' },
  { field: 'permanent_pincode',        label: 'Perm. Pincode',            group: 'Address' },
  { field: 'category',                 label: 'Category',                 group: 'Additional Details' },
  { field: 'religion',                 label: 'Religion',                 group: 'Additional Details' },
  { field: 'blood_group',              label: 'Blood Group',              group: 'Additional Details' },
  { field: 'marital_status',           label: 'Marital Status',           group: 'Additional Details' },
  { field: 'pursuing_other_degree',    label: 'Pursuing Other Degree',    group: 'Additional Details' },
  { field: 'scholarship_eligible',     label: 'Scholarship Eligible',     group: 'Scholarship' },
  { field: 'scholarship_type',         label: 'Scholarship Type',         group: 'Scholarship' },
  { field: 'is_defence',               label: 'Defence Personnel',        group: 'Scholarship' },
  { field: 'is_northeast',             label: 'Northeast Region',         group: 'Scholarship' },
  { field: 'is_srm_alumni',            label: 'SRM Alumni',               group: 'Scholarship' },
  { field: 'defence_service_id',       label: 'Defence Service ID',       group: 'Scholarship' },
  { field: 'srm_institute_name',       label: 'SRM Institute Name',       group: 'Scholarship' },
  { field: 'willing_to_pay',           label: 'Willing To Pay',           group: 'Payment' },
  { field: 'payment_method_chosen',    label: 'Payment Method',           group: 'Payment' },
  { field: 'doc_application_form_url', label: 'Application Form',         group: 'Documents' },
  { field: 'doc_aadhaar_url',          label: 'Aadhaar Card',             group: 'Documents' },
  { field: 'doc_10th_marksheet_url',   label: '10th Marksheet',           group: 'Documents' },
  { field: 'doc_12th_marksheet_url',   label: '12th Marksheet',           group: 'Documents' },
  { field: 'doc_graduation_url',       label: 'Graduation Marksheet',     group: 'Documents' },
  { field: 'doc_degree_certificate_url',label: 'Degree Certificate',      group: 'Documents' },
  { field: 'doc_abc_id_url',           label: 'ABC ID Card',              group: 'Documents' },
  { field: 'doc_category_cert_url',    label: 'Category Certificate',     group: 'Documents' },
  { field: 'doc_defence_id_url',       label: 'Defence ID Card',          group: 'Documents' },
  { field: 'doc_domicile_url',         label: 'Domicile Certificate',     group: 'Documents' },
  { field: 'doc_disability_url',       label: 'Disability Certificate',   group: 'Documents' },
  { field: 'drive_folder_url',         label: 'Drive Folder',             group: 'Documents' },
];

const EXCEL_FIELDS = [
  { field: 'Token Fee Amount',          label: 'Token Fee Amount',          group: 'Payment' },
  { field: 'Token Fee Name',            label: 'Token Fee Name',            group: 'Payment' },
  { field: 'Token Fee Transcation ID',  label: 'Token Fee Transaction ID',  group: 'Payment' },
  { field: 'Token Fee Method',          label: 'Token Fee Method',          group: 'Payment' },
  { field: 'Token Fee Date',            label: 'Token Fee Date',            group: 'Payment' },
  { field: 'Token Fee Order ID',        label: 'Token Fee Order ID',        group: 'Payment' },
  { field: 'Payment Status',            label: 'Payment Status',            group: 'Payment' },
  { field: 'Payment Amount',            label: 'Payment Amount',            group: 'Payment' },
  { field: '1.-Name of Organization',             label: 'Work Exp 1 — Organisation',      group: 'Work Experience' },
  { field: '1.-Designation',                       label: 'Work Exp 1 — Designation',       group: 'Work Experience' },
  { field: '1.-Sector',                            label: 'Work Exp 1 — Sector',            group: 'Work Experience' },
  { field: '1.-Annual Salary Package (In Lacs)',   label: 'Work Exp 1 — Salary (Lacs)',     group: 'Work Experience' },
  { field: '1.-From',                              label: 'Work Exp 1 — From',              group: 'Work Experience' },
  { field: '1.-To',                                label: 'Work Exp 1 — To',                group: 'Work Experience' },
  { field: '1.-Total Experience(In Months)',       label: 'Work Exp 1 — Duration (Months)', group: 'Work Experience' },
  { field: 'Registration Campaign',     label: 'Registration Campaign',  group: 'Lead & Registration' },
  { field: 'Registration Medium',       label: 'Registration Medium',    group: 'Lead & Registration' },
  { field: 'Registration Source',       label: 'Registration Source',    group: 'Lead & Registration' },
  { field: 'Lead Stage',                label: 'Lead Stage',             group: 'Lead & Registration' },
  { field: 'Lead Origin',               label: 'Lead Origin',            group: 'Lead & Registration' },
  { field: 'Application Stage',         label: 'Application Stage',      group: 'Lead & Registration' },
  { field: 'Form Status',               label: 'Form Status',            group: 'Lead & Registration' },
];

function loadVisibleCols() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_COLUMNS;
}

function loadPinnedCols() {
  try {
    const s = localStorage.getItem(PIN_STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_PINNED;
}

// ── Customize Panel ───────────────────────────────────────────────────────────
function CustomisePanel({ visible, onApply, onClose }) {
  const [selected, setSelected] = useState([...visible]);
  const [search,   setSearch]   = useState('');

  const toggle = (field) => {
    setSelected(s => s.includes(field) ? s.filter(f => f !== field) : [...s, field]);
  };

  const allCols = [
    ...SCHEMA_COLUMNS.map(c => ({ ...c, isExcel: false })),
    ...EXCEL_FIELDS.map(f => ({ ...f, isExcel: true })),
  ];
  const filtered = allCols.filter(c => !search || c.label.toLowerCase().includes(search.toLowerCase()));
  const groups = {};
  filtered.forEach(c => { if (!groups[c.group]) groups[c.group] = []; groups[c.group].push(c); });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 500, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Customize Columns</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
              <input placeholder="🔍  Search column…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {Object.entries(groups).map(([group, cols]) => (
                <div key={group}>
                  <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, background: '#F9FAFB' }}>{group}</div>
                  {cols.map(col => (
                    <div key={col.field} onClick={() => toggle(col.field)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #F9FAFB' }}>
                      <input type="checkbox" checked={selected.includes(col.field)} onChange={() => toggle(col.field)} style={{ accentColor: '#3d4f12', width: 14, height: 14 }} />
                      <span style={{ fontSize: 13, color: '#374151' }}>{col.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: 195, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>SELECTED ({selected.length})</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {selected.map(field => {
                const col = [...SCHEMA_COLUMNS, ...EXCEL_FIELDS].find(c => c.field === field);
                return (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #F9FAFB', fontSize: 13 }}>
                    <span style={{ color: '#374151', fontSize: 12 }}>{col?.label || field}</span>
                    <button onClick={() => toggle(field)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 15 }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid #E5E7EB', justifyContent: 'space-between' }}>
          <button onClick={() => setSelected(DEFAULT_COLUMNS)} style={S.outlineBtn}>↺ Reset</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
            <button onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); onApply(selected); onClose(); }} style={{ ...S.primaryBtn, background: '#3d4f12' }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadExistingModal({ onClose, onDone }) {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError]     = useState('');
  const fileRef = useRef();

  async function handleFile(f) {
    setFile(f); setError('');
    try {
      const XLSX = await import('xlsx');
      const buf  = await f.arrayBuffer();
      const wb   = XLSX.read(buf);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setPreview(rows.slice(0, 5));
    } catch (e) { setError('Could not read file: ' + e.message); }
  }

  async function handleUpload() {
    if (!file) return;
    setSaving(true); setError('');
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      let success = 0, failed = 0, errors = [];
      for (const row of rows) {
        const enrollmentNo = String(row['Enrollment No'] || row['enrollment_no'] || '').trim();
        if (!enrollmentNo) { failed++; errors.push('Missing enrollment no'); continue; }
        const record = {
          enrollment_no:           enrollmentNo,
          application_no:          String(row['Application No']    || row['application_no']    || '').trim() || null,
          full_name:                String(row['Full Name']         || row['full_name']         || '').trim() || 'Unknown',
          program_name:             String(row['Program']           || row['program_name']      || '').trim() || null,
          specialization:           String(row['Specialization']    || row['specialization']    || '').trim() || null,
          personal_email:           String(row['Personal Email']    || row['personal_email']    || '').trim() || null,
          official_email:           String(row['Official Email']    || row['official_email']    || '').trim() || null,
          mobile:                   String(row['Mobile']            || row['mobile']            || '').trim() || null,
          current_semester:         parseInt(row['Current Semester']|| row['current_semester']  || 1),
          student_status:           'ENROLLED',
          email_activation_status:  'ACTIVATED',
          password_generated:       false,
          welcome_email_sent:       true,
          admission_date:           new Date().toISOString().split('T')[0],
        };
        const { error: e } = await supabase
          .from('student_master')
          .upsert(record, { onConflict: 'enrollment_no' });
        if (e) { failed++; errors.push(`${enrollmentNo}: ${e.message}`); } else success++;
      }
      setResults({ success, failed, errors, total: rows.length });
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 620 }}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0 }}>Upload Existing Students</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        {!results ? (
          <>
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              <strong>Expected columns:</strong> Application No, Enrollment No, Full Name, Program, Specialization, Personal Email, Official Email, Mobile, Current Semester
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #D1D5DB', borderRadius: 10, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: file ? '#F0FDF4' : '#FAFAFA' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{file ? file.name : 'Click to select Excel or CSV file'}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>.xlsx, .csv supported</div>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            </div>
            {preview.length > 0 && (
              <div style={{ marginBottom: 16, overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <table style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead><tr style={{ background: '#F9FAFB' }}>{Object.keys(preview[0]).slice(0, 8).map(k => <th key={k} style={{ padding: '6px 10px', textAlign: 'left', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{k}</th>)}</tr></thead>
                  <tbody>{preview.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>{Object.values(r).slice(0, 8).map((v, j) => <td key={j} style={{ padding: '5px 10px', color: '#374151' }}>{String(v).slice(0, 30)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {error && <div style={S.errorBox}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={S.outlineBtn}>Cancel</button>
              <button onClick={handleUpload} disabled={!file || saving} style={S.primaryBtn}>{saving ? 'Uploading…' : 'Upload Students'}</button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>{results.success}</div>
                <div style={{ fontSize: 12, color: '#166534' }}>Uploaded</div>
              </div>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{results.failed}</div>
                <div style={{ fontSize: 12, color: '#DC2626' }}>Failed</div>
              </div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1E40AF' }}>{results.total}</div>
                <div style={{ fontSize: 12, color: '#1E40AF' }}>Total</div>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, fontSize: 12, maxHeight: 150, overflowY: 'auto', marginBottom: 16 }}>
                {results.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setResults(null); setFile(null); setPreview([]); }} style={S.outlineBtn}>Upload More</button>
              <button onClick={onDone} style={S.primaryBtn}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Students() {
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [totalCount,    setTotalCount]    = useState(0);
  const [visibleCols,   setVisibleCols]   = useState(loadVisibleCols);
  const [pinnedCols,    setPinnedCols]    = useState(loadPinnedCols);
  const [searchText,    setSearchText]    = useState('');
  const [showCustomise, setShowCustomise] = useState(false);
  const [showUpload,    setShowUpload]    = useState(false);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterSem,     setFilterSem]     = useState('');

  const gridRef = useRef();

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('student_master')
        .select('*', { count: 'exact' })
        .order('enrollment_no', { ascending: true })
        .range(0, 4999);

      if (filterProgram) query = query.ilike('program_name', `%${filterProgram}%`);
      if (filterStatus)  query = query.eq('student_status', filterStatus);
      if (filterSem)     query = query.eq('current_semester', parseInt(filterSem));

      const { data, count, error } = await query;
      if (error) throw error;
      setStudents(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterStatus, filterSem]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Toggle pin for a column — called from the header click handler
  function togglePin(field) {
    setPinnedCols(prev => {
      const next = prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field];
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Custom header component with a pin/unpin button
  function PinnableHeader(props) {
    const { displayName, column } = props;
    const field = column.getColId();
    const isPinned = pinnedCols.includes(field);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 4 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
        <span
          onClick={e => { e.stopPropagation(); togglePin(field); }}
          title={isPinned ? 'Unpin column' : 'Pin column'}
          style={{
            cursor: 'pointer', fontSize: 12, flexShrink: 0,
            color: isPinned ? '#3d4f12' : '#C4C9B8',
            opacity: isPinned ? 1 : 0.6,
          }}
        >
          📌
        </span>
      </div>
    );
  }

  const buildColDef = (field) => {
    const schemaCol = SCHEMA_COLUMNS.find(c => c.field === field);
    const label     = schemaCol?.label || field;
    const isPinned  = pinnedCols.includes(field);
    const copyStyle = { userSelect: 'text', cursor: 'text' };

    if (field.startsWith('doc_') || field === 'drive_folder_url') {
      return {
        headerName: label, field, minWidth: 160, flex: 1,
        pinned: isPinned ? 'left' : undefined,
        headerComponent: PinnableHeader,
        cellRenderer: p => p.value
          ? <a href={p.value} target="_blank" rel="noopener noreferrer" style={{ color: '#3d4f12', fontSize: 12 }}>View ↗</a>
          : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>,
      };
    }

    const isExcel = !SCHEMA_COLUMNS.find(c => c.field === field) && EXCEL_FIELDS.find(c => c.field === field);
    if (isExcel) {
      return {
        headerName: field, field: '__raw__' + field, minWidth: 140, flex: 1,
        pinned: isPinned ? 'left' : undefined,
        headerComponent: PinnableHeader,
        cellStyle: copyStyle, valueGetter: p => p.data?.raw_data?.[field] ?? '',
      };
    }

    const specialCols = {
      application_no:          { minWidth: 150, flex: 1.3, cellStyle: copyStyle },
      enrollment_no:           { minWidth: 150, flex: 1.3, cellStyle: { ...copyStyle, fontWeight: 600 } },
      full_name:               { minWidth: 170, flex: 1.5, cellStyle: copyStyle },
      program_name:            { minWidth: 110, flex: 1 },
      specialization:          { minWidth: 170, flex: 1.3 },
      student_status:          { minWidth: 130, flex: 1, cellRenderer: p => <StatusBadge value={p.value} /> },
      email_activation_status: { minWidth: 130, flex: 1, cellRenderer: p => <EmailBadge value={p.value} /> },
      official_email:          { minWidth: 230, flex: 2, cellStyle: copyStyle },
      personal_email:          { minWidth: 210, flex: 1.8, cellStyle: copyStyle },
      mobile:                  { minWidth: 140, flex: 1, cellStyle: copyStyle },
      whatsapp_no:             { minWidth: 140, flex: 1, cellStyle: copyStyle },
      login_password:          { minWidth: 150, flex: 1.2, cellStyle: copyStyle },
      current_semester:        { minWidth: 130, flex: 0.9 },
      created_at:              { minWidth: 130, flex: 1, valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('en-IN') : '—' },
      dob:                     { minWidth: 130, flex: 1 },
      aadhaar_no:              { minWidth: 160, flex: 1.2, cellStyle: copyStyle },
      abc_id:                  { minWidth: 160, flex: 1.2, cellStyle: copyStyle },
      welcome_email_sent:      { minWidth: 150, flex: 1, valueFormatter: p => p.value ? 'Yes' : 'No' },
      password_generated:      { minWidth: 150, flex: 1, valueFormatter: p => p.value ? 'Yes' : 'No' },
    };

    return {
      headerName: label, field, minWidth: 120, flex: 1,
      pinned: isPinned ? 'left' : undefined,
      headerComponent: PinnableHeader,
      cellStyle: copyStyle,
      ...(specialCols[field] || {}),
    };
  };

  // Order columns so pinned ones come first (in pinnedCols order), then the rest
  const orderedCols = [
    ...pinnedCols.filter(f => visibleCols.includes(f)),
    ...visibleCols.filter(f => !pinnedCols.includes(f)),
  ];

  const columnDefs = [
    { headerName: '', checkboxSelection: true, headerCheckboxSelection: true, width: 44, pinned: 'left', sortable: false, filter: false, resizable: false },
    ...orderedCols.map(buildColDef),
    {
      headerName: '', field: '__actions', width: 50, pinned: 'right', sortable: false, filter: false, resizable: false,
      cellRenderer: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18 }}>⋯</button>
        </div>
      ),
    },
  ];

  const filteredStudents = students.filter(s => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.enrollment_no?.toLowerCase().includes(q) ||
      s.official_email?.toLowerCase().includes(q) ||
      s.personal_email?.toLowerCase().includes(q) ||
      s.mobile?.includes(q) ||
      s.application_no?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#F9FAFB', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Page Header ── */}
      <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid #e8ead4', background: '#fff' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1f0c' }}>Students</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            Total <strong>{totalCount}</strong> Student{totalCount !== 1 ? 's' : ''}
            {(filterProgram || filterStatus || filterSem || searchText) && (
              <span style={{ marginLeft: 8, color: '#c8a84b', fontWeight: 600 }}>
                · Showing: {filteredStudents.length}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginRight: 4 }}>📌 Click header pin icon to freeze/unfreeze</div>
          <button onClick={() => setShowCustomise(true)} style={S.iconBtn} title="Customize Columns">⊞</button>
          <button onClick={loadStudents} style={S.iconBtn} title="Refresh">↻</button>
          <button onClick={() => setShowUpload(true)} style={S.primaryBtn}>↑ Upload Existing</button>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e8ead4', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={S.filterLabel}>Program</div>
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={S.filterSelect}>
            <option value="">All Programs</option>
            <option value="MBA">MBA</option>
            <option value="MCA">MCA</option>
            <option value="BBA">BBA</option>
            <option value="BCA">BCA</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={S.filterLabel}>Student Status</div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.filterSelect}>
            <option value="">All Statuses</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={S.filterLabel}>Current Semester</div>
          <select value={filterSem} onChange={e => setFilterSem(e.target.value)} style={S.filterSelect}>
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 220, maxWidth: 340 }}>
          <div style={S.filterLabel}>Search</div>
          <input
            placeholder="Search name / enrollment / mobile / email…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ ...S.filterSelect, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          {(filterProgram || filterStatus || filterSem || searchText) && (
            <button
              onClick={() => { setFilterProgram(''); setFilterStatus(''); setFilterSem(''); setSearchText(''); }}
              style={{ ...S.outlineBtn, color: '#DC2626', borderColor: '#FECACA' }}
            >
              ✕ Reset
            </button>
          )}
          <button onClick={loadStudents} style={S.primaryBtn}>Apply</button>
        </div>
      </div>

      {/* ── Grid — takes remaining height ── */}
      <div style={{ flex: 1, padding: '12px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AgGridReact
          ref={gridRef}
          theme={themeQuartz.withParams({ fontSize: '12px', rowHeight: 36, headerHeight: 38 })}
          rowData={filteredStudents}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true, autoHeight: false }}
          rowSelection="multiple"
          suppressRowClickSelection
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[20, 50, 100, 200]}
          rowHeight={36}
          headerHeight={38}
          loading={loading}
          enableCellTextSelection
          ensureDomOrder
          onGridReady={p => p.api.sizeColumnsToFit()}
          onFirstDataRendered={p => p.api.sizeColumnsToFit()}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      {showCustomise && (
        <CustomisePanel
          visible={visibleCols}
          onApply={cols => { setVisibleCols(cols); localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)); }}
          onClose={() => setShowCustomise(false)}
        />
      )}
      {showUpload && (
        <UploadExistingModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); loadStudents(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ value }) {
  const map = { ENROLLED: { bg: '#DBEAFE', text: '#1E40AF' }, ACTIVE: { bg: '#DCFCE7', text: '#166534' }, INACTIVE: { bg: '#F3F4F6', text: '#6B7280' }, COMPLETED: { bg: '#FEF9C3', text: '#854D0E' } };
  const c = map[value] || { bg: '#F3F4F6', text: '#374151' };
  return <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }}>{value || '—'}</span>;
}

function EmailBadge({ value }) {
  const map = { ACTIVATED: { bg: '#DCFCE7', text: '#166534' }, PENDING: { bg: '#FEF9C3', text: '#854D0E' }, FAILED: { bg: '#FEF2F2', text: '#DC2626' } };
  const c = map[value] || { bg: '#F3F4F6', text: '#374151' };
  return <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }}>{value || '—'}</span>;
}

const S = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: 14, padding: 28, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeBtn:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' },
  primaryBtn:   { background: '#3d4f12', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn:   { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  iconBtn:      { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, color: '#374151' },
  errorBox:     { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 },
  filterLabel:  { fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' },
  filterSelect: { padding: '7px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', minWidth: 180, background: '#fff' },
};
