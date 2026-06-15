import { useState } from "react";
import { themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";



ModuleRegistry.registerModules([
  AllCommunityModule,
]);

export default function Admissions() {
  const [rowData] = useState([
  {
    application_no: "APP001",
    full_name: "John Doe",
    course: "MBA",
    intake: "JUL",
    personal_email: "john@example.com",
    mobile_number: "9876543210",
    crm_push_status: "Success",
    enrollment_no: "",
    official_email: "",
    email_activation_status: "",
    enrollment_status: "Pending",
  },
  {
    application_no: "APP002",
    full_name: "Jane Smith",
    course: "MCA",
    intake: "JAN",
    personal_email: "jane@example.com",
    mobile_number: "9876543211",
    crm_push_status: "Success",
    enrollment_no: "26MBA00001",
    official_email: "jane.smith@srmistonline.edu.in",
    email_activation_status: "Activated",
    enrollment_status: "Enrolled",
  },
]);

  const [columnDefs] = useState([
  {
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
]);

  return (
    <div>
      <h1>Admissions</h1>

      {/* KPI Cards */}
      <div className="dashboard-cards">
        <div className="card">
          <h2>1248</h2>
          <p>Total Records</p>
        </div>

        <div className="card">
          <h2>325</h2>
          <p>Ready For Enrollment</p>
        </div>

        <div className="card">
          <h2>923</h2>
          <p>Enrolled</p>
        </div>

        <div className="card">
          <h2>148</h2>
          <p>Pending Review</p>
        </div>
      </div>

      {/* Toolbar */}
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

        <button>Upload Raw Data</button>
        <button>Generate Enrollment Numbers</button>
        <button>Enroll Selected</button>
      </div>

      {/* AG Grid */}
      <div
  style={{
    height: "650px",
    width: "100%",
    marginTop: "20px"
  }}
>
  <AgGridReact
    theme={themeQuartz}
    rowData={rowData}
    columnDefs={columnDefs}
    pagination={true}
    paginationPageSize={50}
  />
</div>
    </div>
  );
}