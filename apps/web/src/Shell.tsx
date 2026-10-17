import { useEffect, useState } from 'react';
import { Console } from './App';
import { Landing } from './product/Landing';
import { Onboarding } from './product/Onboarding';
import { Dashboard } from './product/Dashboard';
import { Learner } from './product/Learner';

/**
 * Minimal hash-based router — no router dependency, so no lockfile churn.
 * Routes:
 *   #/           → public landing page
 *   #/console    → the operator / QA console (the existing tabbed demo)
 *   #/signup     → caregiver onboarding (guided linear stepper)
 *   #/dashboard  → parent dashboard (derived progress + controls + safety/data)
 *   #/learn      → learner experience (practice / learn-it / watch / play)
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
      return <Learner />;
    case 'landing':
    default:
      return <Landing />;
  }
}
