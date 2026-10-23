import { loadStrand, buildStrandGraph, type StrandDataset, type LoadedStrand } from './schema';
import { CurriculumGraph } from '../graph';
import fractionsData from './data/fractions.json';
import additionData from './data/addition.json';
import subtractionData from './data/subtraction.json';
import wholeNumberData from './data/whole-number.json';
import skipCountData from './data/skip-count.json';
import algebraEquivData from './data/algebra-equiv.json';
import placeValueData from './data/place-value.json';
import financialData from './data/financial.json';
import numberRepData from './data/number-rep.json';
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
