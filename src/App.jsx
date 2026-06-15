import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Admissions from "./pages/Admissions.jsx";
import Academics from "./pages/Academics.jsx";
import Students from "./pages/Students.jsx";
import Faculties from "./pages/Faculties.jsx";
import Finance from "./pages/Finance.jsx";
import Tickets from "./pages/Tickets.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/admissions" replace />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/academics" element={<Academics />} />
        <Route path="/students" element={<Students />} />
        <Route path="/faculties" element={<Faculties />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
      </Route>
    </Routes>
  );
}
