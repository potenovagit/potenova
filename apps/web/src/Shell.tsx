import { useEffect, useState } from 'react';
import { Console } from './App';
import { Landing } from './product/Landing';
import { Onboarding } from './product/Onboarding';
import { Dashboard } from './product/Dashboard';

/**
 * Minimal hash-based router — no router dependency, so no lockfile churn.
 * Routes:
 *   #/           → public landing page
 *   #/console    → the operator / QA console (the existing tabbed demo)
 *   #/signup     → caregiver onboarding (guided linear stepper)
 *   #/dashboard  → parent dashboard (derived progress + controls + safety/data)
 *   #/learn      → learner experience (placeholder until a later PR)
 */
type Route = 'landing' | 'console' | 'signup' | 'dashboard' | 'learn';

function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0];
  if (path === '/console') return 'console';
  if (path === '/signup') return 'signup';
  if (path === '/dashboard') return 'dashboard';
  if (path === '/learn') return 'learn';
  return 'landing';
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Placeholder shown for routes whose product screen lands in a later PR. */
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="landing" style={{ minHeight: '100vh' }}>
      <div
        className="ln-wrap"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: '100vh',
          gap: 18,
        }}
      >
        <span
          className="ln-mark"
          aria-hidden="true"
          style={{ width: 44, height: 44, fontSize: 22 }}
        >
          P
        </span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, margin: 0 }}>{title}</h1>
        <p className="ln-muted" style={{ fontSize: 18, maxWidth: '42ch' }}>
          This screen is coming next. The design is approved and the React port is in progress.
        </p>
        <a className="ln-btn ln-btn-primary" href="#/">
          Back to home
        </a>
      </div>
    </div>
  );
}

export function Shell() {
  const route = useHashRoute();
  switch (route) {
    case 'console':
      return <Console />;
    case 'signup':
      return <Onboarding />;
    case 'dashboard':
      return <Dashboard />;
    case 'learn':
      return <ComingSoon title="Learning session" />;
    case 'landing':
    default:
      return <Landing />;
  }
}
