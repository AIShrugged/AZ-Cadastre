import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { CaseReport } from "@/components/CaseReport";
import { CASES } from "@/lib/mock";

export function CaseDetail() {
  const { id } = useParams();
  const data = CASES.find((c) => c.id === id);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <Link
        to="/app"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
      >
        <ChevronLeft className="size-4" />
        Все проверки
      </Link>
      {data ? (
        <CaseReport data={data} />
      ) : (
        <p className="text-muted-foreground">Дело не найдено.</p>
      )}
    </div>
  );
}
