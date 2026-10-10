import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { skill, skillDependency } from './schema';

/** Curriculum reference persistence (WP-02). Canonical skills and approved
 *  dependency edges are reviewed reference data seeded into the database; the
 *  app reads the graph from here rather than rebuilding it from code each boot. */

export interface SkillRow {
  skillId: string;
  domain: string;
  competency: string;
  skill: string;
  subskill: string | null;
  version: string;
  status: string;
}
export interface SkillDependencyRow {
  dependencyId: string;
  fromSkillId: string;
  toSkillId: string;
  type: string;
  weight: number;
  approvalStatus: string;
  approvalVersion: string | null;
}

export class CurriculumRepository {
  constructor(private readonly h: PotenovaDb) {}

  async saveSkill(s: SkillRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(skill)
      .values(s)
      .onConflictDoUpdate({
        target: skill.skillId,
        set: {
          domain: s.domain,
          competency: s.competency,
          skill: s.skill,
          subskill: s.subskill,
          version: s.version,
          status: s.status,
        },
      });
  }
  async listSkills(): Promise<SkillRow[]> {
    const db = await this.h.ready();
    return (await db.select().from(skill)).map((r) => ({ ...r }));
  }

  async saveDependency(d: SkillDependencyRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(skillDependency)
      .values(d)
      .onConflictDoUpdate({
        target: skillDependency.dependencyId,
        set: {
          type: d.type,
          weight: d.weight,
          approvalStatus: d.approvalStatus,
          approvalVersion: d.approvalVersion,
        },
      });
  }
  async listDependencies(): Promise<SkillDependencyRow[]> {
    const db = await this.h.ready();
    return (await db.select().from(skillDependency)).map((r) => ({ ...r }));
  }
}
