import { useCallback, useEffect, useRef, useState } from "react";
import {
  PIPELINE_STAGES,
  ProgressEvent as ProgressEventSchema,
  type PipelineStage,
  type StageState,
} from "@cadastre/contracts";
import { eventsUrl } from "@/lib/api";

export type RunStatus = "idle" | "running" | "done";

const initialStages = (): Record<PipelineStage, StageState> =>
  Object.fromEntries(
    PIPELINE_STAGES.map(({ stage }) => [stage, "pending" as StageState]),
  ) as Record<PipelineStage, StageState>;

/**
 * Подписка на SSE-прогресс пайплайна. Автозапуск при открытии Дела; повторный
 * запуск — через restart(). EventSource закрывается по достижении конца потока.
 */
export function useProgress(caseId: string | null) {
  const [stages, setStages] = useState<Record<PipelineStage, StageState>>(
    initialStages,
  );
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [runId, setRunId] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const restart = useCallback(() => setRunId((n) => n + 1), []);

  useEffect(() => {
    if (!caseId) return;
    esRef.current?.close();
    setStages(initialStages());
    setProgress(0);
    setStatus("running");

    const es = new EventSource(eventsUrl(caseId));
    esRef.current = es;

    es.onmessage = (ev) => {
      const parsed = ProgressEventSchema.safeParse(JSON.parse(ev.data));
      if (!parsed.success) return;
      const { stage, state, progress: p } = parsed.data;
      setStages((prev) => ({ ...prev, [stage]: state }));
      setProgress(p);
      if (p >= 1) {
        es.close();
        setStatus("done");
      }
    };
    es.onerror = () => {
      es.close();
      // Поток завершается закрытием соединения — считаем прогон оконченным.
      setStatus((s) => (s === "running" ? "done" : s));
    };

    return () => es.close();
  }, [caseId, runId]);

  return { stages, progress, status, restart };
}
