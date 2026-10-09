import { type ActorContext, DomainError } from '@potenova/contracts';
import type {
  FamilyAccount,
  Guardian,
  LearnerProfile,
  ChildSessionCredential,
  AgeBand,
} from './entities';

/**
 * Family/identity authority (WP-01), storage-agnostic reference implementation.
 * Source: ACC-001/002/009; C-01/C-03/C-04; S-01; AT-01/03.
 *
 * In-memory stand-in for the eventual PostgreSQL-backed identity module
 * (ADR-0002) — it exists to make the structural invariants executable and
 * testable now: a child learner cannot exist without a parent-owned family, and
 * sibling profiles are strictly isolated with no cross-profile leakage.
 */

let seq = 0;
const nextId = (p: string): string => `${p}-${(++seq).toString(36)}`;

export interface CreateLearnerInput {
  readonly nickname: string;
  readonly grade: number;
  readonly ageBand: AgeBand;
}

export class FamilyService {
  readonly #families = new Map<string, FamilyAccount>();
  readonly #guardians = new Map<string, Guardian>();
  readonly #learners = new Map<string, LearnerProfile>();

  /** C-01: create a family with its single legal owner guardian. */
  createFamily(
    ownerAuthRef: string,
    marketRegion: string,
  ): { family: FamilyAccount; owner: Guardian } {
    const familyId = nextId('fam');
    const guardianId = nextId('gdn');
    const owner: Guardian = { guardianId, familyId, role: 'owner', status: 'active' };
    const family: FamilyAccount = {
      familyId,
      marketRegion,
      legalOwnerGuardianId: guardianId,
      status: 'active',
    };
    this.#families.set(familyId, family);
    this.#guardians.set(guardianId, owner);
    void ownerAuthRef; // bound to the managed IdP subject in the real adapter
    return { family, owner };
  }

  /**
   * C-03: create a learner under a parent-owned family. A learner cannot exist
   * without an active family owned by a guardian (ACC-001).
   *
   * @throws DomainError NOT_FOUND     — family does not exist
   * @throws DomainError FORBIDDEN_ROLE — actor is not an owner of this family
   */
  createLearner(actor: ActorContext, familyId: string, input: CreateLearnerInput): LearnerProfile {
    const family = this.#families.get(familyId);
    if (!family) throw new DomainError('NOT_FOUND', 'family not found');
    if (actor.actorType !== 'guardian' || actor.familyAlias !== familyId) {
      throw new DomainError('FORBIDDEN_ROLE', 'only a family guardian may add a learner');
    }
    const learner: LearnerProfile = {
      learnerId: nextId('lnr'),
      familyId,
      nickname: input.nickname,
      grade: input.grade,
      ageBand: input.ageBand,
      lifecycleStatus: 'active',
    };
    this.#learners.set(learner.learnerId, learner);
    return learner;
  }

  /**
   * C-04: issue a least-privileged child session bound to one learner + device.
   * The credential grants child capabilities only (enforced in authorization).
   */
  startChildSession(learnerId: string, deviceIdAlias: string): ChildSessionCredential {
    const learner = this.#learners.get(learnerId);
    if (!learner || learner.lifecycleStatus !== 'active') {
      throw new DomainError('NOT_FOUND', 'learner not found');
    }
    return {
      credentialId: nextId('cred'),
      learnerId,
      familyId: learner.familyId,
      deviceIdAlias,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      riskState: 'known',
    };
  }

  /**
   * Resolve a learner strictly within the caller's family scope (ACC-002/009).
   * A request for a learner outside the actor's family is NOT_FOUND — never a
   * cross-profile/cross-family read (TM-02; AT-03). NOT_FOUND is used rather
   * than FORBIDDEN so existence is not leaked across families.
   */
  getLearnerScoped(actor: ActorContext, learnerId: string): LearnerProfile {
    const learner = this.#learners.get(learnerId);
    if (!learner || learner.familyId !== actor.familyAlias) {
      throw new DomainError('NOT_FOUND', 'learner not found in scope');
    }
    return learner;
  }

  /** Siblings in one family, for isolation tests and family-scoped listing. */
  listLearners(familyId: string): readonly LearnerProfile[] {
    return [...this.#learners.values()].filter((l) => l.familyId === familyId);
  }
}
