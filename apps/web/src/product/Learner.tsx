import { useEffect, useState, type ReactNode } from 'react';
import * as api from '../api';
import {
  isApiError,
  type DeliveredTask,
  type DiagnosticProbeTask,
  type DiagnosticRunStep,
  type Placement,
  type SessionBudget,
  type SessionNext,
} from '../api';
import {
  readActive,
  isBaselineDone,
  markBaselineDone,
  stashBaselineRun,
  readBaselineRun,
  clearBaselineRun,
  type ActiveLearner,
} from './active';
import { skillLabel, isFractionSkill } from './labels';
import './Learner.css';

/**
 * Learner experience at #/learn. One route, several views:
 *   baseline  — the "find your starting point" check the onboarding promises. The
 *               server drives it adaptively, one probe at a time, and decides when
 *               it knows enough; probes come only from the API (content gate). It
 *               shows no right/wrong — it only places the learner. Runs once per
 *               learner+subject, then is skipped on later sessions; an interrupted
 *               run resumes.
 *   placed    — a short transition showing the starting point the baseline found.
 *   practice  — the real session loop (tasks come only from the API, so the
 *               content gate holds: nothing free-form or unvalidated is shown).
 *   teach     — "Learn it" hub: a worked example (an approved, fixed lesson),
 *               with Watch / Step-by-step / Play.
 *   video     — a Potenova-hosted, in-region, captioned player (no third-party
 *               embed, no recommendations). Synthetic placeholder — no media wired.
 *   game      — a concept game. It is a learning aid only: it writes NO evidence,
 *               so it can never be a shortcut to mastery, and it lives inside the
 *               session's time budget.
 * Mastery is always derived server-side from graded answers; this screen only
 * reads projections back. Hints/coaching come from the API, never invented here.
 */

type View =
  | 'loading'
  | 'connect'
  | 'error'
  | 'baseline'
  | 'placed'
  | 'practice'
  | 'teach'
  | 'video'
  | 'game'
  | 'summary';
type TeachMode = 'video' | 'step' | 'game';
type Feedback = { kind: 'correct' | 'wrong' | 'coaching'; message: string } | null;

const subId = (): string => `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function startSubject(focus: ActiveLearner['focus']): 'math' | 'english' {
  return focus === 'english' ? 'english' : 'math';
}

export function Learner() {
  const [active] = useState<ActiveLearner | null>(() => readActive());
  const [view, setView] = useState<View>('loading');
  const [subject, setSubject] = useState<'math' | 'english'>(() =>
    active ? startSubject(active.focus) : 'math',
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState<DeliveredTask | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [next, setNext] = useState<SessionNext | null>(null);
  const [budget, setBudget] = useState<SessionBudget | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [teachMode, setTeachMode] = useState<TeachMode>('step');
  // Baseline ("find your starting point") state
  const [probe, setProbe] = useState<DiagnosticProbeTask | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [probesUsed, setProbesUsed] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    if (!active) {
      setView('connect');
      return;
    }
    void enter(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Decide the entry: run the baseline first unless it's already done for this
   *  learner + subject, in which case go straight to a practice session. */
  async function enter(subj: 'math' | 'english'): Promise<void> {
    if (!active) return;
    setSubject(subj);
    if (isBaselineDone(active.learnerId, subj)) {
      await begin(subj);
    } else {
      await beginBaseline(subj);
    }
  }

  /** Apply one step of the adaptive baseline: either show the next probe, or, when
   *  the server decides it knows enough, record completion and move to placement. */
  function applyBaselineStep(step: DiagnosticRunStep, subj: 'math' | 'english'): void {
    if (!active) return;
    setProbesUsed(step.probesUsed);
    if (step.complete) {
      setProbe(null);
      setPlacement(step.placement ?? null);
      markBaselineDone(active.learnerId, subj);
      setView('placed');
    } else if (step.next) {
      setProbe(step.next);
      setSelected(null);
      setView('baseline');
    } else {
      // No probe and not complete — treat as placed with whatever we have.
      setView('placed');
    }
  }

  async function beginBaseline(subj: 'math' | 'english'): Promise<void> {
    if (!active) return;
    setView('loading');
    setBusy(true);
    setErr(null);
    setPlacement(null);
    try {
      await api.activateEntitlement(active.familyId).catch(() => undefined);
      // Resume an interrupted run if one is stashed; otherwise start fresh.
      const stashed = readBaselineRun(active.learnerId, subj);
      let step: DiagnosticRunStep | null = null;
      if (stashed) {
        step = await api
          .resumeDiagnosticRun(active.familyId, active.learnerId, stashed)
          .catch(() => null);
        if (!step) clearBaselineRun(active.learnerId, subj);
      }
      if (!step) {
        step = await api.startDiagnosticRun(active.familyId, active.learnerId, subj);
      }
      setRunId(step.runId);
      stashBaselineRun(active.learnerId, subj, step.runId);
      applyBaselineStep(step, subj);
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not start the baseline.');
      setView('error');
    } finally {
      setBusy(false);
    }
  }

  async function answerBaseline(): Promise<void> {
    if (!active || !runId || !probe || !selected) return;
    setBusy(true);
    setErr(null);
    try {
      const step = await api.answerDiagnosticProbe(active.familyId, active.learnerId, runId, {
        clientSubmissionId: subId(),
        taskId: probe.taskId,
        answer: selected,
      });
      applyBaselineStep(step, subject);
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not record that answer.');
    } finally {
      setBusy(false);
    }
  }

  async function loadTask(taskId: string, sid: string): Promise<void> {
    if (!active) return;
    const t = await api.getTask(active.familyId, active.learnerId, sid, taskId);
    setTask(t);
    setSelected(null);
    setFeedback(null);
    setHintMsg(null);
    setAnswered(false);
  }

  async function begin(subj: 'math' | 'english'): Promise<void> {
    if (!active) return;
    setView('loading');
    setBusy(true);
    setErr(null);
    try {
      // Entitlement is a session precondition; activate is idempotent.
      await api.activateEntitlement(active.familyId).catch(() => undefined);
      const started = await api.startSession(active.familyId, active.learnerId, subj);
      setSessionId(started.session.sessionId);
      setBudget(started.budget);
      setNext(started.next);
      setSubject(subj);
      if (started.next.defaultTaskId) {
        await loadTask(started.next.defaultTaskId, started.session.sessionId);
      } else {
        setTask(null);
      }
      setView('practice');
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not start the session.');
      setView('error');
    } finally {
      setBusy(false);
    }
  }

  async function submit(): Promise<void> {
    if (!active || !sessionId || !task || !selected) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.submitAnswer(active.familyId, active.learnerId, sessionId, {
        clientSubmissionId: subId(),
        taskId: task.taskId,
        answer: selected,
        representation: 'symbolic',
      });
      if (r.budget) setBudget(r.budget);
      if (r.next) setNext(r.next);
      if (r.sessionComplete) {
        setView('summary');
        return;
      }
      if (r.graded && r.correct) {
        setAnswered(true);
        setFeedback({ kind: 'correct', message: 'Nice — that’s right.' });
      } else if (r.graded && r.correct === false) {
        setAnswered(false);
        if (r.hint) {
          setHintMsg(r.hint.message);
          setFeedback({ kind: 'wrong', message: 'Take another look.' });
        } else if (r.coaching) {
          setFeedback({ kind: 'coaching', message: r.coaching.message });
        } else {
          setFeedback({ kind: 'wrong', message: 'Not quite — try again.' });
        }
      } else {
        setFeedback({ kind: 'wrong', message: 'Let’s try that again.' });
      }
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not submit your answer.');
    } finally {
      setBusy(false);
    }
  }

  async function loadNext(): Promise<void> {
    if (!active || !sessionId) return;
    const taskId = next?.defaultTaskId;
    if (!taskId) {
      setView('summary');
      return;
    }
    setBusy(true);
    try {
      await loadTask(taskId, sessionId);
    } catch (e) {
      setErr(isApiError(e) ? `${e.message} (${e.code})` : 'Could not load the next question.');
    } finally {
      setBusy(false);
    }
  }

  const nickname = active?.nickname ?? 'You';
  const skillId = task?.skillId ?? next?.skillId ?? '';
  const skillName = skillId ? skillLabel(skillId) : 'your session';

  // ---- Connect / error / summary states --------------------------------------
  if (view === 'connect') {
    return (
      <div className="lrn">
        <div className="lrn-center">
          <span
            className="lrn-av"
            aria-hidden="true"
            style={{ width: 44, height: 44, fontSize: 20 }}
          >
            P
          </span>
          <h1 style={{ fontSize: 30 }}>No learner set up yet</h1>
          <p className="lrn-muted" style={{ maxWidth: '40ch' }}>
            Create a parent account and add your child to start a session.
          </p>
          <a className="lrn-btn" href="#/signup">
            Set up an account
          </a>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="lrn">
        <div className="lrn-center">
          <h1 style={{ fontSize: 26 }}>We couldn’t start the session</h1>
          <p className="lrn-muted" style={{ maxWidth: '44ch' }}>
            {err ?? 'Something went wrong.'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="lrn-btn" onClick={() => void enter(subject)} disabled={busy}>
              Try again
            </button>
            <a className="lrn-btn lrn-btn-g" href="#/dashboard">
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'loading') {
    return (
      <div className="lrn">
        <div className="lrn-center">
          <p className="lrn-muted">Getting your session ready…</p>
        </div>
      </div>
    );
  }

  if (view === 'summary') {
    return (
      <div className="lrn">
        <TopBar nickname={nickname} chip={{ text: 'Session complete', cls: 'teal' }} right={null} />
        <div className="lrn-center">
          <span
            className="lrn-av"
            aria-hidden="true"
            style={{ width: 64, height: 64, fontSize: 30, borderRadius: 999 }}
          >
            ✓
          </span>
          <h1 style={{ fontSize: 32 }}>Great work, {nickname}!</h1>
          <p className="lrn-muted" style={{ maxWidth: '44ch' }}>
            You finished this session. Your progress updates on the parent dashboard — mastery is
            earned from the work you just did.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="lrn-btn" onClick={() => void begin(subject)} disabled={busy}>
              Practise again
            </button>
            {active?.focus === 'both' && (
              <button
                className="lrn-btn lrn-btn-g"
                onClick={() => void enter(subject === 'math' ? 'english' : 'math')}
                disabled={busy}
              >
                Try {subject === 'math' ? 'English' : 'Math'}
              </button>
            )}
            <a className="lrn-btn lrn-btn-g" href="#/dashboard">
              Parent dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- Baseline ("find your starting point") ---------------------------------
  if (view === 'baseline') {
    return (
      <div className="lrn">
        <TopBar
          nickname={nickname}
          chip={{ text: 'Finding your starting point', cls: 'teal' }}
          right={
            <span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--muted)' }}>
              Question {probesUsed + 1}
            </span>
          }
        />
        <main className="lrn-stage">
          {!probe ? (
            <p className="lrn-muted">Setting up…</p>
          ) : (
            <div className="lrn-q">
              <div style={{ font: '600 15px/1 var(--font-sans)', color: 'var(--teal-ink)' }}>
                {skillLabel(probe.skillId)}
              </div>
              <h1 style={{ fontSize: 36, margin: '12px 0 26px' }}>{probe.question}</h1>
              <div
                className="lrn-ans-grid"
                style={{
                  gridTemplateColumns: `repeat(${probe.options.length <= 2 ? 2 : probe.options.length <= 4 ? 2 : 3}, minmax(0,1fr))`,
                }}
              >
                {probe.options.map((opt) => (
                  <button
                    key={opt}
                    className={`lrn-ans ${selected === opt ? 'sel' : ''}`}
                    aria-pressed={selected === opt}
                    disabled={busy}
                    onClick={() => setSelected(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="lrn-actions">
                <button
                  className="lrn-btn"
                  onClick={() => void answerBaseline()}
                  disabled={busy || !selected}
                >
                  Next
                </button>
              </div>
              <p className="lrn-muted" style={{ fontSize: 14, marginTop: 14 }}>
                There are no wrong answers here — this just finds the right place to start. Pick
                what you think, and we’ll keep it short.
              </p>
            </div>
          )}
        </main>
        {err && (
          <p
            className="lrn-muted"
            style={{ color: '#a12b2b', textAlign: 'center', padding: '0 24px 12px' }}
            role="alert"
          >
            {err}
          </p>
        )}
      </div>
    );
  }

  // ---- Placed (starting point found) -----------------------------------------
  if (view === 'placed') {
    const entry = placement?.entry;
    const checked = placement?.profile.skills.length ?? 0;
    return (
      <div className="lrn">
        <TopBar
          nickname={nickname}
          chip={{ text: 'Starting point found', cls: 'teal' }}
          right={null}
        />
        <div className="lrn-center">
          <span
            className="lrn-av"
            aria-hidden="true"
            style={{ width: 64, height: 64, fontSize: 30, borderRadius: 999 }}
          >
            ✓
          </span>
          <h1 style={{ fontSize: 32 }}>Found your starting point</h1>
          {entry ? (
            <p className="lrn-muted" style={{ maxWidth: '46ch' }}>
              We’ll start {nickname} on <strong>{skillLabel(entry.skillId)}</strong>.{' '}
              {entry.explanation}
            </p>
          ) : (
            <p className="lrn-muted" style={{ maxWidth: '46ch' }}>
              We’ve got a good place to start. Let’s begin.
            </p>
          )}
          {checked > 0 && (
            <p className="lrn-muted" style={{ fontSize: 13 }}>
              Based on {checked} skill{checked === 1 ? '' : 's'} we checked just now.
            </p>
          )}
          <button className="lrn-btn" onClick={() => void begin(subject)} disabled={busy}>
            Start practising
          </button>
        </div>
      </div>
    );
  }

  // ---- Teach hub -------------------------------------------------------------
  if (view === 'teach') {
    return (
      <div className="lrn">
        <TopBar
          nickname={nickname}
          chip={{ text: `Learn it · ${skillName}`, cls: 'coral' }}
          right={
            <button className="lrn-iconbtn" onClick={() => setView('practice')}>
              Back to practice
            </button>
          }
        />
        <main className="lrn-stage">
          <div className="lrn-wrap">
            <div style={{ font: '600 15px/1 var(--font-sans)', color: '#a2502a' }}>
              Let’s learn it
            </div>
            <h1 style={{ fontSize: 30, margin: '8px 0 4px' }}>{skillName}</h1>
            <p className="lrn-muted" style={{ fontSize: 16, margin: 0 }}>
              Pick the way that clicks for you — watch it, walk through it, or play.
            </p>

            <div className="lrn-modes">
              <button
                className={`lrn-mode${teachMode === 'video' ? ' sel' : ''}`}
                onClick={() => {
                  setTeachMode('video');
                  setView('video');
                }}
              >
                <span className="lrn-mico" style={{ background: '#e9eef6' }} aria-hidden="true">
                  ▶
                </span>
                <div style={{ fontWeight: 700 }}>Watch</div>
                <div className="lrn-muted" style={{ fontSize: 13 }}>
                  2-minute video
                </div>
              </button>
              <button
                className={`lrn-mode${teachMode === 'step' ? ' sel' : ''}`}
                onClick={() => setTeachMode('step')}
                aria-current={teachMode === 'step'}
              >
                <span
                  className="lrn-mico"
                  style={{ background: 'var(--teal-wash)' }}
                  aria-hidden="true"
                >
                  ☰
                </span>
                <div style={{ fontWeight: 700 }}>Step-by-step</div>
                <div className="lrn-muted" style={{ fontSize: 13 }}>
                  See it worked out
                </div>
              </button>
              <button
                className={`lrn-mode${teachMode === 'game' ? ' sel' : ''}`}
                onClick={() => {
                  setTeachMode('game');
                  setView('game');
                }}
              >
                <span className="lrn-mico" style={{ background: '#fbe6d9' }} aria-hidden="true">
                  ◉
                </span>
                <div style={{ fontWeight: 700 }}>Play</div>
                <div className="lrn-muted" style={{ fontSize: 13 }}>
                  Concept game
                </div>
              </button>
            </div>

            <WorkedExample skillId={skillId} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 20,
              }}
            >
              <span className="lrn-muted" style={{ fontSize: 13 }}>
                Approved Potenova lesson · plays in Canada
              </span>
              <button className="lrn-btn" onClick={() => setView('practice')}>
                Now you try
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---- Watch -----------------------------------------------------------------
  if (view === 'video') {
    return (
      <div className="lrn">
        <TopBar
          nickname={nickname}
          chip={{ text: `Watch · ${skillName}`, cls: 'blue' }}
          right={
            <button className="lrn-iconbtn" onClick={() => setView('teach')}>
              Back
            </button>
          }
        />
        <main className="lrn-stage">
          <div style={{ width: '100%', maxWidth: 780 }}>
            <div className="lrn-player">
              <button className="lrn-play" aria-label="Play video">
                ▶
              </button>
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 18,
                  color: '#eaf4f3',
                  font: '600 15px/1.3 var(--font-sans)',
                }}
              >
                The same-bottom trick
                <br />
                <span style={{ fontWeight: 400, color: '#aacbc8', fontSize: 13 }}>
                  2:04 · captioned
                </span>
              </div>
            </div>
            <div className="lrn-assure">
              <span>✓ Approved Potenova lesson</span>
              <span>✓ No ads · no recommendations</span>
              <span>✓ Captioned</span>
              <span>✓ Plays in Canada</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span className="lrn-muted" style={{ fontSize: 14 }}>
                When it finishes, you go back to practice — not to another video.
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="lrn-btn lrn-btn-g" onClick={() => setView('game')}>
                  Try the game
                </button>
                <button className="lrn-btn" onClick={() => setView('practice')}>
                  Back to practice
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---- Play ------------------------------------------------------------------
  if (view === 'game') {
    return (
      <div className="lrn">
        <TopBar
          nickname={nickname}
          chip={{ text: 'Play · Fraction match', cls: 'coral' }}
          right={
            <button className="lrn-iconbtn" onClick={() => setView('teach')}>
              Back
            </button>
          }
        />
        <OrderingGame onDone={() => setView('practice')} />
      </div>
    );
  }

  // ---- Practice (the real session loop) --------------------------------------
  const remaining = budget ? budget.itemsRemaining : null;
  const delivered = budget ? budget.itemsDelivered : 0;
  const maxItems = budget ? budget.maxItems : 0;
  const pct = maxItems > 0 ? Math.min(100, Math.round((delivered / maxItems) * 100)) : 0;

  return (
    <div className="lrn">
      <TopBar
        nickname={nickname}
        chip={{ text: skillName, cls: 'teal' }}
        right={
          budget ? (
            <div
              className="lrn-dots"
              role="img"
              aria-label={`Question ${delivered + 1} of ${maxItems}`}
            >
              {Array.from({ length: Math.min(maxItems, 8) }).map((_, i) => (
                <span
                  key={i}
                  className={`lrn-dot${i < delivered ? ' done' : i === delivered ? ' now' : ''}`}
                />
              ))}
              <span
                style={{
                  font: '600 13px/1 var(--font-sans)',
                  color: 'var(--muted)',
                  marginLeft: 4,
                }}
              >
                {Math.min(delivered + 1, maxItems)} of {maxItems}
              </span>
            </div>
          ) : null
        }
      />

      <main className="lrn-stage">
        {!task ? (
          <div className="lrn-q">
            <h1 style={{ fontSize: 30, margin: '0 0 12px' }}>Let’s find your starting point</h1>
            <p className="lrn-muted" style={{ fontSize: 16 }}>
              {next?.explanation ?? 'Getting your first question ready…'}
            </p>
            <div style={{ marginTop: 20 }}>
              <button className="lrn-btn" onClick={() => void begin(subject)} disabled={busy}>
                Start
              </button>
            </div>
          </div>
        ) : (
          <div className="lrn-q">
            <div style={{ font: '600 15px/1 var(--font-sans)', color: 'var(--teal-ink)' }}>
              {skillName}
            </div>
            <h1 style={{ fontSize: 36, margin: '12px 0 26px' }}>{task.question}</h1>
            <div
              className="lrn-ans-grid"
              style={{
                gridTemplateColumns: `repeat(${task.options.length <= 2 ? 2 : task.options.length <= 4 ? 2 : 3}, minmax(0,1fr))`,
              }}
            >
              {task.options.map((opt) => {
                const isSel = selected === opt;
                const cls = answered && isSel ? 'correct' : isSel ? 'sel' : '';
                return (
                  <button
                    key={opt}
                    className={`lrn-ans ${cls}`}
                    aria-pressed={isSel}
                    disabled={busy || answered}
                    onClick={() => {
                      setSelected(opt);
                      if (feedback?.kind === 'wrong') {
                        setFeedback(null);
                        setHintMsg(null);
                      }
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={`lrn-hint${feedback.kind === 'correct' ? ' good' : ''}`}>
                <span
                  className="ic"
                  aria-hidden="true"
                  style={{ background: feedback.kind === 'correct' ? '#0f6b42' : 'var(--coral)' }}
                >
                  {feedback.kind === 'correct' ? '✓' : '?'}
                </span>
                <div>
                  <strong style={{ color: feedback.kind === 'correct' ? '#0f6b42' : '#7a4a28' }}>
                    {feedback.message}
                  </strong>{' '}
                  {hintMsg && <span style={{ color: '#7a4a28' }}>{hintMsg}</span>}
                </div>
              </div>
            )}

            {answered ? (
              <div className="lrn-actions">
                <button className="lrn-btn" onClick={() => void loadNext()} disabled={busy}>
                  Next question
                </button>
              </div>
            ) : (
              <div className="lrn-actions">
                <button
                  className="lrn-btn"
                  onClick={() => void submit()}
                  disabled={busy || !selected}
                >
                  Check my answer
                </button>
                <button
                  className="lrn-actbtn"
                  style={{ borderColor: 'var(--coral)', color: '#a2502a' }}
                  onClick={() => {
                    setTeachMode('step');
                    setView('teach');
                  }}
                >
                  Show me how
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="lrn-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
          <span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--muted)' }}>
            Session
          </span>
          <span className="lrn-pbar">
            <span style={{ width: `${pct}%` }} />
          </span>
          {remaining != null && (
            <span className="lrn-muted" style={{ fontSize: 13 }}>
              {remaining} left
            </span>
          )}
        </div>
        <button className="lrn-iconbtn" onClick={() => setView('summary')}>
          Take a break
        </button>
      </footer>

      {err && (
        <p
          className="lrn-muted"
          style={{ color: '#a12b2b', textAlign: 'center', padding: '0 24px 12px' }}
          role="alert"
        >
          {err}
        </p>
      )}
    </div>
  );
}

// ---- Shared pieces -----------------------------------------------------------

function TopBar({
  nickname,
  chip,
  right,
}: {
  nickname: string;
  chip: { text: string; cls: 'teal' | 'coral' | 'blue' };
  right: ReactNode;
}) {
  return (
    <header className="lrn-top">
      <div className="lrn-who">
        <span className="lrn-av" aria-hidden="true">
          {nickname.charAt(0).toUpperCase()}
        </span>
        <span style={{ font: '600 16px/1 var(--font-sans)' }}>{nickname}</span>
        <span className={`lrn-chip ${chip.cls}`}>{chip.text}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{right}</div>
    </header>
  );
}

/** A fixed, approved worked example. Fraction skills get the bar-model lesson;
 *  other skills get a plain idea card — never a mismatched fraction diagram. */
function WorkedExample({ skillId }: { skillId: string }) {
  if (isFractionSkill(skillId)) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--line, #ebe7db)',
          borderRadius: 16,
          padding: '22px 26px',
        }}
      >
        <p style={{ fontSize: 16, margin: '0 0 18px' }}>
          <strong>The trick:</strong> give both fractions the same bottom number, then the bigger
          top wins. Example — compare <strong>1/2</strong> and <strong>2/5</strong> using tenths:
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <ExampleBar label="1/2 = 5/10" filled={5} />
          <ExampleBar label="2/5 = 4/10" filled={4} />
        </div>
        <div
          style={{
            background: '#eaf5f4',
            border: '1px solid #cfe6e4',
            borderRadius: 12,
            padding: '12px 14px',
            marginTop: 16,
            fontSize: 15,
            color: 'var(--teal-ink)',
          }}
        >
          <strong>5 tenths beats 4 tenths</strong> — so 1/2 is larger.
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line, #ebe7db)',
        borderRadius: 16,
        padding: '22px 26px',
        fontSize: 16,
      }}
    >
      <p style={{ margin: 0 }}>
        <strong>The idea:</strong> break it into one small step at a time, and check each step
        before moving on. Watch the short video or play the game to see it in action, then head back
        and try one yourself.
      </p>
    </div>
  );
}

function ExampleBar({ label, filled }: { label: string; filled: number }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <span className="lrn-num">{filled === 5 ? 1 : 2}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div className="lrn-bar" role="img" aria-label={`${filled} of ten shaded`}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={`lrn-cell${i < filled ? ' on' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Concept game: order three fractions smallest → largest by tapping. It writes
 * NO evidence — purely a learning aid, so it can't shortcut mastery. Tapping a
 * card fills the next slot; "Clear" resets; "Check" compares to the true order.
 */
function OrderingGame({ onDone }: { onDone: () => void }) {
  const cards = ['2/5', '1/2', '3/4'] as const;
  const value: Record<string, number> = { '2/5': 0.4, '1/2': 0.5, '3/4': 0.75 };
  const [placed, setPlaced] = useState<string[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);

  const place = (c: string): void => {
    if (placed.includes(c) || placed.length >= 3) return;
    setPlaced([...placed, c]);
    setChecked(null);
  };
  const clear = (): void => {
    setPlaced([]);
    setChecked(null);
  };
  const check = (): void => {
    const sorted = [...placed].sort((a, b) => value[a] - value[b]);
    setChecked(placed.length === 3 && placed.every((c, i) => c === sorted[i]));
  };

  return (
    <main className="lrn-stage">
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 760 }}>
        <h1 style={{ fontSize: 30 }}>Tap the fractions smallest → largest</h1>
        <p className="lrn-muted" style={{ fontSize: 16, margin: '8px 0 28px' }}>
          Tap them in order to fill the track, then check.
        </p>

        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 30 }}>
          {cards.map((c) => (
            <button
              key={c}
              className="lrn-fcard"
              disabled={placed.includes(c)}
              onClick={() => place(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'center' }}>
          <span className="lrn-muted" style={{ fontSize: 13 }}>
            smallest
          </span>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`lrn-slot${placed[i] ? ' filled' : ''}`}>
              {placed[i] ?? 'tap a card'}
            </div>
          ))}
          <span className="lrn-muted" style={{ fontSize: 13 }}>
            largest
          </span>
        </div>

        {checked !== null && (
          <p
            style={{
              marginTop: 20,
              fontWeight: 600,
              color: checked ? '#0f6b42' : '#a2502a',
            }}
          >
            {checked ? 'That’s the right order — nice!' : 'Not quite — tap Clear and try again.'}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button className="lrn-btn lrn-btn-g" onClick={clear}>
            Clear
          </button>
          <button className="lrn-btn" onClick={check} disabled={placed.length < 3}>
            Check my order
          </button>
          <button className="lrn-btn lrn-btn-g" onClick={onDone}>
            Now you try
          </button>
        </div>
        <p className="lrn-muted" style={{ fontSize: 13, marginTop: 16 }}>
          Playing is practice — it stays inside today’s time limit and doesn’t change your mastery.
        </p>
      </div>
    </main>
  );
}
