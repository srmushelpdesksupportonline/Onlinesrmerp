import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const TICKET_SCHEMA_SQL = `
-- Run this in Supabase SQL Editor if table doesn't exist
CREATE TABLE IF NOT EXISTS support_tickets (
  id              BIGSERIAL PRIMARY KEY,
  ticket_no       VARCHAR(20) NOT NULL UNIQUE,
  enrollment_no   VARCHAR(20),
  student_name    VARCHAR(200),
  program_name    VARCHAR(150),
  subject         VARCHAR(300) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),   -- 'ACADEMIC' | 'FINANCE' | 'TECHNICAL' | 'GENERAL'
  priority        VARCHAR(20) DEFAULT 'MEDIUM',  -- LOW | MEDIUM | HIGH | URGENT
  status          VARCHAR(20) DEFAULT 'OPEN',    -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
  assigned_to     VARCHAR(100),
  resolution      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
`;

const CATEGORIES = ['All','ACADEMIC','FINANCE','TECHNICAL','GENERAL'];
const STATUSES   = ['All','OPEN','IN_PROGRESS','RESOLVED','CLOSED'];
const PRIORITIES = ['LOW','MEDIUM','HIGH','URGENT'];

const PRIORITY_COLORS = {
  LOW:    { bg: '#F3F4F6', text: '#6B7280' },
  MEDIUM: { bg: '#FEF9C3', text: '#854D0E' },
  HIGH:   { bg: '#FEF2F2', text: '#DC2626' },
  URGENT: { bg: '#DC2626', text: '#fff'    },
};

const STATUS_COLORS = {
  OPEN:        { bg: '#DBEAFE', text: '#1E40AF' },
  IN_PROGRESS: { bg: '#FEF9C3', text: '#854D0E' },
  RESOLVED:    { bg: '#DCFCE7', text: '#166534' },
  CLOSED:      { bg: '#F3F4F6', text: '#6B7280' },
};

function Badge({ value, map }) {
  const c = map[value] || { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 11 }}>
      {value || '—'}
    </span>
  );
}

function NewTicketModal({ onClose, onDone }) {
  const [form, setForm] = useState({
    enrollment_no: '', student_name: '', program_name: '', subject: '',
    description: '', category: 'GENERAL', priority: 'MEDIUM',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.subject.trim()) { setError('Subject is required.'); return; }
    setSaving(true); setError('');
    try {
      const ticket_no = 'TKT' + Date.now().toString().slice(-8);
      const { error: e } = await supabase.from('support_tickets').insert({
        ticket_no,
        enrollment_no: form.enrollment_no || null,
        student_name:  form.student_name  || null,
        program_name:  form.program_name  || null,
        subject:       form.subject,
        description:   form.description   || null,
        category:      form.category,
        priority:      form.priority,
        status:        'OPEN',
      });
      if (e) throw e;
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>New Support Ticket</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        {[
          { label: 'Enrollment No', key: 'enrollment_no', placeholder: 'EMB22600001' },
          { label: 'Student Name',  key: 'student_name',  placeholder: 'Full name' },
          { label: 'Program',       key: 'program_name',  placeholder: 'MBA / MCA / BBA / BCA' },
          { label: 'Subject *',     key: 'subject',       placeholder: 'Brief description of the issue' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
            placeholder="Detailed description of the issue…"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }}>
              {['ACADEMIC','FINANCE','TECHNICAL','GENERAL'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#fff', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: '#1D4ED8', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tickets() {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [filterCat,    setFilterCat]    = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchText,   setSearchText]   = useState('');
  const [showNew,      setShowNew]      = useState(false);
  const [tableExists,  setTableExists]  = useState(true);

  useEffect(() => { loadTickets(); }, [filterCat, filterStatus]);

  async function loadTickets() {
    setLoading(true);
    try {
      let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
      if (filterCat    !== 'All') query = query.eq('category', filterCat);
      if (filterStatus !== 'All') query = query.eq('status',   filterStatus);
      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') setTableExists(false);
        throw error;
      }
      setTickets(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function updateStatus(id, status) {
    const update = { status };
    if (status === 'RESOLVED') update.resolved_at = new Date().toISOString();
    await supabase.from('support_tickets').update(update).eq('id', id);
    loadTickets();
  }

  const filtered = tickets.filter(t => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return t.ticket_no?.toLowerCase().includes(q) || t.student_name?.toLowerCase().includes(q) ||
           t.subject?.toLowerCase().includes(q)   || t.enrollment_no?.toLowerCase().includes(q);
  });

  const stats = {
    total:       tickets.length,
    open:        tickets.filter(t => t.status === 'OPEN').length,
    in_progress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved:    tickets.filter(t => t.status === 'RESOLVED').length,
  };

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Support Tickets</h2>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Student support requests and resolutions</div>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#1D4ED8', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + New Ticket
        </button>
      </div>

      {/* Table doesn't exist warning */}
      {!tableExists && (
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13 }}>
          <strong>Table not found.</strong> Run the following SQL in Supabase SQL Editor to create the tickets table:
          <pre style={{ background: '#1F2937', color: '#F9FAFB', padding: 12, borderRadius: 8, fontSize: 11, marginTop: 8, overflowX: 'auto', userSelect: 'text' }}>{TICKET_SCHEMA_SQL.trim()}</pre>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Tickets', value: stats.total,       color: '#6366F1' },
          { label: 'Open',          value: stats.open,        color: '#0EA5E9' },
          { label: 'In Progress',   value: stats.in_progress, color: '#F59E0B' },
          { label: 'Resolved',      value: stats.resolved,    color: '#10B981' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search ticket / student / subject…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', width: 280 }}
        />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }}>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace('_', ' ')}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tickets Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Ticket No','Student','Program','Subject','Category','Priority','Status','Created','Action'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎫</div>
                <div>No tickets found</div>
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }} onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D4ED8', userSelect: 'text', cursor: 'text' }}>{t.ticket_no}</td>
                <td style={{ padding: '12px 14px', userSelect: 'text', cursor: 'text' }}>
                  <div style={{ fontWeight: 600 }}>{t.student_name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{t.enrollment_no || ''}</div>
                </td>
                <td style={{ padding: '12px 14px', color: '#6B7280' }}>{t.program_name || '—'}</td>
                <td style={{ padding: '12px 14px', maxWidth: 240 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>{t.subject}</div>
                  {t.description && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description.slice(0, 60)}…</div>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: '#F0F9FF', color: '#0369A1', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{t.category}</span>
                </td>
                <td style={{ padding: '12px 14px' }}><Badge value={t.priority} map={PRIORITY_COLORS} /></td>
                <td style={{ padding: '12px 14px' }}><Badge value={t.status} map={STATUS_COLORS} /></td>
                <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <select
                    value={t.status}
                    onChange={e => updateStatus(t.id, e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, outline: 'none', cursor: 'pointer' }}
                  >
                    {['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onDone={() => { setShowNew(false); loadTickets(); }}
        />
      )}
    </div>
  );
}
