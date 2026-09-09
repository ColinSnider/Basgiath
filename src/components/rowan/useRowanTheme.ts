import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanSettings } from "@/lib/rowan-fns";
import { PRESET_THEMES } from "@/lib/user-preferences";

export function useRowanTheme(sessionId: string) {
  const query = useQuery({
    queryKey: ["rowan", sessionId, "settings"],
    queryFn: () => rowanSettings({ data: { sessionId } }),
    retry: false,
  });
  const settings = query.data?.settings;
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const savedStyle = root.getAttribute("style");
    const wasDark = root.classList.contains("dark");
    root.classList.toggle("dark", settings.darkMode);
    root.style.fontSize =
      settings.fontScale === "sm" ? "14px" : settings.fontScale === "lg" ? "18px" : "16px";
    const theme = PRESET_THEMES.find((t) => t.id === settings.accentColor) ?? PRESET_THEMES[0];
    const [primary, foreground] = settings.darkMode ? theme.dark : theme.light;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", foreground);
    root.style.setProperty("--ring", primary);
    for (const name of [
      "background",
      "card",
      "popover",
      "border",
      "input",
      "muted",
      "secondary",
      "accent",
    ])
      root.style.removeProperty(`--${name}`);
    root.dataset.rowanCompact = String(settings.compactMode);
    if (settings.darkMode) {
      for (const [name, value] of Object.entries({
        background: theme.darkSurfaces.bg,
        card: theme.darkSurfaces.card,
        border: theme.darkSurfaces.border,
        muted: theme.darkSurfaces.muted,
        popover: theme.darkSurfaces.card,
        input: theme.darkSurfaces.border,
        secondary: theme.darkSurfaces.muted,
        accent: theme.darkSurfaces.muted,
      }))
        root.style.setProperty(`--${name}`, value);
    }
    return () => {
      root.classList.toggle("dark", wasDark);
      if (savedStyle === null) root.removeAttribute("style");
      else root.setAttribute("style", savedStyle);
      delete root.dataset.rowanCompact;
    };
  }, [settings]);
}
