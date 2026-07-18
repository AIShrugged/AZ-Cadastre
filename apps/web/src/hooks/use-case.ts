import { useCallback, useEffect, useState } from "react";
import type { Case } from "@cadastre/contracts";
import { getCase } from "@/lib/api";

export function useCase(id: string | null) {
  const [data, setData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);
      setData(await getCase(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки дела");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    void refresh();
  }, [id, refresh]);

  return { data, loading, error, refresh, setData };
}
