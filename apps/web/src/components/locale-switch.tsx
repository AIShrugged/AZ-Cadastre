/**
 * Locale switch (RU / EN / AZ) — a first-class control, sized for the app
 * header. The trigger reads as a register field: hairline square, the globe
 * glyph, and the active code set tabular in mono. The menu lists each language
 * in its own script with the code aligned to the right, so the choice is legible
 * before it is made.
 */
import { LanguagesIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { LOCALES, useI18n, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function LocaleSwitch({ className }: { className?: string }) {
  const { t, locale, setLocale } = useI18n()
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0]

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger
        aria-label={t("lang.label")}
        className={cn(
          "h-8 gap-2 border-input bg-background px-2.5 text-foreground hover:bg-accent hover:text-foreground",
          className,
        )}
      >
        <span className="flex items-center gap-1.5">
          <LanguagesIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span data-mono className="text-[0.75rem] font-medium tracking-wide">
            {current.short}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {LOCALES.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            <span className="flex w-full items-center justify-between gap-6">
              <span>{l.label}</span>
              <span data-mono className="text-[0.6875rem] text-muted-foreground">
                {l.short}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
