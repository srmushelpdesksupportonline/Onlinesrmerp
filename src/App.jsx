import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Admissions from "./pages/Admissions.jsx";
import Students from "./pages/Students.jsx";
import CourseMaster from "./pages/academics/CourseMaster.jsx";
import Faculties from "./pages/Faculties.jsx";
import Tickets from "./pages/Tickets.jsx";


// Finance sub-pages
import FinanceOverview  from "./pages/finance/FinanceOverview.jsx";
import AcademicYears    from "./pages/finance/AcademicYears.jsx";
import FeeStructures    from "./pages/finance/FeeStructures.jsx";
import FeeAssignment    from "./pages/finance/FeeAssignment.jsx";
import GenerateFee      from "./pages/finance/GenerateFee.jsx";
import StudentOverview  from "./pages/finance/StudentOverview.jsx";

// Results sub-pages
import ResultUpload    from "./pages/results/ResultUpload.jsx";
import ResultByStudent from "./pages/results/ResultByStudent.jsx";
import ResultBySubject from "./pages/results/ResultBySubject.jsx";
import Grades          from "./pages/results/Grades.jsx";

export default function App() {
  return (
    <Routes>
      {/* Public route — no Layout (no sidebar) */}
      <Route path="/reregister/:token" element={<ReRegisterForm />} />

      {/* App routes — with Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/admissions" replace />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/students"   element={<Students />} />

        
        <Route path="/academics/schemes"  element={<CourseMaster />} />
       

        <Route path="/faculties" element={<Faculties />} />
        <Route path="/tickets"   element={<Tickets />} />

        {/* Finance — nested routes */}
        <Route path="/finance"                  element={<Navigate to="/finance/overview" replace />} />
        <Route path="/finance/overview"         element={<FinanceOverview />} />
        <Route path="/finance/academic-years"   element={<AcademicYears />} />
        <Route path="/finance/fee-structures"   element={<FeeStructures />} />
        <Route path="/finance/fee-assignment"   element={<FeeAssignment />} />
        <Route path="/finance/generate-fee"     element={<GenerateFee />} />
        <Route path="/finance/student-overview" element={<StudentOverview />} />

        {/* Results — nested routes */}
        <Route path="/results"              element={<Navigate to="/results/upload" replace />} />
        <Route path="/results/upload"       element={<ResultUpload />} />
        <Route path="/results/by-student"   element={<ResultByStudent />} />
        <Route path="/results/by-subject"   element={<ResultBySubject />} />
        <Route path="/results/grades"       element={<Grades />} />

        <Route path="/reregistration" element={<ReRegistration />} />
        <Route path="*" element={<div style={{ padding: 24 }}>Page not found</div>} />
      </Route>
    </Routes>
  );
}
