"use client";

// Název metodiky na stránce lekce. Editor země si ji tu může přejmenovat –
// jen pro svou zemi, ostatní dál vidí svůj název.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { fill } from "@/lib/format";
import { saveLocalModuleName } from "@/app/local-names/actions";
import type { Dictionary } from "@/lib/i18n";

export function ModuleTitle({
  title,
  standardName,
  localName,
  countryId,
  countryName,
  moduleId,
  canRename,
  t,
}: {
  /** Co se ukazuje – vlastní název, nebo běžný (přeložený). */
  title: string;
  /** Běžný název bez přejmenování – ukáže se pod vlastním. */
  standardName: string;
  localName: string | null;
  countryId: string;
  countryName: string;
  moduleId: string;
  canRename: boolean;
  t: Dictionary;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(localName ?? title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ulozit(nazev: string) {
    setError(null);
    startTransition(async () => {
      const vysledek = await saveLocalModuleName(countryId, moduleId, nazev);
      if (vysledek && "error" in vysledek) setError(vysledek.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="mb-6 flex flex-col gap-2">
        <input
          autoFocus
          value={value}
          maxLength={300}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") ulozit(value);
            if (event.key === "Escape") setEditing(false);
          }}
          className="input font-heading text-2xl font-bold"
        />
        <p className="text-xs text-ink/50">{fill(t.renameHint, { country: countryName })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending || !value.trim()}
            onClick={() => ulozit(value)}
            className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? t.saving : t.save}
          </button>
          {localName && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => ulozit("")}
              className="rounded-xl px-3 py-2 text-sm text-ink/60 hover:bg-haze"
            >
              {t.renameReset}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl px-3 py-2 text-sm text-ink/60 hover:bg-haze"
          >
            {t.cancel}
          </button>
          {error && <span className="text-sm text-coral">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-start gap-2">
        <h1 className="font-heading text-3xl font-bold text-ink">{title}</h1>
        {canRename && (
          <button
            type="button"
            onClick={() => {
              setValue(localName ?? title);
              setEditing(true);
            }}
            aria-label={t.renameModule}
            title={fill(t.renameHint, { country: countryName })}
            className="mt-2 shrink-0 rounded-lg p-1 text-ink/40 hover:bg-haze hover:text-coral"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>
      {localName && (
        <p className="mt-1 text-xs text-ink/50">
          {fill(t.renamedFrom, { country: countryName, name: standardName })}
        </p>
      )}
    </div>
  );
}
