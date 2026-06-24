import { useState, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import * as XLSX from 'xlsx';
import {
  loadAdmissions,
  loadAcademicYears,
  getExistingAdmissions,
  getExistingStudents,
  getEnrolledCount,
  insertAdmissions,
  mapRowToMerritoImport,
  generateAndSaveEnrollmentNo,
  markCRMPushComplete,
  enrollStudent,
  cleanMobile,
} from '../services/admissionsService';

ModuleRegistry.registerModules([AllCommunityModule]);

// Standardise any rejected row into the failed-report shape
const toFailedRow = (incomingRow, reason) => ({
  'Application No': String(incomingRow['Application No'] || '').trim(),
  'Student Name':
    incomingRow['Full Name As Per Your 10th Marksheet'] ||
    incomingRow['Full Name as per your 10th Marksheet'] ||
    incomingRow['Full Name'] || '',
  'Email':  incomingRow['Email ID'] || incomingRow['Email Id'] || '',
  'Phone':  incomingRow['Mobile Number'] || '',
  'Reason': reason,
});

export default function Admissions() {
  const gridRef = useRef(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [rowData, setRowData]             = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [isLoading, setIsLoading]         = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [programFilter, setProgramFilter] = useState('');
  const [searchText, setSearchText]       = useState('');

  // ── Upload modal ──────────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [academicYear, setAcademicYear]       = useState('');
  const [intake, setIntake]                   = useState('');
  const [selectedFile, setSelectedFile]       = useState(null);
  const [isUploading, setIsUploading]         = useState(false);

  // ── Summary modal ─────────────────────────────────────────────────────────
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [uploadSummary, setUploadSummary]       = useState(null);

  // ── Action states ─────────────────────────────────────────────────────────
  const [isMarkingCRM, setIsMarkingCRM]     = useState(false);
  const [isEnrolling, setIsEnrolling]       = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(null);

  // ── Column definitions ────────────────────────────────────────────────────
  const columnDefs = [
    { checkboxSelection: true, headerCheckboxSelection: true, width: 50, pinned: 'left' },
    { headerName: 'Application No', field: 'application_no',                       width: 160 },
    { headerName: 'Student Name',   field: 'full_name_as_per_your_10th_marksheet', flex: 2, minWidth: 200 },
    { headerName: 'Program',        field: 'course',                                width: 90  },
    { headerName: 'Intake',         field: 'intake',                                width: 80  },
    { headerName: 'Personal Email', field: 'email_id',                              flex: 2, minWidth: 200 },
    { headerName: 'Mobile',         field: 'mobile_number',                         width: 150 },
    { headerName: 'Enrollment No',  field: 'enrollment_no',  width: 160 },
    {
      headerName: 'CRM Push',
      field: 'api_push_status',
      width: 130,
      cellStyle: (p) => {
        if (p.value === 'COMPLETED') return { color: '#15803d', fontWeight: 600 };
        if (p.value === 'PENDING')   return { color: '#b45309', fontWeight: 600 };
        return { color: '#6b7280' };
      },
    },
    {
      headerName: '',
      field: 'id',
      width: 60,
      cellRenderer: (p) => (
        <button
          onClick={() => {}}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: '#666',
            padding: '4px 8px',
          }}
          title="View full application"
        >
          ⋯
        </button>
      ),
    },
  ];

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [admissions, count] = await Promise.all([
        loadAdmissions(programFilter),
        getEnrolledCount(),
      ]);
      setRowData(admissions);
      setEnrolledCount(count);
    } catch (err) {
      console.error('loadData:', err);
    } finally {
      setIsLoading(false);
    }
  }, [programFilter]);

  useEffect(() => { loadAcademicYears().then(setAcademicYears); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // ── Dashboard card values ─────────────────────────────────────────────────
  const totalRecords = rowData.length;
  // Pending Review: no enrollment number yet (auto-generation may have failed)
  const pendingReview = rowData.filter((r) => !r.enrollment_no).length;
  // Ready For Enrollment: enrollment number generated AND CRM push confirmed
  const readyForEnrollment = rowData.filter(
    (r) => r.enrollment_no && r.api_push_status === 'COMPLETED'
  ).length;
  // enrolledCount comes from student_master

  // ── Failed report download ────────────────────────────────────────────────
  const downloadFailedReport = (failedRows) => {
    if (!failedRows?.length) { alert('No failed records.'); return; }
    const ws = XLSX.utils.json_to_sheet(failedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed Report');
    XLSX.writeFile(wb, 'failed_report.xlsx');
  };

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = () => {
    if (!academicYear) { alert('Please select Academic Year'); return; }
    if (!intake)       { alert('Please select Intake');        return; }
    if (!selectedFile) { alert('Please select a file');        return; }

    const ext    = selectedFile.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = async (e) => {
      setIsUploading(true);
      try {
        // Parse file
        let parsedData;
        if (ext === 'csv') {
          const wb = XLSX.read(e.target.result, { type: 'string' });
          parsedData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          parsedData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }

        // Fetch existing records for duplicate check
        const [existingAdmissions, existingStudents] = await Promise.all([
          getExistingAdmissions(),
          getExistingStudents(),
        ]);

        const admissionAppNos  = new Set(existingAdmissions.map((a) => String(a.application_no || '').trim()));
        const admissionEmails  = new Set(existingAdmissions.map((a) => (a.email_id || '').toLowerCase()));
        const admissionMobiles = new Set(existingAdmissions.map((a) => cleanMobile(String(a.mobile_number || ''))));

        const studentAppNos    = new Set(existingStudents.map((s) => String(s.application_no || '').trim()));
        const studentEmails    = new Set(existingStudents.map((s) => (s.personal_email || '').toLowerCase()));
        const studentMobiles   = new Set(existingStudents.map((s) => cleanMobile(String(s.mobile || ''))));

        const validRows  = [];
        const failedRows = [];

        for (const incomingRow of parsedData) {
          const appNo  = String(incomingRow['Application No'] || '').trim();
          const email  = (incomingRow['Email ID'] || incomingRow['Email Id'] || '').toLowerCase();
          const mobile = cleanMobile(String(incomingRow['Mobile Number'] || ''));

          // 1. Missing Application No
          if (!appNo) {
            failedRows.push(toFailedRow(incomingRow, 'Missing Application No'));
            continue;
          }

          // 2. Duplicate in admissions queue
          if (
            admissionAppNos.has(appNo) ||
            admissionEmails.has(email) ||
            (mobile && admissionMobiles.has(mobile))
          ) {
            const reason = admissionAppNos.has(appNo)
              ? 'Application No already in admissions queue'
              : admissionEmails.has(email)
              ? 'Email already in admissions queue'
              : 'Mobile already in admissions queue';
            failedRows.push(toFailedRow(incomingRow, reason));
            continue;
          }

          // 3. Already enrolled
          if (
            studentAppNos.has(appNo) ||
            studentEmails.has(email) ||
            (mobile && studentMobiles.has(mobile))
          ) {
            const reason = studentAppNos.has(appNo)
              ? 'Application No already enrolled'
              : studentEmails.has(email)
              ? 'Email already enrolled'
              : 'Mobile already enrolled';
            failedRows.push(toFailedRow(incomingRow, reason));
            continue;
          }

          validRows.push(incomingRow);
        }

        // Save valid rows + auto-generate enrollment numbers
        let enrollGenerated = 0;
        const enrollErrors  = [];

        if (validRows.length > 0) {
          const mapped       = validRows.map((vr) => mapRowToMerritoImport(vr, intake, academicYear));
          const insertedRows = await insertAdmissions(mapped);

          for (const insertedRow of insertedRows) {
            try {
              await generateAndSaveEnrollmentNo(insertedRow);
              enrollGenerated++;
            } catch (err) {
              enrollErrors.push(`${insertedRow.application_no}: ${err.message}`);
            }
          }

          await loadData();
        }

        setUploadSummary({
          total:           parsedData.length,
          valid:           validRows.length,
          failed:          failedRows.length,
          enrollGenerated,
          enrollErrors,
          failedRows,
        });
        setShowUploadModal(false);
        setShowSummaryModal(true);

      } catch (err) {
        console.error('Upload error:', err);
        alert('Upload failed: ' + (err.message || 'Unknown error'));
      } finally {
        setIsUploading(false);
      }
    };

    if (ext === 'csv') reader.readAsText(selectedFile);
    else               reader.readAsArrayBuffer(selectedFile);
  };

  // ── Mark CRM Push Complete ────────────────────────────────────────────────
  // Temporary manual step until Merritto API is integrated.
  // Eligibility: must have an enrollment number + currently PENDING.
  const handleMarkCRMComplete = async () => {
    const selected = gridRef.current?.api?.getSelectedRows() || [];

    if (selected.length === 0) {
      alert('Select at least one row first.');
      return;
    }

    const eligible = selected.filter(
      (r) => r.enrollment_no && r.api_push_status === 'PENDING'
    );

    if (eligible.length === 0) {
      alert(
        'No eligible rows selected.\n\n' +
        'Rows must have an enrollment number and CRM Push status of PENDING.'
      );
      return;
    }

    if (
      !window.confirm(
        `Mark ${eligible.length} row(s) as CRM Push Completed?\n\n` +
        `This confirms the enrollment number has been sent to Merritto.`
      )
    ) return;

    setIsMarkingCRM(true);
    try {
      const ids = eligible.map((r) => r.id);
      await markCRMPushComplete(ids);
      await loadData();
      alert(`${eligible.length} row(s) marked as CRM Push Completed ✓`);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsMarkingCRM(false);
    }
  };

  // ── Enroll ────────────────────────────────────────────────────────────────
  // Eligibility: enrollment number generated AND CRM push completed.
  const handleEnroll = async () => {
    const selected = gridRef.current?.api?.getSelectedRows() || [];

    if (selected.length === 0) {
      alert('Select at least one row first.');
      return;
    }

    const eligible = selected.filter(
      (r) => r.enrollment_no && r.api_push_status === 'COMPLETED'
    );

    if (eligible.length === 0) {
      alert(
        'No eligible rows selected.\n\n' +
        'Rows must have:\n' +
        '• Enrollment number generated\n' +
        '• CRM Push status = Completed'
      );
      return;
    }

    if (
      !window.confirm(
        `Enroll ${eligible.length} student(s)?\n\n` +
        `This will:\n` +
        `• Generate an official email and password\n` +
        `• Move them to the Student page\n` +
        `• Remove them from this list\n\n` +
        `This cannot be undone.`
      )
    ) return;

    setIsEnrolling(true);
    setEnrollProgress({ done: 0, total: eligible.length, errors: [] });

    let success = 0;
    const errors = [];

    for (const eligibleRow of eligible) {
      try {
        await enrollStudent(eligibleRow, {});
        success++;
      } catch (err) {
        errors.push(
          `${eligibleRow.application_no} – ` +
          `${eligibleRow.full_name_as_per_your_10th_marksheet}: ${err.message}`
        );
      }
      setEnrollProgress((p) => ({ ...p, done: (p?.done ?? 0) + 1, errors }));
    }

    setIsEnrolling(false);
    setEnrollProgress(null);
    await loadData();

    if (errors.length > 0) {
      alert(`Enrolled: ${success} / ${eligible.length}\n\nFailed:\n` + errors.join('\n'));
    } else {
      alert(
        `Enrolled: ${success} / ${eligible.length} ✓\n\n` +
        `Students moved to Student page.\n` +
        `Official emails are pending Google Workspace activation.`
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <h1 className="page-title">Admissions / Raw Data</h1>

      {/* Dashboard Cards */}
      <div className="dashboard-cards">
        <div className="card">
          <h2>{totalRecords}</h2>
          <p>Total Records</p>
        </div>
        <div className="card">
          <h2>{readyForEnrollment}</h2>
          <p>Ready For Enrollment</p>
        </div>
        <div className="card">
          <h2>{enrolledCount}</h2>
          <p>Enrolled</p>
        </div>
        <div className="card">
          <h2>{pendingReview}</h2>
          <p>Pending Review</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
        >
          <option value="">All Programs</option>
          <option value="MBA">MBA</option>
          <option value="MCA">MCA</option>
          <option value="BBA">BBA</option>
          <option value="BCA">BCA</option>
        </select>

        <input
          type="search"
          placeholder="Search Student"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            gridRef.current?.api?.setGridOption('quickFilterText', e.target.value);
          }}
        />

        <button
          onClick={() => {
            setAcademicYear('');
            setIntake('');
            setSelectedFile(null);
            setShowUploadModal(true);
          }}
          disabled={isLoading || isEnrolling || isMarkingCRM}
        >
          Upload Raw Data
        </button>

        {/* Temporary manual CRM push button — replaced by API later */}
        <button
          onClick={handleMarkCRMComplete}
          disabled={isMarkingCRM || isEnrolling}
        >
          {isMarkingCRM ? 'Updating…' : 'Mark CRM Push Complete'}
        </button>

        <button
          onClick={handleEnroll}
          disabled={isEnrolling || isMarkingCRM}
        >
          {isEnrolling
            ? `Enrolling… (${enrollProgress?.done ?? 0} / ${enrollProgress?.total ?? 0})`
            : 'Enroll'}
        </button>
      </div>

      {/* Grid */}
      <div style={{ height: 650, width: '100%', marginTop: 16 }}>
        <AgGridReact
          ref={gridRef}
          theme={themeQuartz}
          rowData={rowData}
          columnDefs={columnDefs}
          rowSelection="multiple"
          quickFilterText={searchText}
          pagination
          paginationPageSize={50}
          loading={isLoading}
        />
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Import Admissions Data</h2>

            <div className="form-group">
              <label>Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                <option value="">Select Academic Year</option>
                {academicYears.length > 0 ? (
                  academicYears.map((y) => (
                    <option key={y.id} value={y.academic_year}>
                      {y.academic_year}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </>
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Intake</label>
              <select
                value={intake}
                onChange={(e) => setIntake(e.target.value)}
              >
                <option value="">Select Intake</option>
                <option value="JAN">January</option>
                <option value="JUL">July</option>
              </select>
            </div>

            <div className="form-group">
              <label>Excel / CSV File</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />
            </div>

            <div className="modal-actions">
              <button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? 'Uploading…' : 'Upload'}
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && uploadSummary && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Upload Summary</h2>
            <div className="summary-box">
              <p>Total Uploaded:           <strong>{uploadSummary.total}</strong></p>
              <p>Imported:                 <strong>{uploadSummary.valid}</strong></p>
              <p>Enrollment Nos Generated: <strong>{uploadSummary.enrollGenerated}</strong></p>
              <p>Failed:                   <strong>{uploadSummary.failed}</strong></p>
              {uploadSummary.enrollErrors?.length > 0 && (
                <p style={{ color: '#dc2626', marginTop: 8 }}>
                  Enrollment No errors for {uploadSummary.enrollErrors.length} row(s) — check Pending Review.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => downloadFailedReport(uploadSummary.failedRows)}
                disabled={uploadSummary.failed === 0}
              >
                Download Failed Report
              </button>
              <button onClick={() => setShowSummaryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
