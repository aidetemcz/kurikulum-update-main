"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

// Čas verze v místním pásmu prohlížeče.
//
// Server běží v UTC, prohlížeč v pásmu uživatele – kdyby se čas vykreslil
// rovnou lokálně, nesouhlasilo by vykreslení na serveru s tím v prohlížeči
// a Reactu by se rozsypalo napojení na hotové HTML (hydration mismatch),
// což mimo jiné shodí obsluhu kreslení značek. Proto se nejdřív vykreslí
// v UTC (stejně na obou stranách) a po načtení se přepne na místní čas.
export function LocalDateTime({ value, locale }: { value: string; locale: string }) {
  const [text, setText] = useState(() => formatDateTime(value, locale, "UTC"));

  useEffect(() => {
    setText(formatDateTime(value, locale));
  }, [value, locale]);

  return <span suppressHydrationWarning>{text}</span>;
}

// Totéž pro čas vložený do věty (fill() ze slovníku): vrátí funkci, která
// do načtení v prohlížeči formátuje v UTC (shodně se serverem) a pak
// v místním čase uživatele.
export function useLocalDateTimeFormat(locale: string): (value: string) => string {
  const [mistni, setMistni] = useState(false);

  useEffect(() => {
    setMistni(true);
  }, []);

  return useCallback(
    (value: string) => formatDateTime(value, locale, mistni ? undefined : "UTC"),
    [locale, mistni]
  );
}
