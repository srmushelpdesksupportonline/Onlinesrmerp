import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import * as XLSX from "xlsx";

ModuleRegistry.registerModules([
  AllCommunityModule,
]);

export default function Admissions() {

  const [rowData, setRowData] = useState([]);

  const [showUploadModal, setShowUploadModal] =
    useState(false);

  const [academicYear, setAcademicYear] =
    useState("");

  const [intake, setIntake] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [columnDefs] = useState([
    {
      headerName: "Application No",
      field: "application_no",
      flex: 1,
    },
    {
      headerName: "Student Name",
      field: "full_name",
      flex: 2,
    },
    {
      headerName: "Program",
      field: "course",
      flex: 1,
    },
    {
      headerName: "Intake",
      field: "intake",
      flex: 1,
    },
    {
      headerName: "Email",
      field: "personal_email",
      flex: 2,
    },
    {
      headerName: "Mobile",
      field: "mobile_number",
      flex: 1,
    },
    {
      headerName: "CRM Push Status",
      field: "crm_push_status",
      flex: 1,
    },
    {
      headerName: "Enrollment No",
      field: "enrollment_no",
      flex: 1,
    },
    {
      headerName: "Official Email",
      field: "official_email",
      flex: 2,
    },
    {
      headerName: "Email Status",
      field: "email_activation_status",
      flex: 1,
    },
    {
      headerName: "Enrollment Status",
      field: "enrollment_status",
      flex: 1,
    },
    
  ]

);
const generateEnrollmentNumbers = (
  rawData,
  intake,
  academicYear
) => {

  const programCodes = {
    MBA: "MB",
    MCA: "MC",
    BBA: "BB",
    BCA: "BC",
  };

  const sessionCode =
    intake === "JAN" ? "1" : "2";

  const yearCode =
    academicYear.substring(2, 4);

  const counters = {};

  return rawData.map((row) => {

    const program =
      row["Program Applied For"] ||
      row["Course"] ||
      "";

    if (!counters[program]) {
      counters[program] = 1;
    }

    const serial =
      String(
        counters[program]
      ).padStart(4, "0");

    counters[program]++;

    return (
      "E" +
      (programCodes[program] || "XX") +
      sessionCode +
      yearCode +
      "0" +
      serial
    );

  });
};
  const handleUpload = () => {

    console.log("UPLOAD CLICKED");

    if (!academicYear) {
      alert("Please select Academic Year");
      return;
    }

    if (!intake) {
      alert("Please select Intake");
      return;
    }

    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    const extension =
      selectedFile.name
        .split(".")
        .pop()
        .toLowerCase();

    const reader = new FileReader();

    reader.onload = (e) => {

      let rawData = [];

      if (extension === "csv") {

        const workbook =
          XLSX.read(
            e.target.result,
            { type: "string" }
          );

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        rawData =
          XLSX.utils.sheet_to_json(
            sheet
          );

      } else {

        const workbook =
          XLSX.read(
            e.target.result,
            { type: "array" }
          );

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        rawData =
          XLSX.utils.sheet_to_json(
            sheet
          );
      }

      console.log(rawData);

      const enrollmentNumbers =
  generateEnrollmentNumbers(
    rawData,
    intake,
    academicYear
  );

const mappedData =
  rawData.map(
    (row, index) => ({

          application_no:
            row["Application No"] || "",

          full_name:
            row["Full Name As Per Your 10th Marksheet"] ||
            row["Full Name"] ||
            "",

          course:
            row["Program Applied For"] ||
            row["Course"] ||
            "",

          intake: intake,

          personal_email:
            row["Email ID"] || "",

          mobile_number:
            row["Mobile Number"] || "",

          crm_push_status:
            "Pending",

          enrollment_no: enrollmentNumbers[index],

          official_email:
            "",

          email_activation_status:
            "",

          enrollment_status:
            "Generated",
        }));

      setRowData(mappedData);

      setShowUploadModal(false);

      alert(
        `${mappedData.length} records imported successfully`
      );
    };

    if (extension === "csv") {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  return (
    <div>

      <h1>Admissions / Raw Data</h1>

      <div className="dashboard-cards">

        <div className="card">
          <h2>{rowData.length}</h2>
          <p>Total Records</p>
        </div>

        <div className="card">
          <h2>0</h2>
          <p>Ready For Enrollment</p>
        </div>

        <div className="card">
          <h2>0</h2>
          <p>Enrolled</p>
        </div>

        <div className="card">
          <h2>0</h2>
          <p>Pending Review</p>
        </div>

      </div>

      <div className="toolbar">

        <select>
          <option>All Programs</option>
          <option>MBA</option>
          <option>MCA</option>
          <option>BBA</option>
          <option>BCA</option>
        </select>

        <input
          type="search"
          placeholder="Search Student"
        />

        <button
          onClick={() =>
            setShowUploadModal(true)
          }
        >
          Upload Raw Data
        </button>

        <button>
          Generate Enrollment Numbers
        </button>

        <button>
          Enroll Selected
        </button>

      </div>

      <div
        style={{
          height: "650px",
          width: "100%",
          marginTop: "20px",
        }}
      >
        <AgGridReact
          theme={themeQuartz}
          rowData={rowData}
          columnDefs={columnDefs}
          pagination
          paginationPageSize={50}
        />
      </div>

      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">

            <h2>
              Import Admissions Data
            </h2>

            <div className="form-group">

              <label>
                Academic Year
              </label>

              <select
                value={academicYear}
                onChange={(e) =>
                  setAcademicYear(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Academic Year
                </option>

                <option value="2026-27">
                  2026-27
                </option>

                <option value="2027-28">
                  2027-28
                </option>
              </select>

            </div>

            <div className="form-group">

              <label>Intake</label>

              <select
                value={intake}
                onChange={(e) =>
                  setIntake(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Intake
                </option>

                <option value="JAN">
                  January
                </option>

                <option value="JUL">
                  July
                </option>
              </select>

            </div>

            <div className="form-group">

              <label>
                Excel / CSV File
              </label>

              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setSelectedFile(
                    e.target.files[0]
                  )
                }
              />

            </div>

            <div className="modal-actions">

              <button
                onClick={handleUpload}
              >
                Upload
              </button>

              <button
                onClick={() =>
                  setShowUploadModal(
                    false
                  )
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}