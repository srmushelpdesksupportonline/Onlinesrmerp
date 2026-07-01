import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  parseResultRows, uploadResults, smartParseSheet,
  detectSubjectFromSheet, extractSubjectFromFileName,
} from '../../services/resultsService';
import { calculateGrade } from '../../services/gradingService';

// Fixed, consistent casing — prevents "jan 2026" vs "JAN 2026" mismatches
const MONTH_OPTIONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - 1 + i)); // -1 to +4 years

const S = {
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
  fGroup:     { marginBottom: 14 },
  primaryBtn: { background: '#6366F1', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  outlineBtn: { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  successBox: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  warnBox:    { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  autoTag:    { background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginLeft: 6 },
  manualTag:  { background: '#FEF9C3', color: '#854D0E', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginLeft: 6 },
};

// ── Auto-detect program from enrollment number prefix ─────────────────────────
function detectProgramFromEnrollment(enrollmentNo) {
  if (!enrollmentNo) return null;
  const prog = enrollmentNo.slice(1, 3).toUpperCase();
  return { MB: 'MBA', MC: 'MCA', BB: 'BBA', BC: 'BCA' }[prog] || null;
}

// ── Auto-detect batch (intake) and academic year from enrollment number ───────
// New format: Batch = "JAN-25" / "JUL-25", Academic Year = single year "2025"
function detectIntakeYearFromEnrollment(enrollmentNo) {
  if (!enrollmentNo || enrollmentNo.length < 6) return { intake: null, academicYear: null };
  const intakeCode = enrollmentNo[3];
  const yy         = enrollmentNo.slice(4, 6);
  const intakeMonth = intakeCode === '2' ? 'JUL' : intakeCode === '1' ? 'JAN' : null;
  const intake       = intakeMonth ? `${intakeMonth}-${yy}` : null;
  const academicYear = yy ? `20${yy}` : null;
  return { intake, academicYear };
}

// ── Auto-detect semester from filename ────────────────────────────────────────
function detectSemesterFromFilename(fileName) {
  const match = fileName.match(/[Ss]em[-_\s]*(\d)/);
  return match ? match[1] : null;
}

// ── Get first valid enrollment number from rows ───────────────────────────────
function getFirstEnrollment(rows) {
  for (const row of rows) {
    const key = Object.keys(row).find(k => {
      const norm = k.trim().toLowerCase().replace(/[\s.]+/g, '');
      return norm.match(/enro[l]+n?ment/) ||
             norm === 'rollno' ||
             norm === 'rollnumber';
    });
    const val = key ? String(row[key] || '').trim() : '';
    if (val && val.length >= 6 && val.startsWith('E')) return val;
  }
  return null;
}

// ── Auto-detect all metadata from file + rows ─────────────────────────────────
function autoDetect(fileName, sheetName, rows) {
  const firstEnrollment = getFirstEnrollment(rows);
  const program      = detectProgramFromEnrollment(firstEnrollment);
  const { intake, academicYear } = detectIntakeYearFromEnrollment(firstEnrollment);
  const semester     = detectSemesterFromFilename(fileName);
  const courseName   = detectSubjectFromSheet(sheetName, fileName) || extractSubjectFromFileName(fileName);

  return {
    programCode:  program     || '',
    semester:     semester    || '',
    academicYear: academicYear|| '',
    intake:       intake      || '',
    courseName:   courseName  || '',
    // Track what was auto-detected vs needs manual input
    autoDetected: {
      programCode:  !!program,
      semester:     !!semester,
      academicYear: !!academicYear,
      intake:       !!intake,
      courseName:   !!courseName,
    },
  };
}

export default function ResultUpload() {
  const fileRef = useRef();

  const [file,          setFile]          = useState(null);
  const [sheets,        setSheets]        = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewRows,   setPreviewRows]   = useState([]);
  const [allRows,       setAllRows]       = useState([]);
  const [detected,      setDetected]      = useState(null); // auto-detected values

  // Overrides — only set when user manually changes a field
  const [overrides, setOverrides] = useState({});

  // Exam Month/Year — always manual, shared across single-sheet and batch upload.
  // Built from separate Month + Year dropdowns to avoid case-sensitivity bugs
  // (e.g. "jan 2026" vs "JAN 2026" being treated as different exam sittings).
  const [examMonth, setExamMonth] = useState('');
  const [examYear,  setExamYear]  = useState('');
  const examMonthYear = (examMonth && examYear) ? `${examMonth} ${examYear}` : '';

  // Other fields not auto-detectable
  const [schemeId,   setSchemeId]   = useState('');
  const [uploadedBy, setUploadedBy] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total, label }
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [results,   setResults]   = useState([]); // upload results per sheet

  function setOverride(k, v) { setOverrides(o => ({ ...o, [k]: v })); }

  // Final values = override if set, else auto-detected
  function val(key) { return overrides[key] !== undefined ? overrides[key] : detected?.[key] || ''; }
  function isAuto(key) { return overrides[key] === undefined && detected?.autoDetected?.[key]; }
  function isManualNeeded(key) { return !isAuto(key) && !val(key); }

  function loadSheet(wb, sheetName, fileName, rows, smartInfo) {
    // smartInfo contains course name/code/semester extracted from file metadata rows
    const sheetCourseName = smartInfo?.courseName || detectSubjectFromSheet(sheetName, fileName) || extractSubjectFromFileName(fileName);
    const sheetSemester   = smartInfo?.semester   || detectSemesterFromFilename(fileName);
    const firstEnrollment = getFirstEnrollment(rows);
    const program         = detectProgramFromEnrollment(firstEnrollment);
    const { intake, academicYear } = detectIntakeYearFromEnrollment(firstEnrollment);

    const auto = {
      programCode:  program          || '',
      semester:     sheetSemester    || '',
      academicYear: academicYear     || '',
      intake:       intake           || '',
      courseName:   sheetCourseName  || '',
      autoDetected: {
        programCode:  !!program,
        semester:     !!sheetSemester,
        academicYear: !!academicYear,
        intake:       !!intake,
        courseName:   !!sheetCourseName,
      },
    };
    setDetected(auto);
    setOverrides({});
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError(''); setSuccess(''); setResults([]);
    setSelectedSheet(''); setPreviewRows([]); setAllRows([]);
    setDetected(null); setOverrides({});

    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      setSheets(wb.SheetNames);

      // Auto-select if single sheet
      if (wb.SheetNames.length === 1) {
        const sheetName = wb.SheetNames[0];
        setSelectedSheet(sheetName);
        const ws      = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const { rows, courseName, courseCode, semester } = smartParseSheet(rawRows);
        setAllRows(rows);
        setPreviewRows(rows.slice(0, 5));
        loadSheet(wb, sheetName, f.name, rows, { courseName, courseCode, semester });
      }
    };
    reader.readAsArrayBuffer(f);
  }

  function handleSheetSelect(sheetName) {
    setSelectedSheet(sheetName);
    setError(''); setSuccess('');

    const reader = new FileReader();
    reader.onload = ev => {
      const wb      = XLSX.read(ev.target.result, { type: 'array' });
      const ws      = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const { rows, courseName, courseCode, semester } = smartParseSheet(rawRows);
      setAllRows(rows);
      setPreviewRows(rows.slice(0, 5));
      loadSheet(wb, sheetName, file.name, rows, { courseName, courseCode, semester });
    };
    reader.readAsArrayBuffer(file);
  }

  // Upload all sheets at once for multi-sheet files
  async function handleUploadAll() {
    if (!examMonthYear.trim()) {
      setError('Exam Month/Year is required before uploading. Please enter it (e.g. "JAN 2026") above.');
      return;
    }
    const examMY = examMonthYear.trim();

    const reader = new FileReader();
    reader.onload = async ev => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      setUploading(true); setError(''); setSuccess(''); setResults([]);
      const totalSheets = wb.SheetNames.length;
      setUploadProgress({ done: 0, total: totalSheets, label: 'Starting…' });
      const uploadResults_ = [];

      for (let si = 0; si < wb.SheetNames.length; si++) {
        const sheetName = wb.SheetNames[si];
        setUploadProgress({ done: si, total: totalSheets, label: `Processing "${sheetName}"…` });
        const ws = wb.Sheets[sheetName];

        const markDone = () => setUploadProgress({ done: si + 1, total: totalSheets, label: si + 1 === totalSheets ? 'Finishing…' : `Processing "${wb.SheetNames[si + 1] || ''}"…` });

        // Step 1: Try standard read first (works for clean-header sheets like ME)
        let rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Step 2: If no valid enrollment found, try smartParseSheet (for files with junk header rows)
        const firstEnrollStd = getFirstEnrollment(rows);
        if (!firstEnrollStd) {
          const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const parsed  = smartParseSheet(rawRows);
          if (parsed.rows.length > 0) rows = parsed.rows;
        }

        if (rows.length === 0) { markDone(); continue; }

        // Step 3: Resolve metadata
        const firstEnrollment  = getFirstEnrollment(rows);
        const program          = detectProgramFromEnrollment(firstEnrollment);
        const { intake, academicYear } = detectIntakeYearFromEnrollment(firstEnrollment);

        // Course name: sheet map takes priority, then filename
        const resolvedCourse = detectSubjectFromSheet(sheetName, file.name) || extractSubjectFromFileName(file.name);
        const resolvedSem    = detectSemesterFromFilename(file.name);

        if (!program || !resolvedSem || !resolvedCourse) {
          uploadResults_.push({ sheet: sheetName, status: 'skipped', reason: `Missing: ${!program ? 'program ' : ''}${!resolvedSem ? 'semester ' : ''}${!resolvedCourse ? 'course name' : ''}` });
          markDone();
          continue;
        }

        try {
          const parsed  = parseResultRows(rows, {
            programCode:   program,
            semester:      resolvedSem,
            academicYear:  academicYear   || null,
            intake:        intake         || null,
            examMonthYear: examMY,
            schemeId:      schemeId       || null,
            uploadedBy:    uploadedBy     || null,
          });
          const records = await Promise.all(parsed.map(async r => {
            const grade = await calculateGrade({
              programCode: program,
              batch:       intake,
              iaMarks:     r.ia_marks,
              eseMarks:    r.ese_marks,
              totalMarks:  r.total_marks,
            });
            return { ...r, course_name: resolvedCourse, course_code: null, grade: grade?.letter || null };
          }));
          if (records.length === 0) {
            uploadResults_.push({ sheet: sheetName, status: 'skipped', reason: 'No valid student rows parsed' });
            markDone();
            continue;
          }
          const { count } = await uploadResults(records);
          uploadResults_.push({ sheet: sheetName, subject: resolvedCourse, count, status: 'ok' });
        } catch (e) {
          uploadResults_.push({ sheet: sheetName, status: 'error', reason: e.message });
        }
        markDone();
      }

      setResults(uploadResults_);
      setUploading(false);
      setUploadProgress(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUploadSheet() {
    if (!selectedSheet) { setError('Select a sheet first.'); return; }
    if (!val('programCode'))   { setError('Program could not be detected. Please select it manually.'); return; }
    if (!val('semester'))      { setError('Semester could not be detected. Please enter it manually.'); return; }
    if (!val('courseName'))    { setError('Course name could not be detected. Please enter it manually.'); return; }
    if (!examMonthYear.trim()) { setError('Exam Month/Year is required — e.g. "JAN 2026". Please enter it.'); return; }
    if (allRows.length === 0)  { setError('No data rows found.'); return; }

    setUploading(true); setError(''); setSuccess('');
    setUploadProgress({ done: 0, total: allRows.length, label: 'Parsing rows…' });
    try {
      const rowsToUpload = allRows;
      if (rowsToUpload.length === 0) { setError('No valid student rows found.'); return; }
      const parsed = parseResultRows(rowsToUpload, {
        programCode:   val('programCode'),
        semester:      val('semester'),
        academicYear:  val('academicYear') || null,
        intake:        val('intake')       || null,
        examMonthYear: examMonthYear.trim(),
        schemeId:      schemeId            || null,
        uploadedBy:    uploadedBy          || null,
      });
      setUploadProgress({ done: 0, total: parsed.length, label: 'Calculating grades…' });
      const records = [];
      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i];
        const grade = await calculateGrade({
          programCode: val('programCode'),
          batch:       val('intake'),
          iaMarks:     r.ia_marks,
          eseMarks:    r.ese_marks,
          totalMarks:  r.total_marks,
        });
        records.push({ ...r, course_name: val('courseName'), course_code: null, grade: grade?.letter || null });
        if (i % 25 === 0 || i === parsed.length - 1) {
          setUploadProgress({ done: i + 1, total: parsed.length, label: 'Calculating grades…' });
        }
      }
      if (records.length === 0) { setError('No valid student rows found. Check enrollment number column.'); setUploading(false); setUploadProgress(null); return; }
      setUploadProgress({ done: records.length, total: records.length, label: 'Uploading to database…' });
      const { count } = await uploadResults(records);
      setSuccess(`✓ Uploaded ${count} records for "${val('courseName')}" (${val('programCode')} Sem ${val('semester')}, ${examMonthYear.trim()})`);
    } catch (e) {
      setError(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  const missingFields = detected
    ? ['programCode','semester','courseName'].filter(k => isManualNeeded(k))
    : [];

  const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]).slice(0, 7) : [];

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Upload Results</h2>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
          Program, semester, intake and year are detected automatically from the file
        </div>
      </div>

      {uploading && uploadProgress && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{uploadProgress.label}</span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {uploadProgress.total > 0 ? `${uploadProgress.done} / ${uploadProgress.total}` : ''}
            </span>
          </div>
          <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: uploadProgress.total > 0 ? `${Math.min(100, Math.round((uploadProgress.done / uploadProgress.total) * 100))}%` : '15%',
              background: '#6366F1',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* Left — file + sheet + preview */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? '#6366F1' : '#D1D5DB'}`,
              borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer',
              background: file ? '#EEF2FF' : '#FAFAFA', marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: file ? '#6366F1' : '#374151' }}>
              {file ? file.name : 'Click to select Excel file'}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              MBA_Sem-1.xlsx · 1__Managerial_Economics.xlsx · MCA_Sem1.xlsx etc.
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          {/* Sheet selector */}
          {sheets.length > 1 && (
            <div style={S.fGroup}>
              <label style={S.label}>Select Sheet (Subject)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {sheets.map(s => (
                  <button key={s} onClick={() => handleSheetSelect(s)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: selectedSheet === s ? '2px solid #6366F1' : '1px solid #D1D5DB',
                    background: selectedSheet === s ? '#EEF2FF' : '#fff',
                    color: selectedSheet === s ? '#6366F1' : '#374151',
                  }}>{s}</button>
                ))}
              </div>
              {file && sheets.length > 1 && (
                <>
                  {!examMonthYear.trim() && (
                    <div style={{ ...S.warnBox, marginTop: 12, marginBottom: 0 }}>
                      Set <strong>Exam Month/Year</strong> in the panel on the right before uploading all sheets.
                    </div>
                  )}
                  <button
                    onClick={handleUploadAll}
                    disabled={uploading || !examMonthYear.trim()}
                    style={{
                      ...S.primaryBtn, marginTop: 12, background: '#059669',
                      opacity: (uploading || !examMonthYear.trim()) ? 0.5 : 1,
                      cursor:  (uploading || !examMonthYear.trim()) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {uploading ? 'Uploading all…' : `⚡ Upload All ${sheets.length} Sheets at Once`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Preview — first 5 rows · {allRows.length} total records
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {previewCols.map(c => (
                        <th key={c} style={{ padding: '6px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        {previewCols.map(c => (
                          <td key={c} style={{ padding: '5px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {String(row[c] ?? '').slice(0, 22)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Batch upload results */}
          {results.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Upload Summary</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Sheet', 'Subject', 'Records', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.sheet}</td>
                      <td style={{ padding: '8px 12px', color: '#6B7280' }}>{r.subject || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{r.count ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.status === 'ok'
                          ? <span style={{ color: '#166534', fontWeight: 600 }}>✓ Done</span>
                          : r.status === 'skipped'
                          ? <span style={{ color: '#92400E' }}>⚠ {r.reason}</span>
                          : <span style={{ color: '#DC2626' }}>✕ {r.reason}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right — auto-detected details + manual overrides */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Detected Details</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
            Auto-filled from the file. Override only if incorrect.
          </div>

          {/* Exam Month/Year — always visible, always manual, applies to single + batch upload */}
          <div style={{ ...S.fGroup, paddingBottom: 14, marginBottom: 18, borderBottom: '1px solid #F3F4F6' }}>
            <label style={S.label}>
              Exam Month/Year
              {examMonthYear.trim()
                ? <span style={S.manualTag}>Manual</span>
                : <span style={{ ...S.manualTag, background: '#FEE2E2', color: '#DC2626' }}>Required</span>
              }
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                style={{ ...S.input, borderColor: examMonthYear.trim() ? '#D1D5DB' : '#EF4444', flex: 1.3 }}
                value={examMonth}
                onChange={e => setExamMonth(e.target.value)}
              >
                <option value="">Month</option>
                {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                style={{ ...S.input, borderColor: examMonthYear.trim() ? '#D1D5DB' : '#EF4444', flex: 1 }}
                value={examYear}
                onChange={e => setExamYear(e.target.value)}
              >
                <option value="">Year</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              Used for backlog re-exams — the same subject can have multiple attempts, one row per exam sitting.
            </div>
          </div>

          {!detected ? (
            <div style={{ color: '#9CA3AF', fontSize: 13 }}>Select a file to auto-detect remaining details.</div>
          ) : (
            <>
              {missingFields.length > 0 && (
                <div style={S.warnBox}>
                  Could not auto-detect: <strong>{missingFields.join(', ')}</strong>. Please fill these in manually.
                </div>
              )}

              {[
                { key: 'programCode',  label: 'Program',       type: 'select', options: ['MBA','MCA','BBA','BCA'] },
                { key: 'semester',     label: 'Semester',      type: 'select', options: ['1','2','3','4','5','6'] },
                { key: 'academicYear', label: 'Academic Year', type: 'text',   placeholder: 'e.g. 2025' },
                { key: 'intake',       label: 'Batch',         type: 'text',   placeholder: 'e.g. JAN-25' },
                { key: 'courseName',   label: 'Subject Name',  type: 'text',   placeholder: 'e.g. Managerial Economics' },
              ].map(field => (
                <div key={field.key} style={S.fGroup}>
                  <label style={S.label}>
                    {field.label}
                    {isAuto(field.key)
                      ? <span style={S.autoTag}>Auto</span>
                      : val(field.key)
                      ? <span style={S.manualTag}>Manual</span>
                      : <span style={{ ...S.manualTag, background: '#FEE2E2', color: '#DC2626' }}>Required</span>
                    }
                  </label>
                  {field.type === 'select' ? (
                    <select
                      style={{ ...S.input, borderColor: isManualNeeded(field.key) ? '#EF4444' : '#D1D5DB' }}
                      value={val(field.key)}
                      onChange={e => setOverride(field.key, e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      style={{ ...S.input, borderColor: isManualNeeded(field.key) ? '#EF4444' : '#D1D5DB' }}
                      value={val(field.key)}
                      onChange={e => setOverride(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}

              <div style={S.fGroup}>
                <label style={S.label}>Scheme / AR <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                <input style={S.input} value={schemeId} onChange={e => setSchemeId(e.target.value)} placeholder="e.g. AR-01" />
              </div>

              <div style={{ ...S.fGroup, marginBottom: 20 }}>
                <label style={S.label}>Uploaded By <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                <input style={S.input} value={uploadedBy} onChange={e => setUploadedBy(e.target.value)} placeholder="Your name" />
              </div>

              {error   && <div style={S.errorBox}>{error}</div>}
              {success && <div style={S.successBox}>{success}</div>}

              <div style={S.infoBox} >
                Results with <strong>F</strong> or <strong>AB</strong> in ESE are auto-flagged as backlogs.
              </div>

              <button
                onClick={handleUploadSheet}
                disabled={uploading || !selectedSheet || missingFields.length > 0 || !examMonthYear.trim()}
                style={{
                  ...S.primaryBtn, width: '100%',
                  opacity: (uploading || !selectedSheet || missingFields.length > 0 || !examMonthYear.trim()) ? 0.5 : 1,
                  cursor:  (uploading || !selectedSheet || missingFields.length > 0 || !examMonthYear.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? 'Uploading…' : `Upload "${selectedSheet || 'sheet'}" Results`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
