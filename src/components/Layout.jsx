import { useState, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

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
  Results: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
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
      { to: "/academics/schemes",  label: "Course Master" },
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
      { to: "/finance/overview",         label: "Overview"          },
      { to: "/finance/academic-years",   label: "Academic Years"    },
      { to: "/finance/fee-structures",   label: "Fee Structures"    },
      { to: "/finance/fee-assignment",   label: "Fee Assignment"    },
      { to: "/finance/generate-fee",     label: "Generate Fee"      },
      { to: "/finance/student-overview", label: "Student Overview"  },
    ],
  },
  {
    label: "Results",
    icon: Icons.Results,
    children: [
      { to: "/results/upload",     label: "Upload Results" },
      { to: "/results/by-student", label: "By Student"     },
      { to: "/results/by-subject", label: "By Subject"     },
      { to: "/results/grades",     label: "Grades"         },
    ],
  },
  {
    label: "Tickets",
    icon: Icons.Tickets,
    children: [
      { to: "/tickets", label: "Tickets" },
    ],
  },
];

export default function Layout() {
  const location   = useLocation();
  const sidebarRef = useRef(null);

  const [expanded,  setExpanded]  = useState(false);
  const [openMenus, setOpenMenus] = useState(() => {
    const initial = {};
    NAV.forEach((item, i) => {
      if (item.children.some(c => location.pathname.startsWith(c.to.split('/').slice(0, 2).join('/')))) {
        initial[i] = true;
      }
    });
    return initial;
  });

  function handleMouseEnter() { setExpanded(true);  }
  function handleMouseLeave() { setExpanded(false); }

  function toggleMenu(i) {
    setOpenMenus(prev => ({ [i]: !prev[i] }));
  }

  function isParentActive(item) {
    return item.children.some(c => location.pathname.startsWith(c.to.split('/').slice(0, 2).join('/')));
  }

  return (
    <div className="app">
      {!expanded && (
        <div className="sidebar-edge-trigger" onMouseEnter={handleMouseEnter} />
      )}

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
                    isActive            ? "nav-parent-active" : "",
                    isOpen && expanded  ? "nav-parent-open"   : "",
                  ].join(" ")}
                  onClick={() => {
                    if (!expanded) setExpanded(true);
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
                  {!expanded && isActive && <span className="nav-active-dot" />}
                </button>

                {expanded && isOpen && (
                  <div className="nav-children">
                    {item.children.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={({ isActive: a }) => "nav-child" + (a ? " nav-child-active" : "")}
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

        {expanded && (
          <div className="sidebar-footer">
            <span>SRM University Sikkim</span>
          </div>
        )}
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}