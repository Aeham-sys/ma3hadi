import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";
export type Theme = "light" | "dark";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (ar: string, en: string) => string;
  dir: "rtl" | "ltr";
};

const LangContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const l = (localStorage.getItem("ma3hadi_lang") as Lang) || "ar";
    const th = (localStorage.getItem("ma3hadi_theme") as Theme) || "light";
    setLangState(l);
    setThemeState(th);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    html.setAttribute("lang", lang);
    html.classList.toggle("dark", theme === "dark");
  }, [lang, theme]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("ma3hadi_lang", l);
  };
  const setTheme = (th: Theme) => {
    setThemeState(th);
    localStorage.setItem("ma3hadi_theme", th);
  };

  return (
    <LangContext.Provider
      value={{
        lang,
        setLang,
        theme,
        setTheme,
        t: (ar, en) => (lang === "ar" ? ar : en),
        dir: lang === "ar" ? "rtl" : "ltr",
      }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
