import {
  CircleCheckIcon,
  CircleDashedIcon,
  LoaderIcon,
  RotateCwIcon,
} from "lucide-react";
import { PIPELINE_STAGES, type StageState } from "@cadastre/contracts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProgress } from "@/hooks/use-progress";

function StageIcon({ state }: { state: StageState }) {
  if (state === "done")
    return <CircleCheckIcon className="size-4 text-status-ok" />;
  if (state === "running")
    return <LoaderIcon className="size-4 animate-spin text-brand" />;
  return <CircleDashedIcon className="size-4 text-muted-foreground/50" />;
}

export function PipelineTracker({ caseId }: { caseId: string }) {
  const { stages, progress, status, restart } = useProgress(caseId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Обработка пакета</CardTitle>
        <CardDescription>
          Синхронный пайплайн · прогресс по SSE
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={restart}
            disabled={status === "running"}
          >
            <RotateCwIcon data-icon="inline-start" />
            Обработать заново
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <ol className="flex flex-col gap-1">
          {PIPELINE_STAGES.map(({ stage, label }) => {
            const state = stages[stage];
            return (
              <li
                key={stage}
                className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-sm"
              >
                <StageIcon state={state} />
                <span
                  className={cn(
                    state === "pending" && "text-muted-foreground",
                    state === "running" && "font-medium",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
