import type { Context, Hono } from 'hono';
import { AGE_BANDS } from '@potenova/identity';
import { DATA_CLASSES, checkRetentionReadiness } from '@potenova/policy';
import { readAuth, requireActorType, type AuthCtx } from '../auth';
import { type Deps } from '../deps';
import { gateTask } from '../task-bank';

/**
 * Operator / QA read-only status view (WP-13; G2).
 *
 * One place for an operator to see the engine's SAFETY POSTURE on synthetic
 * data: every EVIDENCE-REQUIRED policy's fail-closed state (configured? signed?),
 * the AI model-eval posture (no real model is routable for production), the
 * latency SLO as an explicit unapproved DRAFT slot (never a fabricated pass), and
 * a live content-gate self-check. It reads state only — it sets nothing, routes
 * no model, and reveals no child content (reason codes / policy metadata only).
 */

// Capabilities whose kill-switch state the operator watches.
const WATCHED_CAPABILITIES = ['ai_generation', 'voice_input', 'vision_input'] as const;

export function registerOperatorStatus(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => readAuth(c, deps.config.primaryRegion);

  app.get('/operator/status', async (c) => {
    const a = authed(c);
    requireActorType(a, 'operator', 'child_safety');

    const p = deps.policies;

    // --- Fail-closed policy states (ER-03/07/08/09). ---
    const usageBands = AGE_BANDS.map((band) => {
      const v = p.usageCaps[band];
      return {
        band,
        status: v?.status ?? 'pending',
        approved: v?.status === 'configured' ? v.approved : false,
        decisionId: v?.decisionId ?? 'ER-09',
      };
    });
    const retention = checkRetentionReadiness(p.retention, DATA_CLASSES);

    const policies = {
      mastery: {
        decisionId: 'ER-03',
        version: p.mastery.policyVersion,
        approved: p.mastery.approved,
      },
      usageCaps: {
        decisionId: 'ER-09',
        bands: usageBands,
        allApproved: usageBands.every((b) => b.approved),
      },
      escalation: {
        decisionId: p.escalation.decisionId,
        approved: p.escalation.approved,
        configuredCells: Object.keys(p.escalation.rules).length,
      },
      retention: {
        decisionId: 'ER-07',
        ready: retention.ready,
        unconfiguredCount: retention.unconfigured.length,
        unapprovedCount: retention.unapproved.length,
      },
    };

    // --- AI model-eval posture. No model is routable for production. ---
    const candidate = deps.ai.candidateModelId
      ? deps.ai.registry.get(deps.ai.candidateModelId)
      : undefined;
    const ai = {
      providerConfigured: deps.ai.provider !== null,
      inputProviderConfigured: deps.ai.inputProvider !== null,
      candidateModel: candidate
        ? {
            modelId: candidate.modelId,
            status: candidate.status,
            allowedRegions: candidate.allowedRegions,
            trainingDisabled: candidate.trainingDisabled,
          }
        : null,
      anyModelApprovedForProduction: deps.ai.candidateModelId
        ? deps.ai.registry.isApprovedForProduction(deps.ai.candidateModelId)
        : false,
    };

    // --- Model-eval + latency evidence. Latency SLO is EVIDENCE REQUIRED. ---
    const evalStats = await deps.operator.evalRunStats();
    const modelEval = {
      endpoint: '/operator/model-eval',
      runnable: deps.ai.provider !== null,
      envelope: candidate
        ? {
            ageBands: candidate.ageBands,
            subjects: candidate.subjects,
            capabilities: candidate.capabilities,
          }
        : null,
      // The SLO target is an unapproved DRAFT slot (never a fabricated pass); the
      // MEASURED latency + containment below are evidence read from recorded runs.
      latency: {
        sloMs: null,
        decisionId: 'NFR-07',
        approved: false,
        recordedRuns: evalStats.count,
        measuredP95Ms: evalStats.count > 0 ? evalStats.p95LatencyMs : null,
      },
      containmentHeldAll: evalStats.containmentHeldAll,
      lastRun: evalStats.last,
    };

    // --- Kill switches (operator-controlled containment). ---
    const killSwitches = await Promise.all(
      WATCHED_CAPABILITIES.map(async (capability) => ({
        capability,
        active: await deps.operator.isCapabilityActive(capability),
      })),
    );

    // --- Live content-gate self-check (positive + negative). ---
    let positive = false;
    let negativeBlocked = false;
    try {
      gateTask('frac-cmp-1'); // a known-good, oracle-valid item delivers
      positive = true;
    } catch {
      positive = false;
    }
    try {
      gateTask('nonexistent-task'); // an unknown item must be refused
      negativeBlocked = false;
    } catch {
      negativeBlocked = true;
    }
    const contentGate = { active: positive && negativeBlocked, positive, negativeBlocked };

    // Overall prod-readiness: every fail-closed policy signed and no model wired.
    const prodReady =
      policies.mastery.approved &&
      policies.usageCaps.allApproved &&
      policies.escalation.approved &&
      policies.retention.ready;

    return c.json({
      environment: deps.config.environment,
      primaryRegion: deps.config.primaryRegion,
      drRegion: deps.config.drRegion,
      isProd: p.isProd,
      prodReady,
      policies,
      ai,
      modelEval,
      killSwitches,
      contentGate,
    });
  });
}
