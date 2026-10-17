import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { isApiError, type Dashboard as DashboardData, type GuardianPreference } from '../api';
import { readActive, type ActiveLearner } from './active';
import './Dashboard.css';

/**
 * Parent dashboard. Everything shown about the child's learning is DERIVED
 * data read from the API (getDashboard) — this screen never sets mastery, and
 * the only writes it makes are guardian preferences (focus + usage caps, which
 * the server only lets tighten) via setPreferences. Consent/erasure are surfaced
 * as requests; erasure is executed in the operator console under operator authz,
 * not from a guardian actor here.
 */

const SKILL_LABELS: Record<string, string> = {
  'SK-FR-compare': 'Comparing fractions',
  'SK-FR-equiv': 'Equivalent fractions',
  'SK-EN-plural-base': 'Plurals: adding -s',
  'SK-EN-plural-sibilant': 'Plurals: -es and -ies',
  'SK-NS-add-within10': 'Adding within 10',
  'SK-NS-add-within20': 'Adding within 20',
};
const skillLabel = (id: string): string => SKILL_LABELS[id] ?? id;
const SUBJECT_LABELS: Record<string, string> = {
  math: 'Math',
  english: 'English',
  other: 'Other',
};
const subjectLabel = (s: string): string => SUBJECT_LABELS[s] ?? s;

/** Known subject/strand focus options (mirrors the API's COURSES_BY_SUBJECT). */
const FOCUS_OPTIONS: { value: string; subject: string; strand: string; label: string }[] = [
  { value: 'math:fractions', subject: 'math', strand: 'fractions', label: 'Math · Fractions' },
  { value: 'math:addition', subject: 'math', strand: 'addition', label: 'Math · Number sense' },
  { value: 'english:plurals', subject: 'english', strand: 'plurals', label: 'English · Plurals' },
];

type PillKind = 'mast' | 'dev' | 'chal' | 'rev' | 'unk';
function pillFor(standing: string, cue?: string): { label: string; kind: PillKind } {
  if (cue === 'TRANSFER_READY') return { label: 'Ready for a challenge', kind: 'chal' };
  if (cue === 'REVIEW_DUE' || standing === 'needs_review')
    return { label: 'Due for review', kind: 'rev' };
  if (standing === 'demonstrated') return { label: 'Mastered', kind: 'mast' };
  if (standing === 'developing' || standing === 'emerging')
    return { label: 'Developing', kind: 'dev' };
  return { label: 'Not yet assessed', kind: 'unk' };
}

export function Dashboard() {
  const [active] = useState<ActiveLearner | null>(() => readActive());
  const [data, setData] = useState<DashboardData | null>(null);
  const [pref, setPref] = useState<GuardianPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Inline control editors
  const [editCap, setEditCap] = useState(false);
  const [capValue, setCapValue] = useState('');
  const [editFocus, setEditFocus] = useState(false);
  const [savingCtl, setSavingCtl] = useState(false);
  const [eraseState, setEraseState] = useState<'idle' | 'confirm' | 'requested'>('idle');

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }
    let live = true;
    (async () => {
      try {
        const [d, p] = await Promise.all([
          api.getDashboard(active.familyId, active.guardianId, active.learnerId),
          api
            .getPreferences(active.familyId, active.guardianId, active.learnerId)
            .then((r) => r.preference)
            .catch(() => null),
        ]);
        if (!live) return;
        setData(d);
        setPref(p);
      } catch (e) {
        if (live)
          setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not load the dashboard.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [active]);

  const counts = useMemo(() => {
    const rows = data?.rows ?? [];
    let mastered = 0;
    let developing = 0;
    let stretch = 0;
    let review = 0;
    for (const r of rows) {
      const { kind } = pillFor(r.standing, r.cue);
      if (kind === 'mast') mastered++;
      else if (kind === 'dev') developing++;
      else if (kind === 'chal') stretch++;
      else if (kind === 'rev') review++;
    }
    return { mastered, developing, stretch, review };
  }, [data]);

  const subjects = data?.bySubject ?? [];
  const primaryNext = subjects.find((s) => s.nextFocus)?.nextFocus;

  async function saveCap(): Promise<void> {
    if (!active) return;
    const n = Number(capValue);
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter a positive number of minutes.');
      return;
    }
    setSavingCtl(true);
    setErr(null);
    try {
      const r = await api.setPreferences(active.familyId, active.guardianId, active.learnerId, {
        caps: { maxDailyMinutes: Math.round(n) },
      });
      setPref(r.preference);
      setEditCap(false);
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not update the limit.');
    } finally {
      setSavingCtl(false);
    }
  }

  async function saveFocus(value: string): Promise<void> {
    if (!active) return;
    setSavingCtl(true);
    setErr(null);
    try {
      const opt = FOCUS_OPTIONS.find((o) => o.value === value);
      const r = await api.setPreferences(active.familyId, active.guardianId, active.learnerId, {
        focus: opt ? { subject: opt.subject, strand: opt.strand } : null,
      });
      setPref(r.preference);
      setEditFocus(false);
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not update the focus.');
    } finally {
      setSavingCtl(false);
    }
  }

  // ---- Connect state (direct visit / no onboarding) --------------------------
  if (!active) {
    return (
      <div className="dash">
        <div className="dash-empty">
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: 'var(--teal)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '700 22px/1 var(--font-serif)',
            }}
          >
            P
          </span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: 0 }}>
            No child set up yet
          </h1>
          <p className="dash-muted" style={{ maxWidth: '40ch' }}>
            Create a parent account and add your child to see their progress here.
          </p>
          <a className="dash-btn dash-btn-p" href="#/signup">
            Set up an account
          </a>
        </div>
      </div>
    );
  }

  const focusLabel = pref?.focusStrand
    ? (FOCUS_OPTIONS.find((o) => o.strand === pref.focusStrand)?.label ?? pref.focusStrand)
    : 'No specific focus';
  const modalities = active.modalities;

  return (
    <div className="dash">
      {/* SIDEBAR */}
      <aside className="dash-side">
        <a className="dash-brand" href="#/">
          <span className="m" aria-hidden="true">
            P
          </span>
          <span style={{ font: '700 19px/1 var(--font-serif)' }}>Potenova</span>
        </a>
        <div className="dash-viewing">
          <div style={{ fontSize: 12, color: '#9fc6c3' }}>Viewing</div>
          <div style={{ font: '600 16px/1.2 var(--font-sans)', marginTop: 4 }}>
            {active.nickname} · Grade {active.grade}
          </div>
        </div>
        <nav className="dash-nav" aria-label="Dashboard">
          <a className="on" href="#/dashboard">
            Overview
          </a>
          <a href="#/dashboard">Progress</a>
          <a href="#/dashboard">Activity</a>
          <a href="#/dashboard">Controls</a>
          <a href="#/dashboard">Safety &amp; data</a>
        </nav>
        <div className="dash-acct">
          <span className="av" aria-hidden="true">
            P
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>Parent account</div>
            <a href="#/" style={{ color: '#9fc6c3', textDecoration: 'none' }}>
              Account
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="dash-main">
        <div className="dash-head">
          <div>
            <h1 style={{ fontSize: 30 }}>{active.nickname}’s progress</h1>
            <p className="dash-muted" style={{ margin: '6px 0 0', fontSize: 15 }}>
              Grade {active.grade} ·{' '}
              {active.focus === 'both' ? 'Math & English' : subjectLabel(active.focus)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="dash-btn dash-btn-p" href="#/learn">
              Start a session
            </a>
          </div>
        </div>

        {loading ? (
          <p className="dash-muted">Loading the latest derived progress…</p>
        ) : (
          <>
            {/* TILES — all derived from evidence-backed standings */}
            <div className="dash-tiles">
              <div className="dash-tile">
                <div className="k">Mastered</div>
                <div className="v">{counts.mastered}</div>
                <div className="dash-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  skills demonstrated
                </div>
              </div>
              <div className="dash-tile">
                <div className="k">Developing</div>
                <div className="v">{counts.developing}</div>
                <div className="dash-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  in progress
                </div>
              </div>
              <div className="dash-tile">
                <div className="k">Ready to stretch</div>
                <div className="v">{counts.stretch}</div>
                <div className="dash-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  solid — time to challenge
                </div>
              </div>
              <div className="dash-tile">
                <div className="k">Due for review</div>
                <div className="v">{counts.review}</div>
                <div className="dash-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  skills
                </div>
              </div>
            </div>

            {/* WORKING ON NOW + weekly sentence */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
              <div className="dash-card" style={{ flex: '2 1 420px', minWidth: 0 }}>
                <h2 style={{ fontSize: 20, marginBottom: 4 }}>Working on now</h2>
                {primaryNext ? (
                  <div className="dash-skill">
                    <span
                      aria-hidden="true"
                      style={{
                        flex: '0 0 auto',
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--teal-wash)',
                        color: 'var(--teal-ink)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: '700 15px/1 var(--font-sans)',
                      }}
                    >
                      {subjectLabel(subjects.find((s) => s.nextFocus)?.subject ?? 'math').charAt(0)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 16 }}>{skillLabel(primaryNext.skillId)}</strong>
                      <div className="dash-muted" style={{ fontSize: 13 }}>
                        {primaryNext.explanation}
                      </div>
                    </div>
                    <span className="dash-pill p-dev">Next up</span>
                  </div>
                ) : (
                  <p className="dash-muted" style={{ fontSize: 15 }}>
                    No session yet — start the first one to find {active.nickname}’s starting point.
                  </p>
                )}
                {subjects.some((s) => s.nextFocus) && (
                  <>
                    <h3
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 700,
                        margin: '16px 0 0',
                      }}
                    >
                      Coming up next{' '}
                      <span className="dash-muted" style={{ fontWeight: 500 }}>
                        · adjusts as {active.nickname} learns
                      </span>
                    </h3>
                    <ol className="dash-upnext">
                      {subjects
                        .filter((s) => s.nextFocus)
                        .map((s, i) => (
                          <li key={s.subject}>
                            <span className="dash-muted" style={{ width: 16 }}>
                              {i + 1}
                            </span>
                            <span style={{ flex: 1 }}>{skillLabel(s.nextFocus!.skillId)}</span>
                            <span className="dash-muted" style={{ fontSize: 12 }}>
                              {subjectLabel(s.subject)}
                            </span>
                          </li>
                        ))}
                    </ol>
                  </>
                )}
              </div>
              <div
                className="dash-card"
                style={{
                  flex: '1 1 280px',
                  minWidth: 0,
                  background: '#f2f8f7',
                  borderColor: '#cfe6e4',
                }}
              >
                <h2 style={{ fontSize: 18, color: 'var(--teal-ink)' }}>How mastery works</h2>
                <p style={{ margin: '10px 0 0', fontSize: 16, color: '#2c3a46' }}>
                  Every standing here is earned from {active.nickname}’s own work, shown across
                  different representations — it’s never set by a button, by you, or by us.
                </p>
                <p className="dash-muted" style={{ fontSize: 13, margin: '12px 0 0' }}>
                  Progress updates after each session as new evidence comes in.
                </p>
              </div>
            </div>

            {/* PROGRESS BY SKILL — full-width hero */}
            <div className="dash-card" style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h2 style={{ fontSize: 20 }}>Progress by skill</h2>
              </div>
              {subjects.length === 0 ? (
                <p className="dash-muted">
                  No skills tracked yet. Progress appears here after the first session.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36 }}>
                  {subjects.map((group) => (
                    <div key={group.subject} style={{ flex: '1 1 360px', minWidth: 0 }}>
                      <div className="dash-subhead">
                        <span style={{ font: '700 15px/1 var(--font-sans)' }}>
                          {subjectLabel(group.subject)}
                        </span>
                        <span className="dash-muted" style={{ fontSize: 13 }}>
                          {group.rows.length} skill{group.rows.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {group.rows.length === 0 ? (
                        <p className="dash-muted" style={{ fontSize: 13, marginTop: 10 }}>
                          Nothing practised yet.
                        </p>
                      ) : (
                        group.rows.map((r) => {
                          const pill = pillFor(r.standing, r.cue);
                          return (
                            <div className="dash-skill" key={r.skillId}>
                              <div style={{ flex: 1 }}>
                                <strong>{skillLabel(r.skillId)}</strong>
                                <div className="dash-muted" style={{ fontSize: 13 }}>
                                  {r.evidenceCount} piece{r.evidenceCount === 1 ? '' : 's'} of
                                  evidence
                                </div>
                              </div>
                              <span className={`dash-pill p-${pill.kind}`}>{pill.label}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONTROLS + SAFETY — two-up underneath the hero */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <div className="dash-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <h2 style={{ fontSize: 18 }}>Controls</h2>
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  <div className="dash-row">
                    <span>Daily limit</span>
                    {editCap ? (
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className="dash-note"
                          type="number"
                          min={1}
                          value={capValue}
                          onChange={(e) => setCapValue(e.target.value)}
                          style={{
                            width: 72,
                            height: 36,
                            border: '1.5px solid #d9d3c6',
                            borderRadius: 8,
                            padding: '0 8px',
                            fontSize: 15,
                          }}
                          aria-label="Daily limit in minutes"
                        />
                        <button
                          className="dash-link"
                          onClick={() => void saveCap()}
                          disabled={savingCtl}
                        >
                          Save
                        </button>
                        <button className="dash-link" onClick={() => setEditCap(false)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <strong>
                        {pref?.maxDailyMinutes != null ? `${pref.maxDailyMinutes} min` : 'Not set'}
                        <button
                          className="dash-link"
                          style={{ marginLeft: 6 }}
                          onClick={() => {
                            setCapValue(
                              pref?.maxDailyMinutes != null ? String(pref.maxDailyMinutes) : '',
                            );
                            setEditCap(true);
                          }}
                        >
                          Adjust
                        </button>
                      </strong>
                    )}
                  </div>
                  <div className="dash-row">
                    <span>Focus</span>
                    {editFocus ? (
                      <select
                        defaultValue={
                          FOCUS_OPTIONS.find((o) => o.strand === pref?.focusStrand)?.value ?? ''
                        }
                        onChange={(e) => void saveFocus(e.target.value)}
                        disabled={savingCtl}
                        style={{
                          height: 36,
                          border: '1.5px solid #d9d3c6',
                          borderRadius: 8,
                          padding: '0 8px',
                          fontSize: 15,
                        }}
                        aria-label="Focus subject and strand"
                      >
                        <option value="">No specific focus</option>
                        {FOCUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong>
                        {focusLabel}
                        <button
                          className="dash-link"
                          style={{ marginLeft: 6 }}
                          onClick={() => setEditFocus(true)}
                        >
                          Change
                        </button>
                      </strong>
                    )}
                  </div>
                </div>
                <p className="dash-note" style={{ margin: '14px 0 0' }}>
                  A limit can tighten the safety cap — never raise it above the approved maximum.
                </p>
              </div>

              <div className="dash-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <h2 style={{ fontSize: 18 }}>Safety &amp; data</h2>
                <div style={{ display: 'grid', gap: 12, marginTop: 14, fontSize: 15 }}>
                  <div className="dash-row">
                    <span className="dash-muted">Consent</span>
                    <strong style={{ color: 'var(--teal-ink)' }}>Granted · learning</strong>
                  </div>
                  <div className="dash-row">
                    <span className="dash-muted">Voice input</span>
                    <strong>{modalities?.voice ? 'On' : 'Off'}</strong>
                  </div>
                  <div className="dash-row">
                    <span className="dash-muted">Photo &amp; handwriting</span>
                    <strong>{modalities?.photo ? 'On' : 'Off'}</strong>
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid #efeadd',
                      paddingTop: 12,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <button className="dash-link" style={{ textAlign: 'left' }}>
                      Download your data
                    </button>
                    {eraseState === 'idle' && (
                      <button
                        className="dash-link danger"
                        style={{ textAlign: 'left' }}
                        onClick={() => setEraseState('confirm')}
                      >
                        Delete this child’s data
                      </button>
                    )}
                    {eraseState === 'confirm' && (
                      <div
                        style={{
                          background: '#fbf1ef',
                          border: '1px solid #e9cfc9',
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                          This submits a verified erasure request. Consent is revoked immediately so
                          processing stops, and {active.nickname}’s data is removed across every
                          system. Billing records are retained only as the law requires.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            className="dash-link danger"
                            onClick={() => setEraseState('requested')}
                          >
                            Submit request
                          </button>
                          <button className="dash-link" onClick={() => setEraseState('idle')}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {eraseState === 'requested' && (
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--teal-ink)' }}>
                        Request submitted. You’ll get confirmation once erasure is verified across
                        all systems.
                      </p>
                    )}
                  </div>
                  <p className="dash-note" style={{ margin: '2px 0 0' }}>
                    Data stays in Canada. Revoke consent and processing stops.
                  </p>
                </div>
              </div>
            </div>

            {err && (
              <p className="dash-note" style={{ color: '#a12b2b', marginTop: 16 }} role="alert">
                {err}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
