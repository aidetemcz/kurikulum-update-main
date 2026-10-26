// Chybová hláška pro uživatele.
//
// Zemím se technický důvod chyby nikdy neukazuje (texty z Postgresu,
// PostgREST, chybějící klíče…) – dostanou obecnou větu v jejich jazyce
// a detail jde do logů ve Vercelu. Skutečný admin (i v náhledu jako jiná
// země) smí vidět i detail, ať může hned poznat, co se děje.
import { getRealUser } from "@/lib/current-user";

export async function userError(obecne: string, detail: unknown, kde: string): Promise<string> {
  console.error(kde, detail);

  const skutecny = await getRealUser().catch(() => null);
  if (skutecny?.role !== "admin") return obecne;

  const text = popis(detail);
  return text ? `${obecne} (${text})` : obecne;
}

function popis(detail: unknown): string {
  if (detail instanceof Error) return detail.message;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message ?? "");
  }
  return detail == null ? "" : String(detail);
}
