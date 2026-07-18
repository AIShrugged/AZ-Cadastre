import { useCallback, useEffect, useState } from "react";
import type { CaseSummary } from "@cadastre/contracts";
import { listCases } from "@/lib/api";

export function useCases() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setCases(await listCases());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки списка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { cases, loading, error, refresh };
}
