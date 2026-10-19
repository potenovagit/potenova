import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { isApiError } from '../api';
import './Onboarding.css';

/**
 * Caregiver onboarding — the approved guided linear stepper.
 *
 * Steps 1–3 (create account → verify email → add a second factor) are the IdP
 * account phase. Real credential/passkey/MFA handling is the managed IdP's job
 * (ADR-0008), so those screens stay client-side ceremony — no credentials are
 * sent anywhere. Completing them stands in for an IdP-verified guardian, so the
 * API is then touched where the backend models state:
 *   • step 3 → 4 (finish account) → signIn (/auth/session): the SERVER provisions
 *     the family + owner guardian from the verified subject and returns their ids
 *   • step 4 (add child)   → addLearner (under the signed-in family)
 *   • step 5 (consent)     → grantConsent (+ multimodal grants if voice/photo on)
 *   • step 6 (start trial) → activateEntitlement
 * "Activated" therefore means a signed-in guardian with MFA and a child with
 * consent — no stray empty accounts. Mastery is never set here; it stays derived.
 */

type Focus = 'math' | 'english' | 'both';
type Mfa = 'passkey' | 'authenticator';

const rid = (p: string): string => `${p}-${Math.random().toString(36).slice(2, 10)}`;

interface Ids {
  familyId: string;
  guardianId: string;
  learnerId: string;
}

function stashActive(
  ids: Ids,
  nickname: string,
  grade: number,
  focus: Focus,
  modalities: { voice: boolean; photo: boolean },
): void {
  try {
    localStorage.setItem(
      'potenova.active',
      JSON.stringify({ ...ids, nickname, grade, focus, modalities }),
    );
  } catch {
    /* private mode / storage disabled — the flow still works, dashboard just can't preload */
  }
}

const PHASES = ['Account', 'Child & consent', 'Start'] as const;
function phaseOf(step: number): number {
  if (step <= 3) return 0;
  if (step <= 5) return 1;
  return 2;
}

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Generated once per onboarding attempt (synthetic Stage-2 identifiers).
  const idsRef = useRef<Ids>({
    familyId: rid('fam'),
    guardianId: rid('gdn'),
    learnerId: rid('lnr'),
  });

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mfa, setMfa] = useState<Mfa>('passkey');
  const [nickname, setNickname] = useState('');
  const [grade, setGrade] = useState(4);
  const [focus, setFocus] = useState<Focus>('math');
  const [consentParent, setConsentParent] = useState(true);
  const [consentVoice, setConsentVoice] = useState(false);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [familyReady, setFamilyReady] = useState(false);

  // Keep the viewport at the top when the step changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const go = (n: number): void => {
    setErr(null);
    setStep(n);
  };

  const fail = (e: unknown, fallback: string): void => {
    setErr(isApiError(e) ? `${e.message} (${e.code})` : fallback);
  };

  /**
   * Sign in through the real exchange (ADR-0008). Steps 1–3 are the IdP account
   * phase; completing them stands in for an Entra-verified guardian, so here we
   * call /auth/session with a stable synthetic subject. The SERVER provisions the
   * family + owner guardian and returns their real ids, which the rest of
   * onboarding then uses — no client-minted family, no client-side createFamily.
   * Idempotent: a repeat maps to the same family.
   */
  async function ensureSignedIn(): Promise<void> {
    if (familyReady) return;
    const idpSubject = `idp-synthetic:${email.trim().toLowerCase() || idsRef.current.guardianId}`;
    const { actor } = await api.signIn(idpSubject);
    idsRef.current = {
      ...idsRef.current,
      familyId: actor.familyId,
      guardianId: actor.guardianId,
    };
    setFamilyReady(true);
  }

  /** Step 3 → 4: finish the account phase by signing in (provisions the family). */
  async function submitAccount(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await ensureSignedIn();
      go(4);
    } catch (e) {
      fail(e, 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** Step 4 → 5: add the child under the signed-in guardian's family. */
  async function submitChild(): Promise<void> {
    if (!nickname.trim()) {
      setErr('Please enter a nickname for your child.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await ensureSignedIn(); // safety net; normally already done at step 3
      const { familyId, guardianId, learnerId } = idsRef.current;
      await api.addLearner(familyId, guardianId, learnerId, nickname.trim(), grade);
      go(5);
    } catch (e) {
      fail(e, 'Could not add your child. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** Step 5 → 6: record consent (and any per-modality grants). */
  async function submitConsent(): Promise<void> {
    if (!consentParent) {
      setErr('Guardian consent is required to continue.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { familyId, guardianId } = idsRef.current;
      await api.grantConsent(familyId, guardianId);
      if (consentVoice || consentPhoto) {
        // The demo grants both optional modalities together; the backend stores
        // each as its own purpose-scoped grant, revocable later from the dashboard.
        await api.grantMultimodalConsent(familyId, guardianId);
      }
      go(6);
    } catch (e) {
      fail(e, 'Could not record consent. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** Step 6 → 7: activate the trial entitlement. */
  async function submitTrial(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const { familyId } = idsRef.current;
      await api.activateEntitlement(familyId);
      stashActive(idsRef.current, nickname.trim(), grade, focus, {
        voice: consentVoice,
        photo: consentPhoto,
      });
      go(7);
    } catch (e) {
      fail(e, 'Could not start the trial. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Step 7: Ready (distinct full-width layout) ----------------------------
  if (step === 7) {
    return (
      <div className="onb-ready">
        <main className="onb-ready-main">
          <span className="onb-ready-mark" aria-hidden="true">
            ✓
          </span>
          <h1 style={{ fontSize: 36, maxWidth: '16ch' }}>
            You’re all set — {nickname.trim() || 'your child'}’s ready to start.
          </h1>
          <p
            style={{ color: 'var(--muted)', fontSize: 17, margin: '14px 0 26px', maxWidth: '42ch' }}
          >
            Consent is on and your trial is active. The first session opens with a quick baseline to
            find the right starting point.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a className="onb-btn onb-btn-p" href="#/learn">
              Find the starting point
            </a>
            <a className="onb-btn onb-btn-g" href="#/dashboard">
              Go to parent dashboard
            </a>
          </div>
        </main>
        <aside className="onb-ready-side">
          <h2 style={{ fontSize: 20 }}>Finish setting up</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '6px 0 16px' }}>
            Optional — do these anytime from your dashboard.
          </p>
          <div>
            <div className="onb-chk">
              <span className="onb-tick done" aria-hidden="true">
                ✓
              </span>
              <span>
                Account secured with {mfa === 'passkey' ? 'a passkey' : 'an authenticator app'}
              </span>
            </div>
            <div className="onb-chk">
              <span className="onb-tick done" aria-hidden="true">
                ✓
              </span>
              <span>Consent recorded</span>
            </div>
            <div className="onb-chk">
              <span className="onb-tick todo" aria-hidden="true">
                +
              </span>
              <span>Save your recovery codes</span>
            </div>
            <div className="onb-chk">
              <span className="onb-tick todo" aria-hidden="true">
                +
              </span>
              <span>Set daily time limits</span>
            </div>
            <div className="onb-chk">
              <span className="onb-tick todo" aria-hidden="true">
                +
              </span>
              <span>Add another child</span>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  // ---- Shared layout for steps 1–6 -------------------------------------------
  const phase = phaseOf(step);
  return (
    <div className="onb">
      <aside className="onb-rail">
        <a className="onb-brand" href="#/">
          <span className="m" aria-hidden="true">
            P
          </span>
          <span style={{ font: '700 21px/1 var(--font-serif)' }}>Potenova</span>
        </a>
        <div>
          <h1>Set up in a few minutes.</h1>
          <p>
            Account → add your child → consent → start. We’ll guide you the whole way and save your
            place if you step away.
          </p>
        </div>
        <div className="foot">🇨🇦 Data in Canada · 🔒 No ads</div>
      </aside>

      <main className="onb-pane">
        <div className="onb-phases" aria-label={`Progress: ${PHASES[phase]} phase`}>
          {PHASES.map((p, i) => (
            <div key={p} className={`onb-ph${i === phase ? ' on' : ''}${i < phase ? ' done' : ''}`}>
              {p}
              {i < phase ? ' ✓' : ''}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <p className="onb-kicker">Account · step 1 of 3</p>
            <h1 style={{ fontSize: 32 }}>Create your parent account</h1>
            <p className="onb-lead">
              This account is yours — you’ll add your child and grant consent next.
            </p>
            <form
              className="onb-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) {
                  setErr('Please enter your email.');
                  return;
                }
                go(2);
              }}
            >
              <div>
                <label className="onb-lab" htmlFor="f-name">
                  Your name
                </label>
                <input
                  className="onb-inp"
                  id="f-name"
                  type="text"
                  placeholder="Alex Carter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="onb-lab" htmlFor="f-email">
                  Email
                </label>
                <input
                  className="onb-inp"
                  id="f-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="onb-lab" htmlFor="f-pass">
                  Password
                </label>
                <input
                  className="onb-inp"
                  id="f-pass"
                  type="password"
                  placeholder="12+ characters"
                />
                <span className="onb-hint">
                  Use a long passphrase. We’ll add a second factor next.
                </span>
              </div>
              <div className="onb-actions">
                <button className="onb-btn onb-btn-p" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="onb-kicker">Account · step 2 of 3</p>
            <h1 style={{ fontSize: 32 }}>Confirm your email</h1>
            <p className="onb-lead">
              We sent a 6-digit code to <strong>{email || 'you@example.com'}</strong>. Enter it
              below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(3);
              }}
            >
              <div className="onb-code-row" role="group" aria-label="6-digit code">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    className="onb-code"
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>
              <div className="onb-actions">
                <button className="onb-btn onb-btn-g" type="button" onClick={() => go(1)}>
                  Change email
                </button>
                <button className="onb-btn onb-btn-p" type="submit" style={{ flex: 1 }}>
                  Verify email
                </button>
              </div>
            </form>
            <p className="onb-note muted">
              Didn’t get it? This is a preview — enter any digits and continue.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="onb-kicker">Account · step 3 of 3 · required</p>
            <h1 style={{ fontSize: 32 }}>Add a second factor</h1>
            <p className="onb-lead">
              Pick one. You’ll get recovery codes to store safely in case you lose your device.
            </p>
            <form
              className="onb-form"
              style={{ maxWidth: 520 }}
              onSubmit={(e) => {
                e.preventDefault();
                void submitAccount();
              }}
            >
              <label className={`onb-opt${mfa === 'passkey' ? ' sel' : ''}`}>
                <input
                  type="radio"
                  name="mfa"
                  checked={mfa === 'passkey'}
                  onChange={() => setMfa('passkey')}
                />
                <span className="t">
                  <strong>Passkey</strong> <span className="onb-tag">· recommended</span>
                  <span className="sub">
                    Face / fingerprint / device PIN. Nothing to type, phishing-resistant.
                  </span>
                </span>
              </label>
              <label className={`onb-opt${mfa === 'authenticator' ? ' sel' : ''}`}>
                <input
                  type="radio"
                  name="mfa"
                  checked={mfa === 'authenticator'}
                  onChange={() => setMfa('authenticator')}
                />
                <span className="t">
                  <strong>Authenticator app</strong>
                  <span className="sub">Scan a QR code; enter a 6-digit code at sign-in.</span>
                </span>
              </label>
              <div className="onb-actions">
                <button
                  className="onb-btn onb-btn-g"
                  type="button"
                  onClick={() => go(2)}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  className="onb-btn onb-btn-p"
                  type="submit"
                  style={{ flex: 1 }}
                  disabled={busy}
                >
                  {busy ? 'Setting up…' : 'Turn on & continue'}
                </button>
              </div>
              <p className="onb-note muted">Required before your child’s first session.</p>
            </form>
          </>
        )}

        {step === 4 && (
          <>
            <p className="onb-kicker">Child &amp; consent · 1 of 2</p>
            <h1 style={{ fontSize: 32 }}>Add your child</h1>
            <p className="onb-lead">
              This sets up a quick baseline to find the right starting point.
            </p>
            <form
              className="onb-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitChild();
              }}
            >
              <div>
                <label className="onb-lab" htmlFor="l-nick">
                  Learner nickname
                </label>
                <input
                  className="onb-inp"
                  id="l-nick"
                  type="text"
                  placeholder="e.g. Sam"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div>
                <label className="onb-lab" htmlFor="l-grade">
                  Grade
                </label>
                <select
                  className="onb-inp"
                  id="l-grade"
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="onb-lab">Focus to start</span>
                <div className="onb-seg" role="group" aria-label="Focus subject">
                  {(['math', 'english', 'both'] as Focus[]).map((f) => (
                    <label key={f} className={focus === f ? 'sel' : ''}>
                      <input
                        type="radio"
                        name="focus"
                        checked={focus === f}
                        onChange={() => setFocus(f)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      {f === 'math' ? 'Math' : f === 'english' ? 'English' : 'Both'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="onb-actions">
                <button
                  className="onb-btn onb-btn-g"
                  type="button"
                  onClick={() => go(3)}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  className="onb-btn onb-btn-p"
                  type="submit"
                  style={{ flex: 1 }}
                  disabled={busy}
                >
                  {busy ? 'Adding…' : 'Continue to consent'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 5 && (
          <>
            <p className="onb-kicker">Child &amp; consent · 2 of 2</p>
            <h1 style={{ fontSize: 30 }}>Consent &amp; permissions</h1>
            <p className="onb-lead" style={{ margin: '8px 0 18px' }}>
              Review the <a href="#">privacy policy</a> and <a href="#">consent terms</a> (v[POLICY
              VERSION]).
            </p>
            <form
              className="onb-form"
              style={{ maxWidth: 540 }}
              onSubmit={(e) => {
                e.preventDefault();
                void submitConsent();
              }}
            >
              <label className={`onb-opt${consentParent ? ' sel' : ''}`}>
                <input
                  type="checkbox"
                  checked={consentParent}
                  onChange={(e) => setConsentParent(e.target.checked)}
                />
                <span className="t">
                  <strong>
                    I am this child’s parent or legal guardian, and I consent to Potenova providing
                    personalised learning to them.
                  </strong>
                  <span className="sub">
                    Required. Covers adaptive, personalised math &amp; English learning for this
                    learner.
                  </span>
                </span>
              </label>
              <label className={`onb-opt${consentVoice ? ' sel' : ''}`}>
                <input
                  type="checkbox"
                  checked={consentVoice}
                  onChange={(e) => setConsentVoice(e.target.checked)}
                />
                <span className="t">
                  <strong>Allow voice input</strong> <span className="onb-tag">· optional</span>
                  <span className="sub">
                    Lets your child answer out loud and read passages aloud — natural for younger
                    learners and anyone who finds typing slow, and it builds reading fluency. Speech
                    is recognised in Canada, and a low-confidence reading is never graded — it
                    simply asks again.
                  </span>
                </span>
              </label>
              <label className={`onb-opt${consentPhoto ? ' sel' : ''}`}>
                <input
                  type="checkbox"
                  checked={consentPhoto}
                  onChange={(e) => setConsentPhoto(e.target.checked)}
                />
                <span className="t">
                  <strong>Allow photo &amp; handwriting</strong>{' '}
                  <span className="onb-tag">· optional</span>
                  <span className="sub">
                    Lets your child photograph written work so Potenova can give feedback on their
                    actual handwriting and show-your-work math — not just typed, multiple-choice
                    answers. Images are processed in Canada.
                  </span>
                </span>
              </label>
              <p className="onb-note muted" style={{ margin: 0 }}>
                Processing, storage and backups stay in a Canadian region.
              </p>
              <div className="onb-actions">
                <button
                  className="onb-btn onb-btn-g"
                  type="button"
                  onClick={() => go(4)}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  className="onb-btn onb-btn-p"
                  type="submit"
                  style={{ flex: 1 }}
                  disabled={busy}
                >
                  {busy ? 'Recording…' : 'Grant consent & continue'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 6 && (
          <>
            <p className="onb-kicker">Start · begin your free trial</p>
            <h1 style={{ fontSize: 32 }}>Start your free trial</h1>
            <p className="onb-lead">
              Full access for the trial period — no credit card required to begin.
            </p>
            <div className="onb-summary">
              <div className="ro">
                <span className="muted">Free trial</span>
                <strong>[FREE TRIAL LENGTH]</strong>
              </div>
              <div className="ro">
                <span className="muted">Cost today</span>
                <strong style={{ color: 'var(--teal-ink)' }}>$0 · no card</strong>
              </div>
              <div className="ro">
                <span className="muted">After the trial</span>
                <strong>[MONTHLY PRICE] · you choose</strong>
              </div>
              <div className="fine">
                We’ll email you before it ends. If you don’t pick a plan, the account pauses — your
                data isn’t deleted immediately.
              </div>
            </div>
            <div className="onb-actions">
              <button
                className="onb-btn onb-btn-g"
                type="button"
                onClick={() => go(5)}
                disabled={busy}
              >
                Back
              </button>
              <button
                className="onb-btn onb-btn-p"
                type="button"
                style={{ flex: 1 }}
                onClick={() => void submitTrial()}
                disabled={busy}
              >
                {busy ? 'Starting…' : 'Start free trial'}
              </button>
            </div>
            <p className="onb-note muted">
              Trial length and pricing are placeholders pending final decisions.
            </p>
          </>
        )}

        {err && (
          <p className="onb-note err" role="alert">
            {err}
          </p>
        )}
      </main>
    </div>
  );
}
