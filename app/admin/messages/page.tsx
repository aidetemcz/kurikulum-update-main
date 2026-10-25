import Link from "next/link";
import { requireAdmin } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { getThreads } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { LocalDateTime } from "@/components/LocalDateTime";
import { AdminCompose, type ComposeCountry } from "@/components/AdminCompose";

// Schránka admina: nahoře psaní zemím, pod tím konverzace – kdo napsal
// a co naposledy, nepřečtené výrazněji.
export default async function MessagesPage() {
  const admin = await requireAdmin();
  const { t } = await resolveActiveCountry(admin);
  const threads = await getThreads();

  const supabase = await createClient();
  const [{ data: countries }, { data: users }, { data: vazby }] = await Promise.all([
    supabase.from("countries").select("id, name").order("name"),
    supabase.from("users").select("id, email").order("email"),
    supabase.from("user_countries").select("user_id, country_id"),
  ]);
  const zeme: ComposeCountry[] = (countries ?? []).map((country) => ({
    id: country.id,
    name: country.name,
    userIds: (vazby ?? [])
      .filter((vazba) => vazba.country_id === country.id)
      .map((vazba) => vazba.user_id),
  }));

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl font-bold text-ink">{t.messagesTitle}</h1>

      <AdminCompose countries={zeme} people={users ?? []} adminId={admin.id} t={t} />

      <h2 className="mb-3 font-heading text-xl font-bold text-ink">{t.threadsTitle}</h2>

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
