import { useState,useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import * as XLSX from "xlsx";
import {
  getExistingAdmissions,
  getExistingStudents,
  insertAdmissions
} from "../services/admissionsService";

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
  checkboxSelection: true,
  headerCheckboxSelection: true,
  width: 60,
    },
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
const generateUsername = (fullName) => {

  const parts = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/);

  const nonInitials =
    parts.filter(
      part => part.length > 1
    );

  if (nonInitials.length === 0) {
    return "";
  }

  const firstName =
    nonInitials[0];

  // First name has 4 or more characters
  if (firstName.length >= 4) {
    return firstName;
  }

  // First name less than 4 characters
  if (nonInitials.length > 1) {
    return (
      firstName +
      nonInitials[
        nonInitials.length - 1
      ]
    );
  }

  return firstName;
};
const generateOfficialEmail = (
  fullName,
  program,
  intake,
  academicYear
) => {

  const username =
    generateUsername(fullName);

  const yearCode =
    academicYear.substring(2, 4);

  return (
    username +
    "." +
    program.toLowerCase() +
    intake.toLowerCase() +
    yearCode +
    "@srmus.edu.in"
  );
};
const generatePassword = (
  fullName
) => {

  const username =
    generateUsername(fullName);

  return (
    username.charAt(0)
      .toUpperCase() +
    username.slice(1) +
    "@123"
  );
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

    reader.onload = async (e) => {

  let data;

  if (extension === "csv") {

    const csvText = e.target.result;

    const workbook = XLSX.read(
      csvText,
      { type: "string" }
    );

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    data =
      XLSX.utils.sheet_to_json(
        sheet
      );

  } else {

    const workbook = XLSX.read(
      e.target.result,
      { type: "array" }
    );

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    data =
      XLSX.utils.sheet_to_json(
        sheet
      );

  }

  // WE WILL ADD CODE HERE
  const admissions =
  await getExistingAdmissions();

const students =
  await getExistingStudents();

console.log(
  "Admissions:",
  admissions
);

console.log(
  "Students:",
  students
);

      const enrollmentNumbers =
  generateEnrollmentNumbers(
    data,
    intake,
    academicYear
  );

const mappedData =
  data.map(
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
          rowSelection="multiple"
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