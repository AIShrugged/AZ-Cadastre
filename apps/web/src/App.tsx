import { useEffect, useState } from "react";
import { FolderSearchIcon } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppSidebar } from "@/components/app-sidebar";
import { CaseDetail } from "@/components/case-detail";
import { useCases } from "@/hooks/use-cases";

function Dashboard() {
  const { cases, loading, error, refresh } = useCases();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Автовыбор первого дела после загрузки.
  useEffect(() => {
    if (!selectedId && cases.length > 0) setSelectedId(cases[0].id);
  }, [cases, selectedId]);

  return (
    <SidebarProvider>
      <AppSidebar
        cases={cases}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-display text-base">AZ-Cadastre</span>
        </header>
        <main className="min-w-0 flex-1">
          {error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTitle>Бэкенд недоступен</AlertTitle>
                <AlertDescription>
                  {error}. Убедитесь, что core запущен на :3000.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void refresh()}
                  >
                    Повторить
                  </button>
                </AlertDescription>
              </Alert>
            </div>
          ) : selectedId ? (
            <CaseDetail
              key={selectedId}
              caseId={selectedId}
              onMutated={() => void refresh()}
            />
          ) : (
            !loading && (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle className="font-display text-xl">
                    Выберите дело
                  </EmptyTitle>
                  <EmptyDescription>
                    Слева — список поданных пакетов документов. Откройте дело,
                    чтобы увидеть отчёт и флаги.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Dashboard />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
