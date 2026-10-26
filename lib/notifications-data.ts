// Načtení notifikací aktuálního uživatele včetně textu změny a názvu modulu,
// aby se dal zvoneček s notifikacemi vykreslit jedním dotazem.
import { createClient } from "@/lib/supabase/server";

export type NotificationWithDetails = {
  id: string;
  read_at: string | null;
  created_at: string;
  note: string;
  category: string | null;
  module_name: string;
  version_number: number;
};

export type NotificationsForBell = {
  /** Posledních 20 notifikací, nejnovější nahoře. */
  items: NotificationWithDetails[];
  /** Kolik nepřečtených má uživatel celkem – i mimo těch 20. */
  unreadTotal: number;
};

const SLOUPCE = `
      id,
      read_at,
      changes (
        note,
        category,
        created_at,
        document_versions ( version_number, published_at, uploaded_at, modules ( name ) )
      )
    `;

export async function getNotificationsForCurrentUser(
  userId: string
): Promise<NotificationsForBell> {
  const supabase = await createClient();

  // Řadí se podle času vzniku notifikace (migrace 0018). Dřív se řadilo
  // podle id, což je náhodné UUID, a zvoneček ukazoval náhodných dvacet.
  const nacti = (podleCasu: boolean) =>
    supabase
      .from("notifications")
      .select(SLOUPCE)
      .eq("user_id", userId)
      .order(podleCasu ? "created_at" : "id", { ascending: false })
      .limit(20);

  const [seznam, { count }] = await Promise.all([
    nacti(true),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);
  let { data, error } = seznam;
  // Bez migrace 0018 sloupec created_at chybí – pak aspoň po staru.
  if (error && ["42703", "PGRST204"].includes(error.code ?? "")) {
    ({ data, error } = await nacti(false));
  }

  if (error || !data) return { items: [], unreadTotal: count ?? 0 };

  return { items: data.map(radek), unreadTotal: count ?? 0 };
}

type Radek = {
  id: string;
  read_at: string | null;
  changes: unknown;
};

function radek(n: Radek): NotificationWithDetails {
  // Supabase vrací vnořené vztahy jako pole nebo objekt podle typu vazby;
  // pro jistotu obojí ošetříme.
  type Zmena = {
    note: string;
    category: string | null;
    created_at: string;
    document_versions: unknown;
  };
  type Verze = {
    version_number: number;
    published_at: string | null;
    uploaded_at: string | null;
    modules: unknown;
  };
  const one = <T,>(value: unknown): T | null =>
    (Array.isArray(value) ? value[0] ?? null : value ?? null) as T | null;

  const change = one<Zmena>(n.changes);
  const version = one<Verze>(change?.document_versions);
  const moduleData = one<{ name: string }>(version?.modules);

  return {
    id: n.id,
    read_at: n.read_at,
    // Kdy byla verze zveřejněná – ne kdy vznikl její koncept.
    created_at: version?.published_at ?? version?.uploaded_at ?? change?.created_at ?? "",
    note: change?.note ?? "",
    category: change?.category ?? null,
    module_name: moduleData?.name ?? "Neznámý modul",
    version_number: version?.version_number ?? 0,
  };
}
