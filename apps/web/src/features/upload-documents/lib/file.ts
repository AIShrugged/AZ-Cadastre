import type { FileKind } from "../model/types"

export const MAX_MB = 25
export const MAX_BYTES = MAX_MB * 1024 * 1024
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

export function fileKind(name: string): FileKind | null {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return "image"
  return null
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
