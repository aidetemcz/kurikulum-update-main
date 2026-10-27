"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Potvrzovací okno pro celou appku. Používá se všude, kde se něco
// potvrzuje – skrytí změny, archivace metodiky, zahození rozdělané práce –
// aby se to chovalo pokaždé stejně.
//
// Dokud uživatel nepotvrdí, nic se nikam nezapisuje.
export function ConfirmDialog({
  open,
  title,
  explanation,
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
  children,
}: {
  open: boolean;
  title: string;
  /** Vysvětlení pod obsahem – co se stane a jestli to jde vzít zpět. */
  explanation: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Volitelná druhá akce mezi potvrzením a zrušením. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Podrobnosti o tom, čeho se potvrzení týká. */
  children?: ReactNode;
}) {
  const oknoRef = useRef<HTMLDivElement>(null);
  const potvrditRef = useRef<HTMLButtonElement>(null);
  // Portál potřebuje document, který na serveru není.
  const [vProhlizeci, setVProhlizeci] = useState(false);

  useEffect(() => setVProhlizeci(true), []);

  // Po otevření patří fokus na hlavní tlačítko, ať jde odpovědět Enterem.
  useEffect(() => {
    if (open) potvrditRef.current?.focus();
  }, [open]);

  // Stránka za oknem se nesmí rolovat, jinak okno "uteče".
  useEffect(() => {
    if (!open) return;

    const puvodni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = puvodni;
    };
  }, [open]);

  // Esc zavírá, Tab cykluje jen uvnitř okna. Bez té smyčky by se fokus
  // dostal na obsah za oknem, který uživatel stejně nemůže obsluhovat.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const prvky = oknoRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!prvky || prvky.length === 0) return;

      const prvni = prvky[0];
      const posledni = prvky[prvky.length - 1];
      const aktivni = document.activeElement;

      if (event.shiftKey && aktivni === prvni) {
        event.preventDefault();
        posledni.focus();
      } else if (!event.shiftKey && aktivni === posledni) {
        event.preventDefault();
        prvni.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open || !vProhlizeci) return null;

  return createPortal(
    <div
      // Na mobilu panel přes celou šířku dole, na větší obrazovce okno
      // uprostřed.
      // Ztmavení je na téhle vrstvě, ne ve vlastním divu uvnitř: jinak by
      // klik dopadl na ten div a podmínka níž by ho nepoznala jako klik
      // mimo okno.
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center"
      onMouseDown={(event) => {
        // Klik mimo okno zavírá. Na samotném okně se událost zastaví níž.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={oknoRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className="relative w-full rounded-t-2xl bg-white p-5 shadow-lg sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label={closeLabel}
          className="absolute right-4 top-4 text-ink/40 hover:text-ink"
        >
          <X size={18} />
        </button>

        <h2 className="pr-8 font-heading text-lg font-bold text-ink">{title}</h2>

        {children && <div className="mt-3">{children}</div>}

        <p className="mt-3 text-sm text-ink/60">{explanation}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            ref={potvrditRef}
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-coral px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-coral/40 px-4 py-2.5 text-sm font-medium text-coral hover:bg-coral/5"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm text-ink/60 hover:bg-haze"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
