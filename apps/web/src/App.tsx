import { useEffect, useState } from 'react';
import * as api from './api';
import { isApiError } from './api';
import { bandForGrade, confidencePct, standingLabel, standingTone } from './format';

/** The two demo skills we exercise end-to-end (synthetic — no real curriculum yet). */
const DEMO_SKILLS = [
  { id: 'SK-FR-compare', label: 'Comparing fractions' },
  { id: 'SK-FR-equiv', label: 'Equivalent fractions' },
];

/** Parent-friendly labels for every skill the dashboard may surface. */
const SKILL_LABELS: Record<string, string> = {
  'SK-FR-compare': 'Comparing fractions',
  'SK-FR-equiv': 'Equivalent fractions',
  'SK-EN-plural-base': 'Plurals: adding -s',
  'SK-EN-plural-sibilant': 'Plurals: -es and -ies',
};
const skillLabel = (id: string): string => SKILL_LABELS[id] ?? id;
const SUBJECT_LABELS: Record<string, string> = {
  math: 'Math',
  english: 'English',
  other: 'Other',
};
const subjectLabel = (s: string): string => SUBJECT_LABELS[s] ?? s;
/** Per-skill cue badges. */
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

export function App() {
  const [tab, setTab] = useState<'parent' | 'child'>('parent');
  const [ready, setReady] = useState<string>('checking…');
  const [family, setFamily] = useState<Family | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);

  useEffect(() => {
    api
      .readiness()
      .then((r) =>
        setReady(`API ready · ${r.environment} · ${r.primaryRegion} · ${r.modules} modules`),
      )
      .catch(() => setReady('API not reachable — start it on :8080 (see README)'));
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark">◆</span> Potenova
        </div>
        <nav className="tabs">
          <button className={tab === 'parent' ? 'on' : ''} onClick={() => setTab('parent')}>
            Parent
          </button>
          <button className={tab === 'child' ? 'on' : ''} onClick={() => setTab('child')}>
            Child
          </button>
        </nav>
      </header>

      <div className="status">{ready}</div>

      <main className="page">
        {tab === 'parent' ? (
          <ParentView
            family={family}
            learner={learner}
            setFamily={setFamily}
            setLearner={setLearner}
          />
        ) : (
          <ChildView family={family} learner={learner} />
        )}
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
    setNote({ kind: 'err', text: isApiError(e) ? `${e.code}: ${e.message}` : String(e) });
  return [note, setNote, fail];
}

function NoteBar({ note }: { note: Note | null }) {
  if (!note) return null;
  return <div className={`note ${note.kind}`}>{note.text}</div>;
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
  const [grade, setGrade] = useState(4);
  const [dash, setDash] = useState<api.Dashboard | null>(null);
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
            <label>
              Family ID
              <input value={familyId} onChange={(e) => setFamilyId(e.target.value)} />
            </label>
            <label>
              Owner guardian ID
              <input value={guardianId} onChange={(e) => setGuardianId(e.target.value)} />
            </label>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.createFamily(familyId, guardianId);
                setFamily({ familyId, guardianId, consentGiven: false });
                setNote({ kind: 'ok', text: `Family "${familyId}" created.` });
              })
            }
          >
            Create family
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
                setNote({
                  kind: 'ok',
                  text: 'Consent granted: text, voice and vision.',
                });
              })
            }
          >
            Grant consent
          </button>
        </li>

        <li className={learner ? 'done' : ''}>
          <div className="step-h">
            <span className="num">3</span> Add a learner
          </div>
          <div className="fields">
            <label>
              Learner ID
              <input value={learnerId} onChange={(e) => setLearnerId(e.target.value)} />
            </label>
            <label>
              Nickname
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
            <label>
              Grade
              <input
                type="number"
                min={1}
                max={8}
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
              />
            </label>
          </div>
          <button
            disabled={busy || !family}
            onClick={() =>
              run(async () => {
                if (!family) return;
                const r = await api.addLearner(
                  family.familyId,
                  family.guardianId,
                  learnerId,
                  nickname,
                  grade,
                );
                setLearner({ learnerId, nickname, grade });
                setNote({ kind: 'ok', text: `Added ${nickname} (age band: ${r.ageBand}).` });
              })
            }
          >
            Add learner
          </button>
          <p className="hint">Only Ontario grades 1–8 are accepted; anything else is blocked.</p>
        </li>

        <li>
          <div className="step-h">
            <span className="num">4</span> View dashboard
          </div>
          <button
            disabled={busy || !family || !learner}
            onClick={() =>
              run(async () => {
                if (!family || !learner) return;
                const d = await api.getDashboard(
                  family.familyId,
                  family.guardianId,
                  learner.learnerId,
                );
                setDash(d);
                setNote({ kind: 'ok', text: 'Dashboard loaded from derived evidence.' });
              })
            }
          >
            Load dashboard
          </button>
        </li>
      </ol>

      <NoteBar note={note} />

      {dash && (
        <div className="dash">
          <h2>{learner?.nickname}&rsquo;s progress</h2>
          {dash.bySubject.length === 0 && (
            <p className="hint">
              No evidence yet — have {learner?.nickname} practise on the Child tab.
            </p>
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

/** Representations cycled through so mastery builds across ≥2 (needed for INDEPENDENT). */
const REPS: Record<'math' | 'english', string[]> = {
  math: ['symbolic', 'area-model', 'number-line'],
  english: ['written', 'spoken', 'picture'],
};
/** Friendly labels for answer tokens. */
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
        // The demo encodes the spoken/photographed answer + a confidence the
        // recogniser "hears". A mumbled reading lands below the AT-28 floor.
        const conf = clarity === 'clear' ? 0.9 : 0.4;
        r = await api.submitMultimodalAnswer(fam.familyId, lnr.learnerId, sessionId, {
          clientSubmissionId: cid,
          taskId: task.taskId,
          modality: inputMode,
          mediaRef: `demo:${value}:${conf}`,
        });
      }
      setAttempt(attempt + 1);
      // AT-28: a low-confidence reading is never graded — ask for a do-over.
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

      <div className="skillpick">
        {(['math', 'english'] as const).map((s) => (
          <button
            key={s}
            className={s === subject ? 'on' : ''}
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
            Start session
          </button>
        </div>
      )}

      {phase === 'active' && task && (
        <div className="task">
          {nextRec && (
            <div className="whytoday">
              <span className="wt-label">Up next</span> {nextRec.explanation}
            </div>
          )}

          <div className="modepick">
            {(
              [
                ['type', '⌨️ Type'],
                ['voice', '🎤 Voice'],
                ['vision', '📷 Photo'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                className={m === inputMode ? 'on' : ''}
                disabled={busy}
                onClick={() => {
                  setInputMode(m);
                  setClarify(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {inputMode !== 'type' && (
            <div className="clarity">
              <span className="muted">Recording quality:</span>
              {(['clear', 'mumbled'] as const).map((cl) => (
                <button
                  key={cl}
                  className={cl === clarity ? 'on' : ''}
                  disabled={busy}
                  onClick={() => setClarity(cl)}
                >
                  {cl === 'clear' ? 'Clear' : 'Mumbled'}
                </button>
              ))}
            </div>
          )}

          <div className="q">{task.question}</div>
          {clarify && <div className="hintbar">🔁 {clarify}</div>}
          {task.options.length > 0 ? (
            <div className="choices">
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
                disabled={busy}
              />
              <button disabled={busy || !freeText.trim()}>Submit</button>
            </form>
          )}
        </div>
      )}

      <NoteBar note={note} />

      {result && phase === 'active' && (
        <div className="progress">
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
          {result.hint && <div className="hintbar">💡 {result.hint.message}</div>}
          {result.coaching && <div className="hintbar">🔁 {result.coaching.message}</div>}
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
