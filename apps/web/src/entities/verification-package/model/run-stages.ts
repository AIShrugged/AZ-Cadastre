/**
 * How far the run got, read off the package the server sent.
 *
 * Nine stages for the office, which watches the pipeline it owns, and the four
 * phases a person who filed an application reads instead. Both come out of the
 * same pass over the same response: a submission is at one place in its run,
 * and two screens that worked that out separately would sooner or later tell
 * the applicant one thing and the inspector another about the same minute.
 *
 * Nothing here is a schedule. Every answer is a fact already in the response —
 * a page with its text read, a file read into documents, a document placed, a
 * check back from the register — so a stage is "done" because its work is
 * visible, never because time passed.
 */
import { type PackageDetailDto } from '@cadastre/api-contracts/verification';

import { STAGES } from './pipeline';
import { type Disposition } from './verification-package';

export type StageStatus = 'done' | 'current' | 'pending' | 'error';

/**
 * Real per-stage status from pipeline output. A stage that could not do its
 * work no longer halts the run: it is marked done-with-a-finding and the run
 * walks on, because the report is what the inspector is owed. Only a run that
 * lost the package altogether ends in error.
 */
export function stageStatuses(
  pkg: PackageDetailDto,
  disposition: Disposition,
): StageStatus[] {
  const files = pkg.files;
  const documents = pkg.files.flatMap(file => file.documents);
  const ocrDone =
    files.length > 0 &&
    files.every(f => f.pages.length > 0 && f.pages.every(p => p.ocr !== null));
  // Every file has been read into the documents it holds. A file that holds
  // nothing has not been detected yet, not detected as empty.
  const detectDone =
    files.length > 0 && files.every(f => f.documents.length > 0);
  const classifyDone = detectDone && documents.every(d => d.type !== null);
  // Extraction is done once every document with a schema behind it has its
  // fields. Neither answer the engine keeps for itself declares any: a document
  // it could not place has nothing to extract, and one it placed outside the
  // profile has no schema to extract against.
  const extractDone =
    classifyDone &&
    documents
      .filter(
        d => d.type && d.type !== 'unknown' && d.type !== 'out_of_profile',
      )
      .every(d => d.fields.length > 0);
  // The first check to come back is what says the stage is under way; a run
  // that finished takes the branch below, so a package no check could be made
  // over never sits here waiting.
  const crossDone = extractDone && pkg.crossChecks.length > 0;
  // The register is asked once the values it holds against a record exist, and
  // it is answered per check, so the first answer back says the stage is under
  // way — the same reading as the cross-document stage above it.
  const registryDone = crossDone && pkg.registryChecks.length > 0;

  const stages: StageStatus[] = Array.from({ length: STAGES }, () => 'pending');
  if (disposition === 'failed') {
    stages[0] = ocrDone ? 'done' : 'error';
    if (ocrDone) stages[1] = detectDone ? 'done' : 'error';
    if (ocrDone && detectDone) stages[2] = 'error';
    return stages;
  }
  // A finished run compiled its report, so every stage behind it has had its
  // turn — whatever each of them managed to make of the package.
  if (pkg.report) return stages.map(() => 'done');

  stages[0] = ocrDone ? 'done' : 'current';
  stages[1] = detectDone ? 'done' : ocrDone ? 'current' : 'pending';
  if (!detectDone) return stages;
  // Classification and extraction are one pass, not two: the run takes a
  // document, places it, and reads its fields before moving to the next. So
  // while that pass is under way both are genuinely working and both are marked
  // running — showing extraction as "not started" until the last document is
  // placed would report a queue the run does not have.
  stages[2] = classifyDone ? 'done' : 'current';
  stages[3] = extractDone ? 'done' : 'current';
  stages[4] = crossDone ? 'done' : extractDone ? 'current' : 'pending';
  stages[5] = registryDone ? 'done' : crossDone ? 'current' : 'pending';
  // Gathering starts once the register has answered, and nothing in the
  // response says when it ends: a run that carried nothing over looks exactly
  // like a run that has not reached the stage. What says it is over is the
  // report, and the branch above already answers "done" to everything once that
  // has landed (ADR-0023).
  stages[6] = registryDone ? 'current' : 'pending';
  return stages;
}

/**
 * Whether classification has been through every document the package holds.
 *
 * The moment a paper's absence stops being a stage that has not run and starts
 * being a shortfall. Before it, every required type is "not in the package"
 * because nothing has been placed yet — which is a true statement about the run
 * and a false one about the papers, and the difference matters most to the
 * person who sent them (COMM-115).
 *
 * `error` counts as through: a run that lost the package will place nothing
 * more, so what is not here by then is not coming.
 */
export function isClassified(stages: readonly StageStatus[]): boolean {
  return stages[2] === 'done' || stages[2] === 'error';
}

/**
 * The same run in four phases, which is what the person who filed it is shown.
 *
 * Not a second reading of the pipeline: the nine stages are grouped, in their
 * own order, and a phase says the loudest thing its stages say. The names are
 * the grouping's reason — «OCR», «Field extraction» and «Gathering from the
 * package» are the office's words for its own machine, and an applicant asking
 * "what is happening to my papers" is owed four sentences in their language
 * rather than nine in somebody else's.
 *
 * Four and not three, because the archive is the one stage that leaves the
 * building: a submission can sit there for a reason nothing in this system can
 * shorten, and a person waiting is owed the name of what is being waited on.
 */
export const RUN_PHASES = 4;

/** Which stages, 1-based and inclusive, each phase covers. */
const PHASE_STAGES: readonly (readonly [number, number])[] = [
  [1, 4], // read the files, find the papers in them, place them, read their fields
  [5, 5], // weigh the papers against each other
  [6, 6], // ask the archive
  [7, STAGES], // carry values over, count the package, compile the report
];

export function runPhases(stages: readonly StageStatus[]): StageStatus[] {
  return PHASE_STAGES.map(([from, to]) => {
    const own = stages.slice(from - 1, to);
    if (own.includes('error')) return 'error';
    if (own.every(status => status === 'done')) return 'done';
    if (own.includes('current') || own.includes('done')) return 'current';
    return 'pending';
  });
}

/** Which phase the run is in, 1-based — the first that is not behind it. Equal
 *  to `RUN_PHASES` once every phase is done, so "4 of 4" states a finished run
 *  rather than pointing past its end. */
export function currentPhase(phases: readonly StageStatus[]): number {
  const at = phases.findIndex(status => status !== 'done');
  return at === -1 ? phases.length : at + 1;
}
