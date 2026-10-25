"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Check, Megaphone, Users } from "lucide-react";
import { adminSendMessage } from "@/app/help/actions";
import { fill } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";

export type ComposeCountry = { id: string; name: string; userIds: string[] };
export type ComposePerson = { id: string; email: string };

// Admin píše zemím (všem jejich lidem) nebo jednomu člověku.
// Stojí nahoře na stránce Zprávy, nad konverzacemi.
export function AdminCompose({
  countries,
  people,
  adminId,
  t,
}: {
  countries: ComposeCountry[];
  people: ComposePerson[];
  adminId: string;
  t: Dictionary;
}) {
  const [state, formAction, isPending] = useActionState(adminSendMessage, null);
  const [komu, setKomu] = useState<"countries" | "person">("countries");
  const [vybrane, setVybrane] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "sentAt" in state) {
      formRef.current?.reset();
      setVybrane(new Set());
    }
  }, [state]);

  // Kolik lidí zpráva dostane – stejně jako na serveru bez admina samotného
  // a každého jen jednou, i když patří do víc zemí.
  const pocet = useMemo(() => {
    const lide = new Set<string>();
    for (const country of countries) {
      if (vybrane.has(country.id)) country.userIds.forEach((id) => lide.add(id));
    }
    lide.delete(adminId);
    return lide.size;
  }, [countries, vybrane, adminId]);

  function prepnout(id: string) {
    setVybrane((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const vsechnyVybrane = countries.length > 0 && countries.every((c) => vybrane.has(c.id));

  return (
    <section className="mb-10 max-w-2xl overflow-hidden rounded-2xl border border-haze bg-white">
      <div className="flex items-start gap-3 bg-haze/30 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/10 text-coral">
          <Megaphone size={20} />
        </span>
        <div>
          <h2 className="font-heading text-xl font-bold leading-tight text-ink">{t.composeTitle}</h2>
          <p className="mt-0.5 text-sm text-ink/60">{t.composeIntro}</p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="dashed-divider flex flex-col gap-4 px-5 py-5">
        <input type="hidden" name="to" value={komu} />

        <div
          role="tablist"
          className="inline-flex self-start rounded-xl bg-haze/50 p-1 text-sm"
        >
          {(
            [
              ["countries", t.composeToCountries],
              ["person", t.composeToPerson],
            ] as const
          ).map(([hodnota, popis]) => (
            <button
              key={hodnota}
              type="button"
              role="tab"
              aria-selected={komu === hodnota}
              onClick={() => setKomu(hodnota)}
              className={`rounded-lg px-3 py-1.5 transition ${
                komu === hodnota ? "bg-white font-medium text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              {popis}
            </button>
          ))}
        </div>

        {komu === "countries" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {countries.map((country) => {
                const zapnuto = vybrane.has(country.id);
                return (
                  <button
                    key={country.id}
                    type="button"
                    aria-pressed={zapnuto}
                    onClick={() => prepnout(country.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      zapnuto
                        ? "border-coral bg-coral text-white"
                        : "border-haze bg-white text-ink hover:border-coral/50"
                    }`}
                  >
                    {zapnuto && <Check size={14} strokeWidth={3} />}
                    {country.name}
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs ${
                        zapnuto ? "text-white/80" : "text-ink/40"
                      }`}
                    >
                      <Users size={12} />
                      {country.userIds.filter((id) => id !== adminId).length}
                    </span>
                  </button>
                );
              })}
            </div>
            {[...vybrane].map((id) => (
              <input key={id} type="hidden" name="countryId" value={id} />
            ))}
            <button
              type="button"
              onClick={() =>
                setVybrane(vsechnyVybrane ? new Set() : new Set(countries.map((c) => c.id)))
              }
              className="self-start text-sm text-coral hover:underline"
            >
              {vsechnyVybrane ? t.followNone : t.composeAll}
            </button>
          </div>
        ) : (
          <select name="userId" defaultValue="" className="input">
            <option value="" disabled>
              {t.composeChoosePerson}
            </option>
            {people
              .filter((person) => person.id !== adminId)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.email}
                </option>
              ))}
          </select>
        )}

        <textarea
          name="body"
          rows={4}
          required
          maxLength={4000}
          placeholder={t.messagePlaceholder}
          className="input"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink/60">
            {state && "error" in state ? (
              <span className="text-coral">{state.error}</span>
            ) : state && "sentAt" in state ? (
              <span className="inline-flex items-center gap-1 text-ink">
                <Check size={14} className="text-coral" />
                {fill(t.composeSent, { count: state.count ?? 1 })}
              </span>
            ) : komu === "countries" ? (
              fill(t.composeRecipients, { count: pocet })
            ) : null}
          </span>
          <button
            type="submit"
            disabled={isPending || (komu === "countries" && pocet === 0)}
            className="rounded-xl bg-coral px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? t.sendingMessage : t.sendMessage}
          </button>
        </div>
      </form>
    </section>
  );
}
