export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <div className="kpi-grid">
        <div className="card">
          <h3>Total Students</h3>
          <p>5,842</p>
        </div>

        <div className="card">
          <h3>Active Students</h3>
          <p>5,120</p>
        </div>

        <div className="card">
          <h3>Pending Admissions</h3>
          <p>148</p>
        </div>

        <div className="card">
          <h3>Open Tickets</h3>
          <p>32</p>
        </div>
      </div>
    </div>
  );
}