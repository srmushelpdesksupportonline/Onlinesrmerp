import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

// SVG icons — clean minimal line icons like Merritto
const Icons = {
  Admissions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Academics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  Faculty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M9 9h1M14 9h1M9 12h6"/>
    </svg>
  ),
  Finance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <path d="M1 10h22"/>
      <path d="M7 15h2M12 15h5"/>
    </svg>
  ),
  Tickets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
      <path d="M13 5v14M9 9h1M9 12h1M9 15h1"/>
    </svg>
  ),
  Menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ReReg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6"/>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
      <path d="M3 22v-6h6"/>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg>
  ),
};

const NAV = [
  {
    label: "Admissions",
    icon: Icons.Admissions,
    children: [
      { to: "/admissions", label: "Import Data" },
      { to: "/students",   label: "Students"    },
    ],
  },
  {
    label: "Academics",
    icon: Icons.Academics,
    children: [
      { to: "/academics",          label: "Overview"      },
      { to: "/academics/schemes",  label: "Course Master" },
      { to: "/academics/lms",      label: "LMS"           },
      { to: "/academics/ls",       label: "Live Sessions" },
      { to: "/academics/coursera", label: "Coursera"      },
    ],
  },
  {
    label: "Faculty",
    icon: Icons.Faculty,
    children: [
      { to: "/faculties", label: "Faculty List" },
    ],
  },
  {
    label: "Finance",
    icon: Icons.Finance,
    children: [
      { to: "/finance", label: "Finance" },
    ],
  },
  {
    label: "Tickets",
    icon: Icons.Tickets,
    children: [
      { to: "/tickets", label: "Tickets" },
    ],
  },
  {
    label: "Re-Registration",
    icon: Icons.ReReg,
    children: [
      { to: "/reregistration", label: "Re-Registration" },
    ],
  },
];

export default function Layout() {
  const location  = useLocation();
  const sidebarRef = useRef(null);

  // Start collapsed (icon-only mode)
  const [expanded, setExpanded] = useState(false);

  // Track which accordion sections are open
  const [openMenus, setOpenMenus] = useState(() => {
    const initial = {};
    NAV.forEach((item, i) => {
      if (item.children.some((c) => location.pathname.startsWith(c.to))) {
        initial[i] = true;
      }
    });
    return initial;
  });

  // Auto-expand on mouse enter left edge / sidebar, collapse on leave
  function handleMouseEnter() { setExpanded(true); }
  function handleMouseLeave() { setExpanded(false); }

  function toggleMenu(i) {
    setOpenMenus((prev) => ({ [i]: !prev[i] }));
  }

  function isParentActive(item) {
    return item.children.some((c) => location.pathname.startsWith(c.to));
  }

  return (
    <div className="app">
      {/* ── Hover zone on left edge when sidebar is collapsed ── */}
      {!expanded && (
        <div
          className="sidebar-edge-trigger"
          onMouseEnter={handleMouseEnter}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`sidebar ${expanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-logo">
            <span className="brand-logo-mark">S</span>
          </div>
          {expanded && (
            <div className="brand-text-block">
              <span className="brand-name">SRM Online</span>
              <span className="brand-sub">ERP</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            const isOpen   = !!openMenus[i];
            const isActive = isParentActive(item);

            return (
              <div key={i} className="nav-group">
                <button
                  className={[
                    "nav-parent",
                    isActive ? "nav-parent-active" : "",
                    isOpen && expanded ? "nav-parent-open" : "",
                  ].join(" ")}
                  onClick={() => {
                    if (!expanded) { setExpanded(true); }
                    toggleMenu(i);
                  }}
                  title={!expanded ? item.label : ""}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {expanded && (
                    <>
                      <span className="nav-label">{item.label}</span>
                      <span className={`nav-chevron ${isOpen ? "nav-chevron-open" : ""}`}>
                        {Icons.Chevron}
                      </span>
                    </>
                  )}
                  {/* Active dot when collapsed */}
                  {!expanded && isActive && <span className="nav-active-dot" />}
                </button>

                {/* Children — only when expanded */}
                {expanded && isOpen && (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === "/academics"}
                        className={({ isActive: a }) =>
                          "nav-child" + (a ? " nav-child-active" : "")
                        }
                      >
                        <span className="nav-child-dot" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {expanded && (
          <div className="sidebar-footer">
            <span>SRM University Sikkim</span>
          </div>
        )}
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
