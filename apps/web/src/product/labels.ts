/** Parent/child-friendly labels for skills and subjects, shared across the
 *  product routes. These are presentation only — they never affect mastery. */

export const SKILL_LABELS: Record<string, string> = {
  'SK-FR-compare': 'Comparing fractions',
  'SK-FR-equiv': 'Equivalent fractions',
  'SK-EN-plural-base': 'Plurals: adding -s',
  'SK-EN-plural-sibilant': 'Plurals: -es and -ies',
  'SK-NS-add-within10': 'Adding within 10',
  'SK-NS-add-within20': 'Adding within 20',
};

export const skillLabel = (id: string): string => SKILL_LABELS[id] ?? id;

export const SUBJECT_LABELS: Record<string, string> = {
  math: 'Math',
  english: 'English',
  other: 'Other',
};

export const subjectLabel = (s: string): string => SUBJECT_LABELS[s] ?? s;

/** True when a skill is a fractions skill (used to pick the right worked example). */
export const isFractionSkill = (id: string): boolean => /FR|fraction/i.test(id);
