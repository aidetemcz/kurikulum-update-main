import Link from "next/link";
import { requireAdmin } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getThreads } from "@/lib/support";
import { LocalDateTime } from "@/components/LocalDateTime";

// Schránka admina: kdo napsal a co naposledy, nepřečtené nahoře výrazněji.
export default async function MessagesPage() {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);
  const threads = await getThreads();

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl font-bold text-ink">{t.messagesTitle}</h1>

      {threads.length === 0 ? (
        <p className="text-sm text-ink/50">{t.noThreads}</p>
      ) : (
        <ul className="flex max-w-2xl flex-col gap-2">
          {threads.map((thread) => (
            <li key={thread.userId}>
              <Link
                href={`/admin/messages/${thread.userId}`}
                className={`flex items-start justify-between gap-3 rounded-2xl border p-4 hover:border-coral ${
                  thread.unread > 0 ? "border-coral" : "border-haze"
                }`}
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-ink">{thread.email}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink/60">{thread.lastBody}</p>
                  <p className="mt-1 text-xs text-ink/40">
                    <LocalDateTime value={thread.lastAt} locale={t.dateLocale} />
                  </p>
                </div>
                {thread.unread > 0 && (
                  <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-semibold text-white">
                    {thread.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
