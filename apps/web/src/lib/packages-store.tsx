/**
 * Package store — the register's in-memory list of Verification Packages.
 *
 * The MVP has no API yet; this holds the packages so one created on the
 * new-verification route appears at the top of the register. Replace with an
 * API-backed store (and server-driven polling) before deployment.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { PACKAGES, type VerificationPackage } from "@/lib/registry"

type PackagesValue = {
  packages: VerificationPackage[]
  /** Prepend a newly created package so the register shows it first. */
  addPackage: (p: VerificationPackage) => void
}

const PackagesContext = createContext<PackagesValue | null>(null)

export function PackagesProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<VerificationPackage[]>(() => PACKAGES)

  const addPackage = useCallback(
    (p: VerificationPackage) => setPackages((prev) => [p, ...prev]),
    [],
  )

  const value = useMemo(() => ({ packages, addPackage }), [packages, addPackage])

  return <PackagesContext.Provider value={value}>{children}</PackagesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePackages() {
  const ctx = useContext(PackagesContext)
  if (!ctx) throw new Error("usePackages must be used within PackagesProvider")
  return ctx
}
