import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Admissions from "./pages/Admissions.jsx";
import Students from "./pages/Students.jsx";
import AcademicsOverview from "./pages/academics/AcademicsOverview.jsx";
import CourseMaster from "./pages/academics/CourseMaster.jsx";
import AcademicsLMS from "./pages/academics/AcademicsLMS.jsx";
import AcademicsLS from "./pages/academics/AcademicsLS.jsx";
import AcademicsCoursera from "./pages/academics/AcademicsCoursera.jsx";
import Faculties from "./pages/Faculties.jsx";
import Finance from "./pages/Finance.jsx";
import Tickets from "./pages/Tickets.jsx";
import ReRegistration from "./pages/ReRegistration.jsx";
import ReRegisterForm from "./pages/ReRegisterForm.jsx";

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
        <Route path="/academics"          element={<AcademicsOverview />} />
        <Route path="/academics/schemes"  element={<CourseMaster />} />
        <Route path="/academics/lms"      element={<AcademicsLMS />} />
        <Route path="/academics/ls"       element={<AcademicsLS />} />
        <Route path="/academics/coursera" element={<AcademicsCoursera />} />
        <Route path="/faculties"         element={<Faculties />} />
        <Route path="/finance"           element={<Finance />} />
        <Route path="/tickets"           element={<Tickets />} />
        <Route path="/reregistration"    element={<ReRegistration />} />
        <Route path="*" element={<div style={{ padding: 24 }}>Page not found</div>} />
      </Route>
    </Routes>
  );
}
