/**
 * Composite score -> letter grade -> meter color -> header line.
 * No F grade — D- is the floor (master spec §Phase 2: "F reads as contempt
 * and makes the owner defensive; D- keeps failure urgent but fixable").
 */
const GRADE_TABLE = [
  { min: 97, grade: 'A+', color: 'green', header: 'Elite. Your site is a weapon.' },
  { min: 93, grade: 'A', color: 'green', header: 'Excellent — minor tuning left.' },
  { min: 90, grade: 'A-', color: 'green', header: 'Strong site with a few gaps.' },
  { min: 87, grade: 'B+', color: 'lime', header: 'Good, but leads are slipping through.' },
  { min: 83, grade: 'B', color: 'lime', header: 'Solid foundation, real gaps.' },
  { min: 80, grade: 'B-', color: 'yellow', header: 'Average — and average loses to page one.' },
  { min: 77, grade: 'C+', color: 'yellow', header: 'Below the local leaders.' },
  { min: 73, grade: 'C', color: 'orange', header: 'Costing you jobs every week.' },
  { min: 70, grade: 'C-', color: 'orange', header: 'Serious problems on every page.' },
  { min: 65, grade: 'D+', color: 'red', header: 'Your site is working against you.' },
  { min: 55, grade: 'D', color: 'red', header: 'Most visitors leave without calling.' },
  { min: 0, grade: 'D-', color: 'red', header: 'Effectively invisible to customers.' },
];

const NO_WEBSITE = { grade: null, color: 'gray', header: 'You have no website. Competitors thank you.' };

/** @returns {{grade: string, color: string, header: string}} */
export function gradeForScore(compositeScore) {
  if (compositeScore == null) return NO_WEBSITE;
  const clamped = Math.max(0, Math.min(100, compositeScore));
  const row = GRADE_TABLE.find((r) => clamped >= r.min);
  return { grade: row.grade, color: row.color, header: row.header };
}

export { GRADE_TABLE };
