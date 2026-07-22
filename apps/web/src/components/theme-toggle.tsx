/**
 * Appearance toggle — daylight ⇄ lamplight for The Register. A single square,
 * hairline-bordered control that swaps the page's light source without leaving
 * the world: no pill, no rounded switch. The glyph names the destination (a sun
 * to return to daylight, a moon to dim to lamplight), and the accessible label
 * states the action in the inspector's language.
 */
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Read the active theme without a mount flip: next-themes may not resolve on
 *  the first render, so fall back to the class the pre-paint script already
 *  stamped on <html> (this app is client-rendered — no hydration mismatch). */
function resolveDark(resolved: string | undefined): boolean {
  if (resolved) return resolved === "dark";
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolveDark(resolvedTheme);
  const label = isDark ? t("theme.to_light") : t("theme.to_dark");

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        // Match the sibling header controls (sidebar trigger, locale switch):
        // square hairline field, register-blue focus ring, tactile press.
        "rounded-none border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {isDark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}
