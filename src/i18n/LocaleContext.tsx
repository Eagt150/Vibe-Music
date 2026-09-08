import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSettings, updateSettings } from "@/lib/db/settings";
import type { Locale } from "@/types";
import { en, es } from "./translations";

const dictionaries = { en, es } as const;
type Dict = typeof en;

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : never;
}[keyof T & string];

export type TranslationKey = NestedKeyOf<Dict>;

function getByPath(dict: Dict, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return (acc as Record<string, unknown>)[key];
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    void getSettings().then((s) => setLocaleState(s.locale));
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    void updateSettings({ locale: next });
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    return interpolate(getByPath(dictionaries[locale], key), vars);
  }

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
