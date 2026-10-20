import { useEffect, useState } from 'react';
import * as api from './api';
import { isApiError } from './api';
import {
  bandForGrade,
  confidencePct,
  standingLabel,
  standingTone,
  reasonCodeLabel,
  usageDecisionLabel,
  minutesLabel,
  policyState,
  modelStatusTone,
} from './format';

/** Parent-friendly labels for every skill the UI may surface. */
const SKILL_LABELS: Record<string, string> = {
  'SK-FR-compare': 'Comparing fractions',
  'SK-FR-equiv': 'Equivalent fractions',
  'SK-EN-plural-base': 'Plurals: adding -s',
  'SK-EN-plural-sibilant': 'Plurals: -es and -ies',
  'SK-NS-add-within10': 'Adding within 10',
  'SK-NS-add-within20': 'Adding within 20',
};
const skillLabel = (id: string): string => SKILL_LABELS[id] ?? id;
const SUBJECT_LABELS: Record<string, string> = { math: 'Math', english: 'English', other: 'Other' };
const subjectLabel = (s: string): string => SUBJECT_LABELS[s] ?? s;
const STRAND_LABELS: Record<string, string> = {
  fractions: 'Fractions',
  addition: 'Addition (number sense)',
  plurals: 'Plurals',
};
const strandLabel = (s: string): string => STRAND_LABELS[s] ?? s;
/** Strands available per subject (mirrors the API's COURSES_BY_SUBJECT). */
const STRANDS: Record<'math' | 'english', string[]> = {
  math: ['fractions', 'addition'],
  english: ['plurals'],
};
const CUE_LABELS: Record<string, string> = {
  REVIEW_DUE: 'Due for review',
  TRANSFER_READY: 'Ready for a challenge',
};

interface Family {
  familyId: string;
  guardianId: string;
  consentGiven: boolean;
}
interface Learner {
  learnerId: string;
  nickname: string;
  grade: number;
}

type Note = { kind: 'ok' | 'err'; text: string };
type Tab = 'parent' | 'child' | 'operator' | 'admin';

export function Console() {
  const [tab, setTab] = useState<Tab>('parent');
  const [ready, setReady] = useState<{ text: string; ok: boolean | null }>({
    text: 'Connecting to the API…',
    ok: null,
  });
  const [family, setFamily] = useState<Family | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);

  useEffect(() => {
    api
      .readiness()
      .then((r) =>
        setReady({
          text: `API ready · ${r.environment} · ${r.primaryRegion} · ${r.modules} modules`,
          ok: true,
        }),
      )
      .catch(() =>
        setReady({ text: 'API not reachable — start it on :8080 (see README)', ok: false }),
      );
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'parent', label: 'Parent' },
    { id: 'child', label: 'Child' },
    { id: 'operator', label: 'Operator' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            ◆
          </span>{' '}
          Potenova
        </div>
        <nav className="tabs" aria-label="Views">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'on' : ''}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div
        className={`status status-${ready.ok === null ? 'pending' : ready.ok ? 'ok' : 'err'}`}
        role="status"
      >
        <span className="status-dot" aria-hidden="true" />
        {ready.text}
      </div>

      <main className="page" id="main" tabIndex={-1}>
        {tab === 'parent' && (
          <ParentView
            family={family}
            learner={learner}
            setFamily={setFamily}
            setLearner={setLearner}
          />
        )}
        {tab === 'child' && <ChildView family={family} learner={learner} />}
        {tab === 'operator' && <OperatorView />}
        {tab === 'admin' && <AdminView />}
      </main>

      <footer className="foot">
        Demo on synthetic data. Evidence is written by a stand-in producer; real tutoring content
        arrives with the approved AI provider (deferred, pre-beta).
      </footer>
    </div>
  );
}

function useNote(): [Note | null, (n: Note | null) => void, (e: unknown) => void] {
  const [note, setNote] = useState<Note | null>(null);
  const fail = (e: unknown) =>
    setNote({ kind: 'err', text: isApiError(e) ? friendlyError(e) : String(e) });
  return [note, setNote, fail];
}

/** Turn an API error code into a parent-facing sentence (error identification). */
function friendlyError(e: api.ApiError): string {
  switch (e.code) {
    case 'NETWORK':
      return 'Could not reach the API. Is it running on :8080?';
    case 'CONSENT_REQUIRED':
      return 'Consent is required before anything is processed for this learner.';
    case 'ENTITLEMENT_INACTIVE':
      return 'No active subscription for this family yet.';
    case 'FORBIDDEN_ROLE':
      return 'This action is not allowed for the current role.';
    case 'REGION_DISALLOWED':
      return 'Processing must stay in the Canadian region.';
    case 'NOT_FOUND':
      return e.message || 'Not found.';
    default:
      return `${e.message} (${e.code})`;
  }
}

function NoteBar({ note }: { note: Note | null }) {
  if (!note) return null;
  return (
    <div
      className={`note ${note.kind}`}
      role={note.kind === 'err' ? 'alert' : 'status'}
      aria-live={note.kind === 'err' ? 'assertive' : 'polite'}
    >
      <span className="note-ico" aria-hidden="true">
        {note.kind === 'err' ? '⚠' : '✓'}
      </span>
      {note.text}
    </div>
  );
}

/** A labelled text/number field with an inline, field-level error message. */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  error,
  id,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  error?: string;
  id: string;
}) {
  return (
    <label htmlFor={id} className={error ? 'field-err' : ''}>
      {label}
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <span className="fielderr" id={`${id}-err`}>
          {error}
        </span>
      )}
    </label>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="spin" role="status">
      <span className="spin-ring" aria-hidden="true" />
      {label}
    </span>
  );
}

function ParentView({
  family,
  learner,
  setFamily,
  setLearner,
}: {
  family: Family | null;
  learner: Learner | null;
  setFamily: (f: Family | null) => void;
  setLearner: (l: Learner | null) => void;
}) {
  const [familyId, setFamilyId] = useState('fam-smith');
  const [guardianId, setGuardianId] = useState('g-parent');
  const [learnerId, setLearnerId] = useState('lnr-ava');
  const [nickname, setNickname] = useState('Ava');
  const [grade, setGrade] = useState('4');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [dash, setDash] = useState<api.Dashboard | null>(null);
  const [dashBusy, setDashBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote, fail] = useNote();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const validateIds = (): boolean => {
    const next: Record<string, string> = {};
    if (!familyId.trim()) next.familyId = 'Required.';
    if (!guardianId.trim()) next.guardianId = 'Required.';
    setErrs((e) => ({
      ...e,
      ...next,
      familyId: next.familyId ?? '',
      guardianId: next.guardianId ?? '',
    }));
    return !next.familyId && !next.guardianId;
  };
  const validateLearner = (): boolean => {
    const next: Record<string, string> = {};
    if (!learnerId.trim()) next.learnerId = 'Required.';
    if (!nickname.trim()) next.nickname = 'Required.';
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > 8) next.grade = 'Enter a grade from 1 to 8.';
    setErrs((e) => ({
      ...e,
      learnerId: next.learnerId ?? '',
      nickname: next.nickname ?? '',
      grade: next.grade ?? '',
    }));
    return !next.learnerId && !next.nickname && !next.grade;
  };

  return (
    <section className="col">
      <h1>Parent console</h1>
      <p className="lede">
        Set up a family, give consent, add a learner, then watch mastery build from evidence — the
        same guardrails the API enforces.
      </p>

      <ol className="steps">
        <li className={family ? 'done' : ''}>
          <div className="step-h">
            <span className="num">1</span> Create family
          </div>
          <div className="fields">
            <Field
              id="familyId"
              label="Family ID"
              value={familyId}
              onChange={setFamilyId}
              error={errs.familyId}
            />
            <Field
              id="guardianId"
              label="Owner guardian ID"
              value={guardianId}
              onChange={setGuardianId}
              error={errs.guardianId}
            />
          </div>
          <button
            disabled={busy}
            onClick={() =>
              validateIds() &&
              run(async () => {
                await api.createFamily(familyId, guardianId);
                setFamily({ familyId, guardianId, consentGiven: false });
                setNote({ kind: 'ok', text: `Family "${familyId}" created.` });
              })
            }
          >
            {busy ? <Spinner label="Working…" /> : 'Create family'}
          </button>
        </li>

        <li className={family?.consentGiven ? 'done' : ''}>
          <div className="step-h">
            <span className="num">2</span> Grant learning consent
          </div>
          <p className="hint">
            Nothing is processed for a child before this — the API refuses evidence with{' '}
            <code>CONSENT_REQUIRED</code> until a grant exists.
          </p>
          <button
            disabled={busy || !family}
            onClick={() =>
              run(async () => {
                if (!family) return;
                await api.grantConsent(family.familyId, family.guardianId);
                await api.grantMultimodalConsent(family.familyId, family.guardianId);
                setFamily({ ...family, consentGiven: true });
                setNote({ kind: 'ok', text: 'Consent granted: text, voice and vision.' });
              })
            }
          >
            {busy ? <Spinner label="Working…" /> : 'Grant consent'}
          </button>
        </li>

        <li className={learner ? 'done' : ''}>
          <div className="step-h">
            <span className="num">3</span> Add a learner
          </div>
          <div className="fields">
            <Field
              id="learnerId"
              label="Learner ID"
              value={learnerId}
              onChange={setLearnerId}
              error={errs.learnerId}
            />
            <Field
              id="nickname"
              label="Nickname"
              value={nickname}
              onChange={setNickname}
              error={errs.nickname}
            />
            <Field
              id="grade"
              label="Grade"
              type="number"
              min={1}
              max={8}
              value={grade}
              onChange={setGrade}
              error={errs.grade}
            />
          </div>
          <button
            disabled={busy || !family}
            onClick={() =>
              validateLearner() &&
              run(async () => {
                if (!family) return;
                const r = await api.addLearner(
                  family.familyId,
                  family.guardianId,
                  learnerId,
                  nickname,
                  Number(grade),
                );
                setLearner({ learnerId, nickname, grade: Number(grade) });
                setNote({ kind: 'ok', text: `Added ${nickname} (age band: ${r.ageBand}).` });
              })
            }
          >
            {busy ? <Spinner label="Working…" /> : 'Add learner'}
          </button>
          <p className="hint">Only Ontario grades 1–8 are accepted; anything else is blocked.</p>
        </li>

        <li>
          <div className="step-h">
            <span className="num">4</span> View dashboard
          </div>
          <button
            disabled={dashBusy || !family || !learner}
            onClick={() => {
              if (!family || !learner) return;
              setDashBusy(true);
              setNote(null);
              api
                .getDashboard(family.familyId, family.guardianId, learner.learnerId)
                .then((d) => {
                  setDash(d);
                  setNote({ kind: 'ok', text: 'Dashboard loaded from derived evidence.' });
                })
                .catch(fail)
                .finally(() => setDashBusy(false));
            }}
          >
            {dashBusy ? <Spinner label="Loading…" /> : 'Load dashboard'}
          </button>
        </li>
      </ol>

      <NoteBar note={note} />

      {family && learner && (
        <GuardianControls family={family} learner={learner} onNote={setNote} onFail={fail} />
      )}

      {family && learner && <PlacementPanel family={family} learner={learner} onFail={fail} />}

      {dashBusy && !dash && <div className="skeleton" aria-hidden="true" />}

      {dash && (
        <div className="dash">
          <h2>{learner?.nickname}&rsquo;s progress</h2>
          {dash.bySubject.length === 0 && (
            <div className="empty">
              <p>No evidence yet.</p>
              <p className="hint">
                Have {learner?.nickname} practise on the Child tab, then reload.
              </p>
            </div>
          )}
          {dash.bySubject.map((g) => (
            <div key={g.subject} className="subject">
              <h3>{subjectLabel(g.subject)}</h3>
              {g.nextFocus && (
                <div className="whytoday">
                  <span className="wt-label">Why this today?</span>{' '}
                  <strong>{skillLabel(g.nextFocus.skillId)}</strong> — {g.nextFocus.explanation}
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Standing</th>
                    <th>Confidence</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.skillId}>
                      <td>
                        {skillLabel(r.skillId)}
                        {r.cue && (
                          <span className={`cue cue-${r.cue}`}>{CUE_LABELS[r.cue] ?? r.cue}</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${standingTone(r.standing)}`}>
                          {standingLabel(r.standing)}
                        </span>
                      </td>
                      <td>{confidencePct(r.confidence)}</td>
                      <td>{r.evidenceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="hint">
            No predicted report-card grade is shown — standings come only from observed evidence
            (PAR-001), and &ldquo;why this today?&rdquo; gives the engine&rsquo;s reason, never its
            internal reasoning (PAR-016).
          </p>
        </div>
      )}
    </section>
  );
}

/** Guardian controls: a subject→strand focus and tightened usage caps. */
function GuardianControls({
  family,
  learner,
  onNote,
  onFail,
}: {
  family: Family;
  learner: Learner;
  onNote: (n: Note | null) => void;
  onFail: (e: unknown) => void;
}) {
  const [focusSubject, setFocusSubject] = useState('');
  const [focusStrand, setFocusStrand] = useState('');
  const [maxDaily, setMaxDaily] = useState('');
  const [maxCont, setMaxCont] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getPreferences(family.familyId, family.guardianId, learner.learnerId)
      .then(({ preference: p }) => {
        setFocusSubject(p.focusSubject ?? '');
        setFocusStrand(p.focusStrand ?? '');
        setMaxDaily(p.maxDailyMinutes != null ? String(p.maxDailyMinutes) : '');
        setMaxCont(p.maxContinuousMinutes != null ? String(p.maxContinuousMinutes) : '');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [family.familyId, family.guardianId, learner.learnerId]);

  const save = () => {
    setBusy(true);
    onNote(null);
    const body: Parameters<typeof api.setPreferences>[3] = {
      focus: focusSubject && focusStrand ? { subject: focusSubject, strand: focusStrand } : null,
      caps: {
        maxDailyMinutes: maxDaily ? Number(maxDaily) : null,
        maxContinuousMinutes: maxCont ? Number(maxCont) : null,
      },
    };
    api
      .setPreferences(family.familyId, family.guardianId, learner.learnerId, body)
      .then(() => onNote({ kind: 'ok', text: 'Guardian controls saved.' }))
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  const strands = focusSubject ? STRANDS[focusSubject as 'math' | 'english'] : [];

  return (
    <div className="panel">
      <h2>Guardian controls</h2>
      <p className="hint">
        A focus steers which strand a session runs; limits only tighten the safety cap, never loosen
        it. Neither can skip a prerequisite — they feed the planner&rsquo;s existing signals.
      </p>
      {!loaded ? (
        <div className="skeleton" aria-hidden="true" />
      ) : (
        <>
          <div className="fields">
            <label htmlFor="gc-subj">
              Focus subject
              <select
                id="gc-subj"
                value={focusSubject}
                onChange={(e) => {
                  setFocusSubject(e.target.value);
                  setFocusStrand('');
                }}
              >
                <option value="">No focus</option>
                <option value="math">Math</option>
                <option value="english">English</option>
              </select>
            </label>
            <label htmlFor="gc-strand">
              Focus strand
              <select
                id="gc-strand"
                value={focusStrand}
                disabled={!focusSubject}
                onChange={(e) => setFocusStrand(e.target.value)}
              >
                <option value="">{focusSubject ? 'Pick a strand' : '—'}</option>
                {strands.map((s) => (
                  <option key={s} value={s}>
                    {strandLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="gc-daily">
              Daily limit (min)
              <input
                id="gc-daily"
                type="number"
                min={0}
                value={maxDaily}
                placeholder="no limit"
                onChange={(e) => setMaxDaily(e.target.value)}
              />
            </label>
            <label htmlFor="gc-cont">
              Per-session limit (min)
              <input
                id="gc-cont"
                type="number"
                min={0}
                value={maxCont}
                placeholder="no limit"
                onChange={(e) => setMaxCont(e.target.value)}
              />
            </label>
          </div>
          <button disabled={busy} onClick={save}>
            {busy ? <Spinner label="Saving…" /> : 'Save controls'}
          </button>
        </>
      )}
    </div>
  );
}

/** A short set of diagnostic probes per subject (synthetic; server oracle-grades). */
const PROBE_SETS: Record<
  'math' | 'english',
  { taskId: string; prompt: string; options: string[]; rep: string }[]
> = {
  math: [
    {
      taskId: 'frac-eq-1',
      prompt: 'Are 1/2 and 2/4 equal in value?',
      options: ['yes', 'no'],
      rep: 'symbolic',
    },
    {
      taskId: 'frac-eq-3',
      prompt: 'Are 2/3 and 4/6 equal in value?',
      options: ['yes', 'no'],
      rep: 'area-model',
    },
    {
      taskId: 'frac-eq-2',
      prompt: 'Are 1/2 and 1/3 equal in value?',
      options: ['yes', 'no'],
      rep: 'number-line',
    },
  ],
  english: [
    { taskId: 'eng-base-1', prompt: 'Plural of "dog"?', options: ['dogs'], rep: 'written' },
    { taskId: 'eng-base-2', prompt: 'Plural of "book"?', options: ['books'], rep: 'spoken' },
    { taskId: 'eng-base-3', prompt: 'Plural of "cat"?', options: ['cats'], rep: 'picture' },
  ],
};

/** Quick diagnostic → placement: records a few probes, then shows placement. */
function PlacementPanel({
  family,
  learner,
  onFail,
}: {
  family: Family;
  learner: Learner;
  onFail: (e: unknown) => void;
}) {
  const [subject, setSubject] = useState<'math' | 'english'>('math');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [placement, setPlacement] = useState<api.Placement | null>(null);
  const [busy, setBusy] = useState(false);
  const probes = PROBE_SETS[subject];

  const submit = () => {
    if (!family.consentGiven) {
      onFail({ code: 'CONSENT_REQUIRED', message: 'consent first', status: 403 } as api.ApiError);
      return;
    }
    setBusy(true);
    setPlacement(null);
    const runId = `run-${Date.now()}`;
    const batch: api.DiagnosticProbe[] = probes.map((p, i) => ({
      clientSubmissionId: `${runId}-${i}`,
      taskId: p.taskId,
      answer: (answers[p.taskId] ?? probes[i].options[0]).trim().toLowerCase(),
      representation: p.rep,
    }));
    api
      .runDiagnosticProbes(family.familyId, learner.learnerId, runId, batch)
      .then(() => api.getPlacement(family.familyId, family.guardianId, learner.learnerId, subject))
      .then(setPlacement)
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  return (
    <div className="panel">
      <h2>Quick diagnostic → placement</h2>
      <p className="hint">
        A few probe answers are recorded as immutable diagnostic evidence and graded by the oracle.
        If a prerequisite is demonstrated, the learner is placed past it — not re-taught from the
        start. Placement is always re-derived, never hand-set.
      </p>

      <div className="skillpick" role="group" aria-label="Diagnostic subject">
        {(['math', 'english'] as const).map((s) => (
          <button
            key={s}
            className={s === subject ? 'on' : ''}
            aria-pressed={s === subject}
            disabled={busy}
            onClick={() => {
              setSubject(s);
              setAnswers({});
              setPlacement(null);
            }}
          >
            {subjectLabel(s)}
          </button>
        ))}
      </div>

      <div className="probes">
        {probes.map((p) => (
          <div key={p.taskId} className="probe">
            <span className="probe-q">{p.prompt}</span>
            {p.options.length > 1 ? (
              <span className="probe-opts" role="group" aria-label={p.prompt}>
                {p.options.map((o) => (
                  <button
                    key={o}
                    className={(answers[p.taskId] ?? p.options[0]) === o ? 'on' : ''}
                    aria-pressed={(answers[p.taskId] ?? p.options[0]) === o}
                    disabled={busy}
                    onClick={() => setAnswers((a) => ({ ...a, [p.taskId]: o }))}
                  >
                    {o}
                  </button>
                ))}
              </span>
            ) : (
              <input
                aria-label={p.prompt}
                value={answers[p.taskId] ?? ''}
                placeholder="type the word"
                disabled={busy}
                onChange={(e) => setAnswers((a) => ({ ...a, [p.taskId]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <button disabled={busy} onClick={submit}>
        {busy ? <Spinner label="Placing…" /> : 'Run diagnostic'}
      </button>

      {placement && (
        <div className="placement">
          <h3>
            Placement — {subjectLabel(placement.subject)} · {strandLabel(placement.course)}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Standing</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {placement.profile.skills.map((s) => (
                <tr key={s.skillId}>
                  <td>{skillLabel(s.skillId)}</td>
                  <td>
                    <span className={`pill ${standingTone(s.standing)}`}>
                      {standingLabel(s.standing)}
                    </span>
                  </td>
                  <td>{confidencePct(s.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="whytoday">
            <span className="wt-label">A session would start on</span>{' '}
            <strong>{skillLabel(placement.entry.skillId)}</strong> —{' '}
            {reasonCodeLabel(placement.entry.reasonCode)}
            {placement.entry.reasonCode !== 'PREREQUISITE_REMEDIATION' && (
              <span className="muted"> (placed past the prerequisite)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Representations cycled through so mastery builds across ≥2 (needed for INDEPENDENT). */
const REPS: Record<'math' | 'english', string[]> = {
  math: ['symbolic', 'area-model', 'number-line'],
  english: ['written', 'spoken', 'picture'],
};
const OPTION_LABELS: Record<string, string> = {
  lt: 'Less (<)',
  eq: 'Equal (=)',
  gt: 'Greater (>)',
  yes: 'Yes',
  no: 'No',
};
const optionLabel = (o: string): string => OPTION_LABELS[o] ?? o;

function ChildView({ family, learner }: { family: Family | null; learner: Learner | null }) {
  const [subject, setSubject] = useState<'math' | 'english'>('math');
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle');
  const [sessionId, setSessionId] = useState('');
  const [task, setTask] = useState<api.DeliveredTask | null>(null);
  const [nextRec, setNextRec] = useState<api.SessionNext | null>(null);
  const [result, setResult] = useState<api.AnswerResult | null>(null);
  const [summary, setSummary] = useState<api.SessionSummary | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [freeText, setFreeText] = useState('');
  const [inputMode, setInputMode] = useState<'type' | 'voice' | 'vision'>('type');
  const [clarity, setClarity] = useState<'clear' | 'mumbled'>('clear');
  const [clarify, setClarify] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote, fail] = useNote();

  if (!family || !learner) {
    return (
      <section className="col">
        <h1>Child workspace</h1>
        <div className="empty">
          <p className="empty-ico" aria-hidden="true">
            🎒
          </p>
          <p>No learner yet.</p>
          <p className="hint">Set up a family and add a learner on the Parent tab first.</p>
        </div>
      </section>
    );
  }
  const fam = family;
  const lnr = learner;
  const band = bandForGrade(lnr.grade);

  const loadTask = async (sid: string, taskId: string | null, next: api.SessionNext | null) => {
    setNextRec(next);
    setFreeText('');
    setClarify(null);
    if (!taskId) {
      setTask(null);
      return;
    }
    setTask(await api.getTask(fam.familyId, lnr.learnerId, sid, taskId));
  };

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      await api.activateEntitlement(fam.familyId); // demo stands in for the payment provider
      const s = await api.startSession(fam.familyId, lnr.learnerId, subject);
      setSessionId(s.session.sessionId);
      setPhase('active');
      setResult(null);
      setSummary(null);
      setAttempt(0);
      if (s.usage && s.usage.kind !== 'ALLOW') {
        setNote({
          kind: 'ok',
          text: `${usageDecisionLabel(s.usage.kind)} — ${s.allowedMinutes} min this session.`,
        });
      }
      await loadTask(s.session.sessionId, s.next.defaultTaskId, s.next);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const answer = async (value: string) => {
    if (!task) return;
    setBusy(true);
    setNote(null);
    setClarify(null);
    const cid = `${sessionId}-a${attempt}`;
    try {
      let r: api.AnswerResult;
      if (inputMode === 'type') {
        const rep = REPS[subject][attempt % REPS[subject].length];
        r = await api.submitAnswer(fam.familyId, lnr.learnerId, sessionId, {
          clientSubmissionId: cid,
          taskId: task.taskId,
          answer: value,
          representation: rep,
        });
      } else {
        const conf = clarity === 'clear' ? 0.9 : 0.4;
        r = await api.submitMultimodalAnswer(fam.familyId, lnr.learnerId, sessionId, {
          clientSubmissionId: cid,
          taskId: task.taskId,
          modality: inputMode,
          mediaRef: `demo:${value}:${conf}`,
        });
      }
      setAttempt(attempt + 1);
      if (!r.graded && r.action === 'REQUEST_CLARIFICATION') {
        setClarify('Hmm, I didn’t quite catch that — try again a bit more clearly.');
        return;
      }
      setResult(r);
      if (r.sessionComplete && r.summary) {
        setSummary(r.summary);
        setPhase('done');
        setTask(null);
      } else {
        await loadTask(sessionId, r.next?.defaultTaskId ?? null, r.next ?? null);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`col child band-${band}`}>
      <h1>Hi {lnr.nickname} 👋</h1>

      <div className="skillpick" role="group" aria-label="Subject">
        {(['math', 'english'] as const).map((s) => (
          <button
            key={s}
            className={s === subject ? 'on' : ''}
            aria-pressed={s === subject}
            disabled={phase === 'active' || busy}
            onClick={() => setSubject(s)}
          >
            {subjectLabel(s)}
          </button>
        ))}
      </div>

      {phase === 'idle' && (
        <div className="task">
          <p className="lede">Ready to practise {subjectLabel(subject)}?</p>
          <button disabled={busy} onClick={start}>
            {busy ? <Spinner label="Starting…" /> : 'Start session'}
          </button>
        </div>
      )}

      {phase === 'active' && !task && busy && (
        <div className="task">
          <Spinner label="Loading your question…" />
        </div>
      )}

      {phase === 'active' && task && (
        <div className="task">
          {nextRec && (
            <div className="whytoday">
              <span className="wt-label">Up next</span> {nextRec.explanation}
            </div>
          )}

          <div className="modepick" role="group" aria-label="Answer input method">
            {(
              [
                ['type', '⌨️', 'Type'],
                ['voice', '🎤', 'Voice'],
                ['vision', '📷', 'Photo'],
              ] as const
            ).map(([m, icon, label]) => (
              <button
                key={m}
                className={m === inputMode ? 'on' : ''}
                aria-pressed={m === inputMode}
                disabled={busy}
                onClick={() => {
                  setInputMode(m);
                  setClarify(null);
                }}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            ))}
          </div>
          {inputMode !== 'type' && (
            <div className="clarity" role="group" aria-label="Recording quality">
              <span className="muted" aria-hidden="true">
                Recording quality:
              </span>
              {(['clear', 'mumbled'] as const).map((cl) => (
                <button
                  key={cl}
                  className={cl === clarity ? 'on' : ''}
                  aria-pressed={cl === clarity}
                  disabled={busy}
                  onClick={() => setClarity(cl)}
                >
                  {cl === 'clear' ? 'Clear' : 'Mumbled'}
                </button>
              ))}
            </div>
          )}

          <div className="q" aria-live="polite">
            {task.question}
          </div>
          {clarify && (
            <div className="hintbar" role="alert">
              <span aria-hidden="true">🔁</span> {clarify}
            </div>
          )}
          {task.options.length > 0 ? (
            <div className="choices" role="group" aria-label="Answer choices">
              {task.options.map((o) => (
                <button key={o} className="choice" disabled={busy} onClick={() => answer(o)}>
                  {optionLabel(o)}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="freeans"
              onSubmit={(e) => {
                e.preventDefault();
                if (freeText.trim()) void answer(freeText.trim());
              }}
            >
              <input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="type the word"
                aria-label="Your answer"
                disabled={busy}
              />
              <button disabled={busy || !freeText.trim()}>
                {busy ? <Spinner label="…" /> : 'Submit'}
              </button>
            </form>
          )}
        </div>
      )}

      <NoteBar note={note} />

      {result && phase === 'active' && (
        <div className="progress" role="status" aria-live="polite">
          <div className="pline">
            <span className={`pill ${result.correct ? 'good' : 'low'}`}>
              {result.correct ? 'Correct' : 'Not quite'}
            </span>
            {result.reviewed && <span className="muted">review ·</span>}
            {result.projection && (
              <span className="muted">
                {confidencePct(result.projection.confidence)} confidence
              </span>
            )}
          </div>
          {result.hint && (
            <div className="hintbar">
              <span aria-hidden="true">💡</span> {result.hint.message}
            </div>
          )}
          {result.coaching && (
            <div className="hintbar">
              <span aria-hidden="true">🔁</span> {result.coaching.message}
            </div>
          )}
        </div>
      )}

      {phase === 'done' && summary && (
        <div className="dash">
          <h2>Session complete 🎉</h2>
          <p className="muted">
            {summary.observed.correct}/{summary.observed.attempts} correct this session.
          </p>
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Standing</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {summary.mastery.map((m) => (
                <tr key={m.skillId}>
                  <td>{skillLabel(m.skillId)}</td>
                  <td>{m.projection.state ?? '—'}</td>
                  <td>{confidencePct(m.projection.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">{summary.note}</p>
          <button
            disabled={busy}
            onClick={() => {
              setPhase('idle');
              setResult(null);
              setSummary(null);
            }}
          >
            Start again
          </button>
        </div>
      )}
    </section>
  );
}

/** Operator / QA view — the engine's fail-closed safety posture (read-only). */
function OperatorView() {
  const [status, setStatus] = useState<api.OperatorStatus | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ok' | 'err'>('loading');
  const [note, setNote, fail] = useNote();

  const load = () => {
    setPhase('loading');
    setNote(null);
    api
      .operatorStatus()
      .then((s) => {
        setStatus(s);
        setPhase('ok');
      })
      .catch((e) => {
        fail(e);
        setPhase('err');
      });
  };
  useEffect(load, []);

  const stateChip = (approved: boolean, configured = true) => {
    const s = policyState(approved, configured);
    return <span className={`pill ${s.tone}`}>{s.label}</span>;
  };

  return (
    <section className="col">
      <h1>Operator · QA</h1>
      <p className="lede">
        The engine&rsquo;s safety posture on synthetic data: every EVIDENCE-REQUIRED policy&rsquo;s
        fail-closed state, the model-eval posture, and a live content-gate self-check. Read-only.
      </p>

      {phase === 'loading' && <div className="skeleton" aria-hidden="true" />}
      <NoteBar note={note} />
      {phase === 'err' && (
        <div className="empty">
          <p>Could not load the operator status.</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {phase === 'ok' && status && (
        <>
          <div className={`banner ${status.prodReady ? 'good' : 'mid'}`}>
            <strong>{status.environment}</strong> · {status.primaryRegion} / {status.drRegion} ·{' '}
            {status.prodReady
              ? 'All fail-closed gates signed'
              : 'Not production-ready — unapproved gates remain'}
          </div>

          <h2>Fail-closed policies</h2>
          <div className="statgrid">
            <div className="statcard">
              <div className="stat-k">Mastery (ER-03)</div>
              {stateChip(status.policies.mastery.approved)}
              <div className="muted mono">{status.policies.mastery.version}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Usage caps (ER-09)</div>
              {stateChip(status.policies.usageCaps.allApproved)}
              <div className="muted">
                {status.policies.usageCaps.bands.filter((b) => b.approved).length}/
                {status.policies.usageCaps.bands.length} bands approved
              </div>
            </div>
            <div className="statcard">
              <div className="stat-k">Escalation (ER-08)</div>
              {stateChip(
                status.policies.escalation.approved,
                status.policies.escalation.configuredCells > 0,
              )}
              <div className="muted">
                {status.policies.escalation.configuredCells} cells configured
              </div>
            </div>
            <div className="statcard">
              <div className="stat-k">Retention (ER-07)</div>
              {stateChip(status.policies.retention.ready)}
              <div className="muted">
                {status.policies.retention.unapprovedCount} unapproved ·{' '}
                {status.policies.retention.unconfiguredCount} unconfigured
              </div>
            </div>
          </div>

          <h2>AI model &amp; evaluation</h2>
          <div className="statgrid">
            <div className="statcard">
              <div className="stat-k">Candidate model</div>
              {(() => {
                const m = modelStatusTone(status.ai.candidateModel?.status ?? null);
                return <span className={`pill ${m.tone}`}>{m.label}</span>;
              })()}
              <div className="muted mono">{status.ai.candidateModel?.modelId ?? 'none'}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Production-approved model</div>
              <span className={`pill ${status.ai.anyModelApprovedForProduction ? 'good' : 'mid'}`}>
                {status.ai.anyModelApprovedForProduction ? 'Yes' : 'None (by design)'}
              </span>
              <div className="muted">No real model routes to a child yet.</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Eval latency SLO (NFR-07)</div>
              <span className="pill mid">
                {status.modelEval.latency.sloMs == null
                  ? 'Draft — not set'
                  : `${status.modelEval.latency.sloMs} ms`}
              </span>
              <div className="muted">{status.modelEval.latency.recordedRuns} runs recorded</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Eval runnable</div>
              <span className={`pill ${status.modelEval.runnable ? 'good' : 'mid'}`}>
                {status.modelEval.runnable ? 'Provider wired' : 'No provider'}
              </span>
              <div className="muted mono">{status.modelEval.endpoint}</div>
            </div>
          </div>

          <h2>Containment &amp; gate</h2>
          <div className="statgrid">
            <div className="statcard">
              <div className="stat-k">Content gate self-check</div>
              <span className={`pill ${status.contentGate.active ? 'good' : 'low'}`}>
                {status.contentGate.active ? 'Live' : 'Failing'}
              </span>
              <div className="muted">
                delivers valid · refuses unknown{' '}
                {status.contentGate.positive && status.contentGate.negativeBlocked ? '✓' : '✗'}
              </div>
            </div>
            {status.killSwitches.map((k) => (
              <div className="statcard" key={k.capability}>
                <div className="stat-k">Kill switch · {k.capability}</div>
                <span className={`pill ${k.active ? 'good' : 'low'}`}>
                  {k.active ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>

          <p className="hint">
            Every unapproved value is a fail-closed DRAFT slot — in production the enforcing path
            refuses until an accountable owner signs it. Nothing here is a fabricated pass.
          </p>
          <button onClick={load}>Refresh</button>
        </>
      )}

      <PrivacyOps />
    </section>
  );
}

const ERASURE_TERMINAL = ['completed', 'tombstoned', 'not_applicable'];
const isTerminal = (s: string) => ERASURE_TERMINAL.includes(s);
const erasureTone = (s: string) => (isTerminal(s) ? 'good' : s === 'failed' ? 'low' : 'mid');
const sweepTone = (s: string) => (s === 'swept' ? 'good' : s === 'blocked' ? 'low' : 'mid');

/** Operator privacy actions — retention sweep + data-subject erasure (ER-07 / PRIV-005). */
function PrivacyOps() {
  return (
    <>
      <h2>Privacy operations</h2>
      <p className="hint">
        Operator-only, on synthetic data. In production both stay fail-closed: the sweep blocks
        every class until its schedule is signed, and an erasure reads complete only once every
        external target is attested.
      </p>
      <RetentionSweepPanel />
      <ErasurePanel />
    </>
  );
}

/** Retention-expiry sweep (ER-07): age out first-party records per the schedule. */
function RetentionSweepPanel() {
  const [res, setRes] = useState<api.RetentionSweepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote, fail] = useNote();

  const run = (dryRun: boolean) => {
    setBusy(true);
    setNote(null);
    api
      .retentionSweep(dryRun)
      .then((r) => {
        setRes(r);
        setNote({
          kind: 'ok',
          text: dryRun
            ? 'Dry run complete — nothing deleted.'
            : `Swept — ${r.summary.totalActioned} record(s) aged out.`,
        });
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return (
    <div className="panel">
      <h3>Retention-expiry sweep (ER-07)</h3>
      <p className="hint">
        Ages out first-party records past their window. Dry run flags what is due without deleting;
        unapproved classes stay blocked.
      </p>
      <div className="ops-row">
        <button disabled={busy} onClick={() => run(true)}>
          {busy ? <Spinner label="Running…" /> : 'Dry run'}
        </button>
        <button className="btn-danger" disabled={busy} onClick={() => run(false)}>
          {busy ? <Spinner label="Sweeping…" /> : 'Run sweep (delete)'}
        </button>
      </div>
      <NoteBar note={note} />
      {res && (
        <>
          <p className="muted">
            {res.summary.classes} classes · {res.summary.totalDue} due · {res.summary.totalActioned}{' '}
            actioned{res.dryRun ? ' (dry run)' : ''} · asOf {res.asOf.slice(0, 10)}
          </p>
          <table className="ops-table">
            <thead>
              <tr>
                <th>Data class</th>
                <th>Store</th>
                <th>Scanned</th>
                <th>Due</th>
                <th>Actioned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {res.report.map((r) => (
                <tr key={r.dataClass}>
                  <td className="mono">{r.dataClass}</td>
                  <td className="muted">{r.store ?? '—'}</td>
                  <td>{r.scanned}</td>
                  <td>{r.due}</td>
                  <td>{r.actioned}</td>
                  <td>
                    <span className={`pill ${sweepTone(r.status)}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Data-subject erasure (PRIV-005): learner or family cascade, fail-closed until attested. */
function ErasurePanel() {
  const [subjectType, setSubjectType] = useState<'learner' | 'family'>('learner');
  const [subjectId, setSubjectId] = useState('');
  const [reason, setReason] = useState('subject_request');
  const [res, setRes] = useState<api.ErasureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote, fail] = useNote();

  const start = () => {
    if (!subjectId.trim()) {
      setNote({ kind: 'err', text: 'Enter a subject id.' });
      return;
    }
    setBusy(true);
    setNote(null);
    api
      .startErasure(subjectType, subjectId.trim(), reason)
      .then((r) => {
        setRes(r);
        setNote({ kind: 'ok', text: `First-party rows deleted; request ${r.state}.` });
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const attest = (targetId: string, status: string) => {
    if (!res) return;
    setBusy(true);
    api
      .attestErasure(res.requestId, targetId, status)
      .then((r) => {
        setRes(r);
        setNote({
          kind: 'ok',
          text: r.verification.complete
            ? 'Erasure complete — every target verified.'
            : `Attested ${targetId}.`,
        });
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return (
    <div className="panel">
      <h3>Data-subject erasure (PRIV-005)</h3>
      <p className="hint">
        A learner erases that learner; a family cascades across every learner plus the family rows.
        Billing is retained under its legal hold. Complete only once every external target is
        attested.
      </p>
      <div className="fields">
        <label htmlFor="er-type">
          Subject
          <select
            id="er-type"
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value as 'learner' | 'family')}
          >
            <option value="learner">Learner</option>
            <option value="family">Family (cascade)</option>
          </select>
        </label>
        <label htmlFor="er-id">
          {subjectType === 'family' ? 'Family id' : 'Learner alias'}
          <input
            id="er-id"
            value={subjectId}
            placeholder={subjectType === 'family' ? 'fam1' : 'kid1'}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        </label>
        <label htmlFor="er-reason">
          Reason
          <select id="er-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="subject_request">Subject request</option>
            <option value="account_closure">Account closure</option>
            <option value="retention_expiry">Retention expiry</option>
          </select>
        </label>
      </div>
      <button className="btn-danger" disabled={busy} onClick={start}>
        {busy ? <Spinner label="Erasing…" /> : 'Start erasure'}
      </button>
      <NoteBar note={note} />
      {res && (
        <>
          <div className={`banner ${res.verification.complete ? 'good' : 'mid'}`}>
            Request <span className="mono">{res.requestId}</span> · <strong>{res.state}</strong>
            {res.verification.complete
              ? ' · all targets verified'
              : ` · outstanding: ${res.verification.outstanding.join(', ') || 'none'}`}
          </div>
          {res.record.outcomes.map((o) => (
            <div className="ops-row" key={o.target.id}>
              <span className="mono">{o.target.id}</span>
              <span className={`pill ${erasureTone(o.status)}`}>{o.status}</span>
              {o.target.required && !isTerminal(o.status) && (
                <span className="ops-attest">
                  <button disabled={busy} onClick={() => attest(o.target.id, 'completed')}>
                    completed
                  </button>
                  <button disabled={busy} onClick={() => attest(o.target.id, 'tombstoned')}>
                    tombstoned
                  </button>
                  <button disabled={busy} onClick={() => attest(o.target.id, 'not_applicable')}>
                    n/a
                  </button>
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AdminView() {
  const [metrics, setMetrics] = useState<api.OperatorMetrics | null>(null);
  const [routing, setRouting] = useState<api.OperatorStatus['modelRouting']>([]);
  const [phase, setPhase] = useState<'loading' | 'ok' | 'err'>('loading');
  const [familyId, setFamilyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote, fail] = useNote();

  const load = () => {
    setPhase('loading');
    setNote(null);
    Promise.all([api.operatorMetrics(), api.operatorStatus()])
      .then(([m, s]) => {
        setMetrics(m);
        setRouting(s.modelRouting);
        setPhase('ok');
      })
      .catch((e) => {
        fail(e);
        setPhase('err');
      });
  };
  useEffect(load, []);

  const act = (action: 'suspend' | 'reactivate') => {
    if (!familyId.trim()) {
      setNote({ kind: 'err', text: 'Enter a family id first.' });
      return;
    }
    setBusy(true);
    setNote(null);
    api
      .setAccountStatus(familyId.trim(), action)
      .then((r) => {
        setNote({ kind: 'ok', text: `Account ${r.familyId} is now ${r.status}.` });
        load();
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return (
    <section className="col">
      <h1>Admin</h1>
      <p className="lede">
        Operator administration on synthetic data: roll-up counts, account suspend/reactivate
        (audited), and a read-only view of which model is allowed for which activity. No real child
        data; account suspend takes effect at the edge on the next session.
      </p>

      {phase === 'loading' && <div className="skeleton" aria-hidden="true" />}
      <NoteBar note={note} />
      {phase === 'err' && (
        <div className="empty">
          <p>Could not load admin data.</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {phase === 'ok' && metrics && (
        <>
          <h2>Metrics</h2>
          <div className="statgrid">
            <div className="statcard">
              <div className="stat-k">Families</div>
              <div className="stat-v">{metrics.accounts.families}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Guardians</div>
              <div className="stat-v">{metrics.accounts.guardians}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Learners</div>
              <div className="stat-v">{metrics.accounts.learners}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Sessions (active / total)</div>
              <div className="stat-v">
                {metrics.sessions.active} / {metrics.sessions.total}
              </div>
            </div>
            <div className="statcard">
              <div className="stat-k">Suspended accounts</div>
              <div className="stat-v">{metrics.accounts.byStatus.suspended ?? 0}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Learning-active (billing)</div>
              <div className="stat-v">{metrics.billing.learningActiveFamilies}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Pending dual-auth</div>
              <div className="stat-v">{metrics.safety.pendingDualAuth}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Pending notifications</div>
              <div className="stat-v">{metrics.notifications.pending}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">Billing holds</div>
              <div className="stat-v">{metrics.billing.holds}</div>
            </div>
            <div className="statcard">
              <div className="stat-k">AI token units (eval)</div>
              <div className="stat-v">{metrics.ai.usage.totalUnits}</div>
            </div>
          </div>

          <h2>Account suspend / reactivate</h2>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              aria-label="Family id"
              placeholder="family id (e.g. fam-…)"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <button disabled={busy} onClick={() => act('suspend')}>
              Suspend
            </button>
            <button disabled={busy} onClick={() => act('reactivate')}>
              Reactivate
            </button>
          </div>

          <h2>Model routing (read-only)</h2>
          {routing.length === 0 ? (
            <p className="muted">
              No model is registered. No model is routable for production until APPROVED; the
              gateway still gates every call on status, Canadian region and the age/subject/
              capability envelope.
            </p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Prod?</th>
                  <th>Regions</th>
                  <th>Age bands</th>
                  <th>Subjects</th>
                  <th>Capabilities</th>
                  <th>No-train</th>
                </tr>
              </thead>
              <tbody>
                {routing.map((m) => (
                  <tr key={m.modelId}>
                    <td className="mono">{m.modelId}</td>
                    <td>{m.status}</td>
                    <td>{m.approvedForProduction ? 'yes' : 'no'}</td>
                    <td>{m.allowedRegions.join(', ')}</td>
                    <td>{m.ageBands.join(', ')}</td>
                    <td>{m.subjects.join(', ')}</td>
                    <td>{m.capabilities.join(', ')}</td>
                    <td>{m.trainingDisabled ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
