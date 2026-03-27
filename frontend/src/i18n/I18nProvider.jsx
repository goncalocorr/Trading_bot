import { createContext, useContext, useEffect, useMemo, useState } from "react";
import translations from "./translations";

const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "trading-bot-locale";

const I18nContext = createContext(null);

function interpolate(message, variables = {}) {
  return String(message).replace(/\{(\w+)\}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getMessage(locale, key) {
  return translations[locale]?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LOCALE;
    }

    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    availableLocales: [
      { id: "en", label: getMessage("en", "language.english") },
      { id: "pt-PT", label: getMessage("pt-PT", "language.portuguese") }
    ],
    t: (key, variables) => interpolate(getMessage(locale, key), variables),
    formatCurrency: (value, options = {}) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
        ...options
      }).format(Number(value || 0)),
    formatNumber: (value, options = {}) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...options
      }).format(Number(value || 0)),
    formatDate: (value, options = {}) =>
      value ? new Date(value).toLocaleDateString(locale, options) : getMessage(locale, "common.notAvailable"),
    formatDateTime: (value, options = {}) =>
      value ? new Date(value).toLocaleString(locale, options) : getMessage(locale, "common.notAvailable")
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}
