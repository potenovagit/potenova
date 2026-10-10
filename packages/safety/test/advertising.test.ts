import { describe, it, expect } from 'vitest';
import { scanChildSurface, type ChildSurfaceManifest } from '@potenova/safety';

describe('zero-advertising attestation (SAFE-014; AT-58)', () => {
  it('passes a clean child surface', () => {
    const manifest: ChildSurfaceManifest = {
      sdks: [
        { name: 'render-core', category: 'infrastructure' },
        { name: 'mathjax', category: 'educational' },
      ],
      identifiersUsed: ['install_uuid'],
    };
    expect(scanChildSurface(manifest).ok).toBe(true);
  });

  it('AT-58: flags an advertising/analytics SDK and a disallowed identifier', () => {
    const manifest: ChildSurfaceManifest = {
      sdks: [
        { name: 'ad-net', category: 'advertising' },
        { name: 'profiler', category: 'behavioral_analytics' },
      ],
      identifiersUsed: ['android_advertising_id'],
    };
    const r = scanChildSurface(manifest);
    expect(r.ok).toBe(false);
    expect(r.violations).toContain('sdk:ad-net:advertising');
    expect(r.violations).toContain('sdk:profiler:behavioral_analytics');
    expect(r.violations).toContain('identifier:android_advertising_id');
  });
});
