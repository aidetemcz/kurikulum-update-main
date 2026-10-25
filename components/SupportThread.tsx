"use client";

import { useActionState, useEffect, useRef } from "react";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { MessageState } from "@/app/help/actions";
import type { SupportMessage } from "@/lib/support";
import type { Dictionary } from "@/lib/i18n";

// Vlákno zpráv mezi uživatelem a adminy a pole pro novou zprávu. Stejné
// pro uživatele (/help) i pro admina (/admin/messages/[userId]).
export function SupportThread({
  messages,
  threadUserId,
  viewerId,
  otherLabel,
  action,
  t,
}: {
  messages: SupportMessage[];
  /** Čí vlákno to je. */
  threadUserId: string;
  /** Kdo se dívá – jeho zprávy jsou vpravo. */
  viewerId: string;
  /** Jak se jmenuje protistrana (admin, nebo e-mail uživatele). */
  otherLabel: string;
  action: (state: MessageState, formData: FormData) => Promise<MessageState>;
  t: Dictionary;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Po odeslání vyprázdnit pole a odrolovat na poslední zprávu.
  useEffect(() => {
    if (state && "sentAt" in state) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-haze p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-ink/50">{t.noMessagesYet}</p>
        ) : (
          messages.map((message) => {
            const moje = message.author_id === viewerId;
            // Zprávu od majitele vlákna vidí admin jako od něj, ostatní je od adminů.
            const kdo = moje
              ? t.youLabel
              : message.author_id === threadUserId
                ? otherLabel
                : t.adminLabel;
            return (
              <div key={message.id} className={`flex flex-col ${moje ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    moje ? "bg-coral text-white" : "bg-haze/60 text-ink"
                  }`}
                >
                  {message.body}
                </div>
                <span className="mt-0.5 text-[11px] text-ink/40">
                  {kdo} · <LocalDateTime value={message.created_at} locale={t.dateLocale} />
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="userId" value={threadUserId} />
        <textarea
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder={t.messagePlaceholder}
          className="input"
          onKeyDown={(event) => {
            // Ctrl/Cmd+Enter odešle, obyčejný Enter dělá nový řádek.
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? t.sendingMessage : t.sendMessage}
          </button>
          {state && "error" in state && <span className="text-sm text-coral">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
