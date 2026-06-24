import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchRecordByToken,
  fetchGroupsForProgram,
  submitReregistrationForm,
  requiresElectiveSelection,
  semesterLabel,
} from '../services/reregistrationService';

const CHOICES = [
  {
    id:    'continue',
    title: 'Continue to next semester',
    desc:  'I want to proceed to the next semester of my program.',
    icon:  '✅',
    color: '#2d3a0e',
    bg:    '#f0fdf4',
    border:'#bbf7d0',
  },
  {
    id:    'break',
    title: 'Take a 6-month break',
    desc:  'I want to pause my studies for one semester and resume later.',
    icon:  '⏸️',
    color: '#92400e',
    bg:    '#fefce8',
    border:'#fde68a',
  },
  {
    id:    'repeat',
    title: 'Repeat current semester',
    desc:  'I want to continue on the same semester to clear my subjects.',
    icon:  '🔁',
    color: '#5b21b6',
    bg:    '#f5f3ff',
    border:'#ddd6fe',
  },
];

export default function ReRegisterForm() {
  const { token } = useParams();

  const [record,   setRecord]   = useState(null);
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expired,  setExpired]  = useState(false);
  const [invalid,  setInvalid]  = useState(false);
  const [submitted,setSubmitted]= useState(false);

  const [choice,        setChoice]        = useState('');
  const [electiveId,    setElectiveId]    = useState('');
  const [breakReason,   setBreakReason]   = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    async function load() {
      try {
        const rec = await fetchRecordByToken(token);
        if (!rec) { setInvalid(true); return; }

        // Check deadline
        const today    = new Date().toISOString().split('T')[0];
        const deadline = rec.reregistration_batches?.deadline;
        if (deadline && today > deadline) { setExpired(true); setRecord(rec); return; }

        // Already submitted
        if (rec.form_status === 'submitted') { setSubmitted(true); setRecord(rec); return; }

        setRecord(rec);

        // Load elective groups if needed
        const prog    = rec.student_master?.programs?.program_code;
        const nextSem = rec.reregistration_batches?.target_semester;
        if (prog && requiresElectiveSelection(prog, nextSem)) {
          const g = await fetchGroupsForProgram(prog);
          setGroups(g);
        }
      } catch (e) {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleSubmit() {
    if (!choice) { setError('Please select one of the options below.'); return; }
    const prog    = record?.student_master?.programs?.program_code;
    const nextSem = record?.reregistration_batches?.target_semester;
    if (choice === 'continue' && requiresElectiveSelection(prog, nextSem) && !electiveId) {
      setError('Please select your specialisation group.'); return;
    }
    if (choice === 'break' && !breakReason.trim()) {
      setError('Please provide a reason for the break.'); return;
    }
    setSubmitting(true); setError('');
    try {
      await submitReregistrationForm({
        token,
        choice,
        electiveGroupId: electiveId ? Number(electiveId) : null,
        breakReason:     breakReason || null,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const student    = record?.student_master;
  const batch      = record?.reregistration_batches;
  const nextSem    = batch?.target_semester;
  const prog       = student?.programs?.program_code;
  const deadline   = batch?.deadline ? new Date(batch.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const needElect  = choice === 'continue' && requiresElectiveSelection(prog, nextSem);
  const feePaid    = record?.fee_paid_at_send;

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) return (
    <Page>
      <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading your form…
      </div>
    </Page>
  );

  if (invalid) return (
    <Page>
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1f0c', marginBottom: 8 }}>Invalid Link</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>This re-registration link is invalid or does not exist.<br />Please contact your student coordinator.</div>
      </div>
    </Page>
  );

  if (expired) return (
    <Page>
      <StudentHeader student={student} nextSem={nextSem} deadline={deadline} />
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>Form Expired</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>The re-registration deadline has passed.<br />Please contact your student coordinator for assistance.</div>
      </div>
    </Page>
  );

  if (submitted) return (
    <Page>
      <StudentHeader student={student} nextSem={nextSem} deadline={deadline} />
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Re-Registration Submitted!</div>
        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
          Thank you, <strong>{student?.full_name}</strong>. Your re-registration response has been recorded.
          {record?.choice === 'continue' && (
            <><br /><br />You have chosen to <strong>continue to Semester {nextSem}</strong>. Your semester will be updated once the registration cycle is complete.</>
          )}
          {record?.choice === 'break' && (
            <><br /><br />Your request for a <strong>6-month break</strong> has been noted. Our team will get in touch with you.</>
          )}
          {record?.choice === 'repeat' && (
            <><br /><br />Your request to <strong>repeat the current semester</strong> has been noted.</>
          )}
        </div>
        <div style={{ marginTop: 24, fontSize: 13, color: '#9ca3af' }}>You may close this window.</div>
      </div>
    </Page>
  );

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <Page>
      <StudentHeader student={student} nextSem={nextSem} deadline={deadline} />

      {/* Payment section */}
      {!feePaid && (
        <div style={{ background: '#fff8e6', border: '1px solid #f0d080', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>💳 Semester Fee Payment Required</div>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: '#78350f', lineHeight: 1.6 }}>
            Please pay your <strong>Semester {nextSem}</strong> fee before completing this form.
            Click the button below to pay securely via OrangePay.
          </p>
          <a
            href={`https://pay.orangepay.in/srmus?enrollment=${student?.enrollment_no}&semester=${nextSem}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-block', background: '#c8a84b', color: '#1a1f0c', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 8, textDecoration: 'none' }}
          >
            Pay Semester Fee →
          </a>
        </div>
      )}

      {feePaid && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>✓ Semester {nextSem} fee has been paid</div>
        </div>
      )}

      {/* Choice selection */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f0c', marginBottom: 12 }}>
          Please select your choice for Semester {nextSem}:
        </div>
        {CHOICES.map(c => (
          <div
            key={c.id}
            onClick={() => { setChoice(c.id); setError(''); }}
            style={{
              border: `2px solid ${choice === c.id ? c.color : '#e5e7eb'}`,
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 10,
              cursor: 'pointer',
              background: choice === c.id ? c.bg : '#fff',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: choice === c.id ? c.color : '#1a1f0c', marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{c.desc}</div>
            </div>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', border: `2px solid ${choice === c.id ? c.color : '#d1d5db'}`,
              background: choice === c.id ? c.color : '#fff', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {choice === c.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Break reason */}
      {choice === 'break' && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6 }}>
            Reason for break *
          </label>
          <textarea
            value={breakReason}
            onChange={e => setBreakReason(e.target.value)}
            rows={3}
            placeholder="Please briefly explain why you need a 6-month break…"
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {/* Elective selection */}
      {needElect && groups.length > 0 && (
        <div style={{ marginBottom: 20, background: '#f0f2e8', border: '1px solid #e8ead4', borderRadius: 10, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#2d3a0e', marginBottom: 4 }}>
            Select your Specialisation Group *
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
            You are registering for Semester {nextSem}. Please choose your specialisation group.
            <strong> This cannot be changed later.</strong>
          </div>
          {groups.map(g => (
            <div
              key={g.id}
              onClick={() => setElectiveId(String(g.id))}
              style={{
                border: `2px solid ${electiveId === String(g.id) ? '#2d3a0e' : '#d1d5db'}`,
                borderRadius: 8, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
                background: electiveId === String(g.id) ? '#f0fdf4' : '#fff',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${electiveId === String(g.id) ? '#2d3a0e' : '#d1d5db'}`,
                background: electiveId === String(g.id) ? '#2d3a0e' : '#fff',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {electiveId === String(g.id) && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1f0c' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Group {g.group_code}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !choice}
        style={{
          width: '100%', background: choice ? '#2d3a0e' : '#d1d5db', color: '#fff',
          border: 'none', padding: '14px', borderRadius: 10, fontWeight: 700,
          fontSize: 15, cursor: choice ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit Re-Registration →'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        Deadline: {deadline} · For help: studentcare.online@srmus.edu.in
      </div>
    </Page>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function Page({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f0', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Brand header */}
      <div style={{ maxWidth: 580, margin: '0 auto 0' }}>
        <div style={{ background: '#2d3a0e', borderRadius: '12px 12px 0 0', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#c8a84b,#b8960c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#2d3a0e' }}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>SRM University Sikkim</div>
            <div style={{ fontSize: 11, color: '#b8c8a0' }}>Centre for Distance and Online Education</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function StudentHeader({ student, nextSem, deadline }) {
  if (!student) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1a1f0c' }}>
        Re-Registration — Semester {nextSem}
      </h2>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Please complete this form before <strong style={{ color: '#dc2626' }}>{deadline}</strong>
      </div>
      <div style={{ background: '#f8f9f4', border: '1px solid #e8ead4', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['Name',          student.full_name],
              ['Enrollment No', student.enrollment_no],
              ['Program',       student.programs?.program_name || student.program_name],
              ['Registering for', `${semesterLabel(nextSem)} Semester`],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '3px 12px 3px 0', color: '#6b7280', width: 130 }}>{label}</td>
                <td style={{ padding: '3px 0', fontWeight: 600, color: '#1a1f0c' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
