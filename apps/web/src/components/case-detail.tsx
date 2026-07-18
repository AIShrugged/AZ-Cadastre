import { useCallback, useState } from "react";
import { DownloadIcon, MapPinIcon } from "lucide-react";
import { toast } from "sonner";
import type { CaseStatus, FlagDecision } from "@cadastre/contracts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCase } from "@/hooks/use-case";
import { decideFlag, exportCaseUrl } from "@/lib/api";
import {
  CHECK_LABEL,
  CHECK_RESULT_LABEL,
  DECISION_LABEL,
  formatDate,
  pct,
} from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { PipelineTracker } from "@/components/pipeline-tracker";
import { FlagsPanel } from "@/components/flags-panel";
import { DocumentsPanel } from "@/components/documents-panel";

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function CaseDetail({
  caseId,
  onMutated,
}: {
  caseId: string;
  onMutated: () => void;
}) {
  const { data, loading, error, refresh, setData } = useCase(caseId);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const onDecide = useCallback(
    async (flagId: string, decision: FlagDecision) => {
      setPendingIds((s) => new Set(s).add(flagId));
      // Оптимистично обновляем решение по Флагу.
      setData((prev) =>
        prev
          ? {
              ...prev,
              flags: prev.flags.map((f) =>
                f.id === flagId ? { ...f, decision } : f,
              ),
            }
          : prev,
      );
      try {
        const res = await decideFlag(caseId, flagId, decision);
        setData((prev) =>
          prev
            ? {
                ...prev,
                status: res.caseStatus as CaseStatus,
                flags: prev.flags.map((f) => (f.id === flagId ? res.flag : f)),
              }
            : prev,
        );
        toast.success(`Флаг: ${DECISION_LABEL[decision].toLowerCase()}`);
        onMutated();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
        void refresh();
      } finally {
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(flagId);
          return next;
        });
      }
    },
    [caseId, setData, refresh, onMutated],
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить дело</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const openFlags = data.flags.filter((f) => f.decision === "pending").length;

  return (
    <div className="flex flex-col">
      {/* Шапка */}
      <div className="flex flex-col gap-6 border-b border-border px-6 pt-6 pb-7 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>Дела</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-mono">
                    {data.parcelId}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="font-display text-3xl text-balance sm:text-[2.1rem]">
                {data.applicant}
              </h1>
              <StatusBadge status={data.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="size-3.5" />
                {data.address}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span>{data.service}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{formatDate(data.createdAt)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={exportCaseUrl(data.id)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Экспорт JSON
          </Button>
        </div>

        {/* Сводка — редакционная строка с разделителями, без «коробок» */}
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5 border-t border-border pt-5">
          <MetaItem label="Статус дела">
            <StatusBadge status={data.status} />
          </MetaItem>
          {data.checks.map((check) => (
            <MetaItem key={check.type} label={CHECK_LABEL[check.type]}>
              <span
                className={cn(
                  "text-sm font-medium",
                  check.result === "pass"
                    ? "text-status-ok"
                    : "text-status-incomplete",
                )}
              >
                {CHECK_RESULT_LABEL[check.result]}
              </span>
            </MetaItem>
          ))}
          <MetaItem label="Уверенность модели">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tabular-nums">
                {pct(data.confidence)}
              </span>
              <ConfidenceMeter value={data.confidence} showValue={false} />
            </div>
          </MetaItem>
        </div>
      </div>

      {/* Тело */}
      <div className="grid gap-x-12 gap-y-8 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 min-w-0 lg:order-1">
          <Tabs defaultValue="flags">
            <TabsList>
              <TabsTrigger value="flags">
                Проверки и флаги
                {openFlags > 0 && (
                  <span className="ml-1.5 rounded-full bg-status-incomplete-subtle px-1.5 text-xs font-medium tabular-nums text-status-incomplete">
                    {openFlags}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents">
                Документы · {data.documents.length}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="flags" className="mt-6">
              <FlagsPanel
                data={data}
                pendingIds={pendingIds}
                onDecide={onDecide}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-6">
              <DocumentsPanel documents={data.documents} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="order-1 lg:order-2">
          <PipelineTracker caseId={caseId} />
        </div>
      </div>
    </div>
  );
}
