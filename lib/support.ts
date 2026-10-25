// Zprávy adminům z appky („Napsat adminovi“). Každý uživatel má s adminy
// jedno vlákno; viz supabase/migrations/0013_support_messages.sql.
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type SupportMessage = {
  id: string;
  user_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  read_by_admin_at: string | null;
  read_by_user_at: string | null;
};

export type SupportThread = {
  userId: string;
  email: string;
  lastBody: string;
  lastAt: string;
  /** Zprávy od uživatele, které ještě žádný admin neviděl. */
  unread: number;
};

export async function getThread(userId: string): Promise<SupportMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []) as SupportMessage[];
}

// Přehled vláken pro admina, nejnovější nahoře.
export async function getThreads(): Promise<SupportThread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_messages")
    .select("user_id, author_id, body, created_at, read_by_admin_at, users:user_id (email)")
    .order("created_at", { ascending: false });

  const vlakna = new Map<string, SupportThread>();
  for (const row of data ?? []) {
    const uzivatel = Array.isArray(row.users) ? row.users[0] : row.users;
    const vlakno =
      vlakna.get(row.user_id) ??
      {
        userId: row.user_id,
        email: uzivatel?.email ?? "?",
        lastBody: row.body,
        lastAt: row.created_at,
        unread: 0,
      };
    if (row.author_id === row.user_id && !row.read_by_admin_at) vlakno.unread += 1;
    vlakna.set(row.user_id, vlakno);
  }
  return [...vlakna.values()];
}

// Počet nepřečtených pro odznak v menu: adminovi zprávy od lidí, ostatním
// odpovědi adminů v jejich vlákně.
export async function getSupportUnread(user: { id: string; role: string }): Promise<number> {
  const supabase = await createClient();

  if (user.role === "admin") {
    const { data } = await supabase
      .from("support_messages")
      .select("user_id, author_id")
      .is("read_by_admin_at", null);
    return (data ?? []).filter((row) => row.author_id === row.user_id).length;
  }

  const { data } = await supabase
    .from("support_messages")
    .select("author_id")
    .eq("user_id", user.id)
    .is("read_by_user_at", null);
  return (data ?? []).filter((row) => row.author_id !== user.id).length;
}

// Označení za přečtené. Jde přes service role, protože uživatel jinak
// zprávy měnit nesmí (v databázi pro ně není pravidlo update).
export async function markThreadRead(userId: string, by: "admin" | "user") {
  const supabase = createAdminClient();
  const ted = new Date().toISOString();

  if (by === "admin") {
    await supabase
      .from("support_messages")
      .update({ read_by_admin_at: ted })
      .eq("user_id", userId)
      .eq("author_id", userId)
      .is("read_by_admin_at", null);
  } else {
    await supabase
      .from("support_messages")
      .update({ read_by_user_at: ted })
      .eq("user_id", userId)
      .neq("author_id", userId)
      .is("read_by_user_at", null);
  }
}

// E-maily adminů – komu dát vědět o nové zprávě.
export async function adminEmails(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("email").eq("role", "admin");
  return (data ?? []).map((row) => row.email).filter(Boolean);
}
