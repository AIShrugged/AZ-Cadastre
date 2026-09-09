/**
 * roadmap — what the system does today and what it will grow into. Read by the
 * page that lists the steps and by the sidebar badge that counts them.
 */
export type { RoadmapStage, RoadmapStep, StepStanding } from './model/roadmap';
export {
  ROADMAP_STAGES,
  ROADMAP_STEPS,
  STANDING_KEY as STEP_STANDING_KEY,
  stepsToCome,
} from './model/roadmap';
