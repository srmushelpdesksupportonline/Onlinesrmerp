import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/admissions", label: "Admissions" },
  { to: "/academics", label: "Academics" },
  { to: "/students", label: "Students" },
  { to: "/faculties", label: "Faculties" },
  { to: "/finance", label: "Finance" },
  { to: "/tickets", label: "Tickets" },
];

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">SRM Online ERP</div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
