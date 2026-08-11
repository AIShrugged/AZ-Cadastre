/**
 * The glyph a profile is recognised by, wherever a profile is shown — the
 * picker on New verification and the policy surface both render this, so the
 * same case cannot be a house on one screen and a folder on the next.
 *
 * A profile the engine has gained and this build has not been drawn for still
 * gets a mark, the neutral fallback: an undrawn profile must not read as an
 * absent one.
 */
import { FileStackIcon, HouseIcon, type LucideIcon } from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  cadastre: HouseIcon,
}

const FALLBACK: LucideIcon = FileStackIcon

export function ProfileGlyph({
  profileKey,
  className,
}: {
  profileKey: string
  className?: string
}) {
  const Icon = ICONS[profileKey] ?? FALLBACK
  return <Icon aria-hidden className={className} />
}
