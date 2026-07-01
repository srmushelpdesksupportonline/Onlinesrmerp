import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFinanceOverviewSummary, formatINR } from '../../services/financeManagementService';

function KpiCard({ label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
        padding: '18px 22px', borderTop: `3px solid ${color || '#6366F1'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

export default function FinanceOverview() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFinanceOverviewSummary()
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 32, color: '#6B7280', fontSize: 14 }}>Loading overview…</div>
  );

  if (error) return (
    <div style={{ padding: 32, color: '#DC2626', fontSize: 14 }}>Error: {error}</div>
  );

  const collectionPct = summary.total_net_fee > 0
    ? Math.round((summary.total_collected / summary.total_net_fee) * 100)
    : 0;

  return (
    <div style={{ padding: 28, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Finance Overview</h2>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
          Active Academic Year: <strong>{summary.active_academic_year}</strong>
        </div>
      </div>

      {/* Primary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Total Students"
          value={summary.total_students}
          color="#6366F1"
          onClick={() => navigate('/finance/student-overview')}
          sub="Click to view Student Overview"
        />
        <KpiCard
          label="Total Net Fee"
          value={formatINR(summary.total_net_fee)}
          color="#0EA5E9"
        />
        <KpiCard
          label="Total Collected"
          value={formatINR(summary.total_collected)}
          color="#10B981"
          sub={`${summary.completed_count} fully paid · ${summary.partial_count} partial`}
        />
        <KpiCard
          label="Total Outstanding"
          value={formatINR(summary.total_outstanding)}
          color="#F59E0B"
          sub={`${summary.pending_count} pending · ${summary.partial_count} partial`}
        />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard
          label="Active Fee Blocks"
          value={`${summary.active_blocks} / ${summary.total_blocks}`}
          color="#8B5CF6"
          onClick={() => navigate('/finance/fee-structures')}
          sub="Click to manage Fee Structures"
        />
        <KpiCard
          label="Generated Fees — Total"
          value={formatINR(summary.generated_fees_total)}
          color="#EC4899"
          sub={`${summary.generated_fees_unpaid} unpaid invoices`}
          onClick={() => navigate('/finance/generate-fee')}
        />
        <KpiCard
          label="Generated Fees — Collected"
          value={formatINR(summary.generated_fees_paid)}
          color="#14B8A6"
        />
      </div>

      {/* Collection progress */}
      <SectionCard title="Overall Fee Collection Progress">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
          <span>{formatINR(summary.total_collected)} collected</span>
          <span>{collectionPct}%</span>
        </div>
        <div style={{ height: 12, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${collectionPct}%`,
            background: 'linear-gradient(90deg, #6366F1, #10B981)',
            borderRadius: 6,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: 13 }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>● {summary.completed_count} Fully Paid</span>
          <span style={{ color: '#1E40AF', fontWeight: 600 }}>● {summary.partial_count} Partial</span>
          <span style={{ color: '#854D0E', fontWeight: 600 }}>● {summary.pending_count} Pending</span>
        </div>
      </SectionCard>

      {/* Quick links */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '+ Add Academic Year',  to: '/finance/academic-years' },
          { label: '+ Create Fee Block',   to: '/finance/fee-structures' },
          { label: 'Assign Fees',          to: '/finance/fee-assignment' },
          { label: 'Generate Fees',        to: '/finance/generate-fee'   },
        ].map(link => (
          <button
            key={link.to}
            onClick={() => navigate(link.to)}
            style={{
              background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8,
              padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: '#374151', textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151'; }}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
