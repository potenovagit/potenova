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
                setFamily({ ...family, consentGiven: true });
                setNote({ kind: 'ok', text: 'child_learning consent granted.' });
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
                      <td>{skillLabel(r.skillId)}</td>
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

function ChildView({ family, learner }: { family: Family | null; learner: Learner | null }) {
  const [skill, setSkill] = useState(DEMO_SKILLS[0]);
  const [projection, setProjection] = useState<api.Projection | null>(null);
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

  const band = bandForGrade(learner.grade);

  const answer = async (correct: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      await api.submitEvidence(family.familyId, learner.learnerId, skill.id, correct);
      const p = await api.getProjection(family.familyId, learner.learnerId, skill.id);
      setProjection(p.projection);
      setNote({
        kind: 'ok',
        text: correct ? 'Nice — that’s recorded.' : 'Got it — we’ll keep practising this.',
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`col child band-${band}`}>
      <h1>Hi {learner.nickname} 👋</h1>
      <p className="lede">Let’s practise. Pick the bigger fraction.</p>

      <div className="skillpick">
        {DEMO_SKILLS.map((s) => (
          <button
            key={s.id}
            className={s.id === skill.id ? 'on' : ''}
            onClick={() => {
              setSkill(s);
              setProjection(null);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="task">
        <div className="q">Which is larger?</div>
        <div className="choices">
          <button className="choice" disabled={busy} onClick={() => answer(true)}>
            <span className="frac">
              <span>1</span>
              <span className="bar" />
              <span>2</span>
            </span>
          </button>
          <button className="choice" disabled={busy} onClick={() => answer(false)}>
            <span className="frac">
              <span>1</span>
              <span className="bar" />
              <span>3</span>
            </span>
          </button>
        </div>
      </div>

      <NoteBar note={note} />

      {projection && (
        <div className="progress">
          <div className="pline">
            <span className={`pill ${standingTone(deriveStanding(projection))}`}>
              {standingLabel(deriveStanding(projection))}
            </span>
            <span className="muted">
              {projection.evidenceCount} attempt{projection.evidenceCount === 1 ? '' : 's'} ·{' '}
              {confidencePct(projection.confidence)} confidence
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/** The child screen shows an encouraging standing; the authoritative classification
 *  still lives in the domain — this is a light local read of the same projection. */
function deriveStanding(p: api.Projection): string {
  if (p.evidenceCount === 0) return 'unknown';
  if (p.confidence >= 0.8) return 'demonstrated';
  if (p.confidence >= 0.5) return 'developing';
  return 'emerging';
}
