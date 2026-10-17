import './Landing.css';

/** Public marketing/landing page. Static; CTAs route into the signup flow. */
export function Landing() {
  return (
    <div className="landing">
      {/* NAV */}
      <header className="ln-nav">
        <div className="ln-wrap ln-nav-inner">
          <a className="ln-brand" href="#/">
            <span className="ln-mark" aria-hidden="true">
              P
            </span>
            <span style={{ font: '700 21px/1 var(--font-serif)' }}>Potenova</span>
          </a>
          <nav className="ln-navlinks" aria-label="Primary">
            <a className="hide-sm" href="#how">
              How it works
            </a>
            <a className="hide-sm" href="#safety">
              Safety &amp; privacy
            </a>
            <a className="hide-sm" href="#pricing">
              Pricing
            </a>
            <a className="hide-sm" href="#/console">
              Log in
            </a>
            <a className="ln-btn ln-btn-primary" href="#/signup" style={{ minHeight: 42 }}>
              Start free
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="ln-section" style={{ paddingTop: 64 }}>
        <div className="ln-wrap ln-hero">
          <div className="ln-hero-copy">
            <span className="ln-eyebrow">Math &amp; English · Grades 1–8</span>
            <h1>Personalised learning that meets your child where they are.</h1>
            <p className="ln-hero-sub">
              Potenova adapts to each learner, teaches with hints instead of handing over answers,
              and keeps parents in the loop — aligned to the Ontario curriculum, with your child’s
              data kept in Canada.
            </p>
            <div className="ln-row" style={{ gap: 14 }}>
              <a className="ln-btn ln-btn-primary" href="#/signup">
                Start your child’s free trial
              </a>
              <a className="ln-btn ln-btn-ghost" href="#how">
                See how it works
              </a>
            </div>
            <p className="ln-muted" style={{ fontSize: 14, marginTop: 18 }}>
              No credit card to try · Cancel anytime · Built for families, not ads
            </p>
          </div>

          <div className="ln-hero-visual">
            <div className="ln-card ln-preview" aria-hidden="true">
              <div
                className="ln-row"
                style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}
              >
                <span style={{ font: '600 14px/1 var(--font-sans)', color: 'var(--muted)' }}>
                  Fractions · Equivalence
                </span>
                <span
                  style={{
                    font: '600 13px/1 var(--font-sans)',
                    color: 'var(--teal-ink)',
                    background: 'var(--teal-wash)',
                    padding: '5px 10px',
                    borderRadius: 999,
                  }}
                >
                  Independent check
                </span>
              </div>
              <p style={{ font: '600 22px/1.3 var(--font-sans)', margin: '0 0 18px' }}>
                Which fraction is equal to <strong style={{ color: 'var(--teal)' }}>1/2</strong>?
              </p>
              <div className="ln-opts">
                <div className="ln-opt">2/5</div>
                <div className="ln-opt sel">3/6</div>
                <div className="ln-opt">2/3</div>
                <div className="ln-opt">4/10</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginTop: 18,
                  background: '#fdf3ea',
                  border: '1px solid #f6dcc6',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: '0 0 auto',
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: 'var(--coral)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: '700 15px/1 var(--font-sans)',
                  }}
                >
                  ?
                </span>
                <span style={{ font: '500 15px/1.4 var(--font-sans)', color: '#7a4a28' }}>
                  Hint: try splitting the same whole into twice as many equal parts.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="ln-trust">
        <div className="ln-wrap ln-trust-inner">
          <div className="t">
            <b>🇨🇦 Data stays in Canada</b>
            <br />
            <span>Processing, storage and backups in a Canadian region.</span>
          </div>
          <div className="t">
            <b>Personalised learning, not homework answers</b>
            <br />
            <span>Hints and next steps — never a finished assignment.</span>
          </div>
          <div className="t">
            <b>Parents stay in control</b>
            <br />
            <span>Consent, time limits and a clear view of progress.</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="ln-section">
        <div className="ln-wrap">
          <span className="ln-eyebrow">How it works</span>
          <h2 style={{ marginTop: 12, maxWidth: '18ch' }}>
            Three steps from first login to steady progress.
          </h2>
          <div className="ln-cards3">
            <div className="ln-card">
              <div className="ln-num" aria-hidden="true">
                01
              </div>
              <h3 style={{ fontSize: 23, marginTop: 10 }}>Find the starting point</h3>
              <p className="ln-muted" style={{ marginTop: 10, fontSize: 16 }}>
                A short, adaptive baseline finds where your child is today — no grade-wide
                guesswork, and it stops as soon as it knows enough.
              </p>
            </div>
            <div className="ln-card">
              <div className="ln-num" aria-hidden="true">
                02
              </div>
              <h3 style={{ fontSize: 23, marginTop: 10 }}>Practice that adapts</h3>
              <p className="ln-muted" style={{ marginTop: 10, fontSize: 16 }}>
                Each session picks the next skill, offers a hint on the first slip, and changes
                approach when your child is stuck — one concept at a time.
              </p>
            </div>
            <div className="ln-card">
              <div className="ln-num" aria-hidden="true">
                03
              </div>
              <h3 style={{ fontSize: 23, marginTop: 10 }}>A parent dashboard</h3>
              <p className="ln-muted" style={{ marginTop: 10, fontSize: 16 }}>
                See what’s mastered, what’s due for review, and set daily limits — mastery is earned
                from real work, never set by a button.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAFETY */}
      <section
        id="safety"
        className="ln-section"
        style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}
      >
        <div className="ln-wrap ln-row" style={{ gap: 48, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <span className="ln-eyebrow">Safety &amp; privacy</span>
            <h2 style={{ marginTop: 12, maxWidth: '16ch' }}>
              Built child-safety-first, by design.
            </h2>
            <p style={{ fontSize: 18, color: '#3a4654', marginTop: 18, maxWidth: '46ch' }}>
              We treat a child’s learning data as something to protect, not to monetize. The safety
              rules are enforced in the product itself — not left to policy.
            </p>
          </div>
          <div className="ln-checklist">
            {[
              [
                'Nothing runs before consent.',
                'A parent grants consent first; revoke it and processing stops.',
              ],
              [
                'Canadian residency.',
                'AI, voice, vision, analytics, logs and backups stay in-region.',
              ],
              [
                'No ads, no selling data.',
                'Your child isn’t the product, and there’s no commercial pressure in the learning screen.',
              ],
              [
                'Right to be forgotten.',
                'Ask us to delete your family’s data and it’s removed across every system.',
              ],
            ].map(([h, b]) => (
              <div className="ln-check" key={h}>
                <span className="ln-tick" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <strong>{h}</strong> <span className="ln-muted">{b}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT IT IS / ISN'T */}
      <section className="ln-section">
        <div className="ln-wrap ln-row" style={{ gap: 24 }}>
          <div
            className="ln-card"
            style={{
              flex: '1 1 320px',
              minWidth: 0,
              background: '#f2f8f7',
              borderColor: '#cfe6e4',
            }}
          >
            <h3 style={{ fontSize: 22, color: 'var(--teal-ink)' }}>What Potenova is</h3>
            <ul
              style={{
                margin: '16px 0 0',
                paddingLeft: 20,
                color: '#2c3a46',
                fontSize: 16,
                lineHeight: 1.9,
              }}
            >
              <li>Personalised math &amp; English, Grades 1–8</li>
              <li>Aligned to the Ontario curriculum</li>
              <li>Adaptive, one concept at a time</li>
              <li>Transparent to parents</li>
            </ul>
          </div>
          <div className="ln-card" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h3 style={{ fontSize: 22, color: 'var(--coral-ink)' }}>What it isn’t</h3>
            <ul
              style={{
                margin: '16px 0 0',
                paddingLeft: 20,
                color: 'var(--muted)',
                fontSize: 16,
                lineHeight: 1.9,
              }}
            >
              <li>A homework-answer machine</li>
              <li>A general-purpose chatbot</li>
              <li>A companion or friend substitute</li>
              <li>A place for ads or upsells to kids</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING / CTA */}
      <section id="pricing" className="ln-section">
        <div className="ln-wrap">
          <div className="ln-card ln-cta">
            <span className="ln-eyebrow" style={{ color: '#7fcfca' }}>
              Pricing
            </span>
            <h2 style={{ marginTop: 12 }}>Start with a free trial.</h2>
            <p
              style={{ fontSize: 18, color: '#b6d3d1', maxWidth: '44ch', margin: '16px auto 8px' }}
            >
              Try Potenova with your child, then choose a plan if it’s working.
            </p>
            <p style={{ fontSize: 15, color: '#8fbdba', margin: '0 0 28px' }}>
              Trial length and price: <strong>[FREE TRIAL LENGTH]</strong> ·{' '}
              <strong>[MONTHLY PRICE]</strong>{' '}
              <span style={{ opacity: 0.8 }}>(placeholders — pending)</span>
            </p>
            <div className="ln-row" style={{ gap: 14, justifyContent: 'center' }}>
              <a className="ln-btn ln-btn-primary" href="#/signup">
                Create a parent account
              </a>
              <a
                className="ln-btn"
                href="#how"
                style={{
                  background: 'transparent',
                  border: '1.5px solid #4e7c7a',
                  color: '#eaf4f3',
                }}
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ln-footer">
        <div
          className="ln-wrap ln-row"
          style={{ gap: 24, justifyContent: 'space-between', paddingBlock: 40 }}
        >
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div className="ln-row" style={{ alignItems: 'center', gap: 10 }}>
              <span
                className="ln-mark"
                aria-hidden="true"
                style={{ width: 30, height: 30, fontSize: 16 }}
              >
                P
              </span>
              <span style={{ font: '700 19px/1 var(--font-serif)' }}>Potenova</span>
            </div>
            <p className="ln-muted" style={{ fontSize: 14, marginTop: 12, maxWidth: '34ch' }}>
              Personalised math &amp; English learning for Grades 1–8. Launching in Ontario, Canada.
            </p>
          </div>
          <nav className="ln-row" style={{ gap: 56 }} aria-label="Footer">
            <div className="ln-foot-cols">
              <strong>Product</strong>
              <a href="#how">How it works</a>
              <a href="#safety">Safety &amp; privacy</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="ln-foot-cols">
              <strong>Company</strong>
              <a href="#">Privacy policy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
            </div>
          </nav>
        </div>
        <div className="ln-wrap" style={{ borderTop: '1px solid var(--line)', paddingBlock: 20 }}>
          <p className="ln-muted" style={{ fontSize: 13, margin: 0 }}>
            © 2026 SectorVec Inc. Potenova is a product of SectorVec Inc. · Staging preview —
            synthetic data.
          </p>
        </div>
      </footer>
    </div>
  );
}
