import { loadStrand, buildStrandGraph, type StrandDataset, type LoadedStrand } from './schema';
import { CurriculumGraph } from '../graph';
import fractionsData from './data/fractions.json';
import additionData from './data/addition.json';
import multiplicationData from './data/multiplication.json';
import divisionData from './data/division.json';
import algebraEquivG3Data from './data/algebra-equiv-g3.json';
import fractionalGroupsData from './data/fractional-groups.json';
import subtractionData from './data/subtraction.json';
import wholeNumberData from './data/whole-number.json';
import skipCountData from './data/skip-count.json';
import algebraEquivData from './data/algebra-equiv.json';
import placeValueData from './data/place-value.json';
import financialData from './data/financial.json';
import numberRepData from './data/number-rep.json';
import spatialData from './data/spatial.json';
import dataHandlingData from './data/data-handling.json';
import geometryData from './data/geometry.json';
import calendarData from './data/calendar.json';
import estimationData from './data/estimation.json';
import dateCalendarData from './data/date-calendar.json';
import codingData from './data/coding.json';
import wordProblemsData from './data/word-problems.json';
import constructionData from './data/construction.json';
import wholeNumberG2Data from './data/whole-number-g2.json';
import subtractionG2Data from './data/subtraction-g2.json';
import skipCountG2Data from './data/skip-count-g2.json';
import evenOddData from './data/even-odd.json';
import money100Data from './data/money-100.json';
import wordProblemsG2Data from './data/word-problems-g2.json';
import estimationG2Data from './data/estimation-g2.json';
import placeValueG2Data from './data/place-value-g2.json';
import roundingData from './data/rounding.json';
import multiplicationG4Data from './data/multiplication-g4.json';
import divisionG4Data from './data/division-g4.json';
import addSubtractG4Data from './data/add-subtract-g4.json';
import decimalsG4Data from './data/decimals-g4.json';
import areaG4Data from './data/area-g4.json';
import decimalsG5Data from './data/decimals-g5.json';
import fractionsG5Data from './data/fractions-g5.json';
import multiplicationG5Data from './data/multiplication-g5.json';
import divisionG5Data from './data/division-g5.json';
import percentsG5Data from './data/percents-g5.json';
import areaG5Data from './data/area-g5.json';
import integersG6Data from './data/integers-g6.json';
import decimalsG6Data from './data/decimals-g6.json';
import fractionsG6Data from './data/fractions-g6.json';
import percentsG6Data from './data/percents-g6.json';
import squaresG7Data from './data/squares-g7.json';
import englishData from './data/english.json';

/**
 * Strand registry — every teachable-skill strand, authored as data and loaded
 * through the one schema/loader. Adding a strand is adding a JSON file under
 * `./data` and one line here; no new per-strand TypeScript.
 *
 * The datasets validate at load (`loadStrand` → `validateStrandData`), so a
 * malformed strand fails the build/tests rather than reaching the engine.
 */

export * from './schema';

/** Raw datasets (validated on load below). */
export const STRAND_DATASETS: readonly StrandDataset[] = [
  fractionsData as StrandDataset,
  additionData as StrandDataset,
  subtractionData as StrandDataset,
  wholeNumberData as StrandDataset,
  skipCountData as StrandDataset,
  algebraEquivData as StrandDataset,
  placeValueData as StrandDataset,
  financialData as StrandDataset,
  numberRepData as StrandDataset,
  spatialData as StrandDataset,
  dataHandlingData as StrandDataset,
  geometryData as StrandDataset,
  calendarData as StrandDataset,
  estimationData as StrandDataset,
  dateCalendarData as StrandDataset,
  codingData as StrandDataset,
  wordProblemsData as StrandDataset,
  constructionData as StrandDataset,
  wholeNumberG2Data as StrandDataset,
  subtractionG2Data as StrandDataset,
  skipCountG2Data as StrandDataset,
  evenOddData as StrandDataset,
  money100Data as StrandDataset,
  wordProblemsG2Data as StrandDataset,
  estimationG2Data as StrandDataset,
  placeValueG2Data as StrandDataset,
  multiplicationData as StrandDataset,
  divisionData as StrandDataset,
  algebraEquivG3Data as StrandDataset,
  fractionalGroupsData as StrandDataset,
  roundingData as StrandDataset,
  multiplicationG4Data as StrandDataset,
  divisionG4Data as StrandDataset,
  addSubtractG4Data as StrandDataset,
  decimalsG4Data as StrandDataset,
  areaG4Data as StrandDataset,
  decimalsG5Data as StrandDataset,
  fractionsG5Data as StrandDataset,
  multiplicationG5Data as StrandDataset,
  divisionG5Data as StrandDataset,
  percentsG5Data as StrandDataset,
  areaG5Data as StrandDataset,
  integersG6Data as StrandDataset,
  decimalsG6Data as StrandDataset,
  fractionsG6Data as StrandDataset,
  percentsG6Data as StrandDataset,
  squaresG7Data as StrandDataset,
  englishData as StrandDataset,
];

/** Every strand, assembled into domain entities, keyed by strandId. */
export const STRANDS: ReadonlyMap<string, LoadedStrand> = new Map(
  STRAND_DATASETS.map((d) => [d.strandId, loadStrand(d)]),
);

/** Look up a loaded strand by id (throws if unknown — fail fast). */
export function strand(strandId: string): LoadedStrand {
  const s = STRANDS.get(strandId);
  if (!s) throw new Error(`unknown strand ${strandId}`);
  return s;
}

/** Build a fresh CurriculumGraph for a strand by id. */
export function strandGraph(strandId: string): CurriculumGraph {
  const d = STRAND_DATASETS.find((x) => x.strandId === strandId);
  if (!d) throw new Error(`unknown strand ${strandId}`);
  return buildStrandGraph(d);
}
