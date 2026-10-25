// Rozpoznání chyb z přihlašování a pozvánek.
//
// Supabase hlídá, kolik e-mailů za hodinu pošle. Bez vlastního SMTP je to
// jen pár zpráv, s vlastním SMTP se limit nastaví v Rate Limits. Uživateli se to musí
// říct srozumitelně, jinak zkouší znovu a znovu a limit tím jen drží.

type AuthLikeError = { message?: string; status?: number; code?: string } | null | undefined;

export function isRateLimit(error: AuthLikeError): boolean {
  if (!error) return false;
  if (error.status === 429) return true;

  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return text.includes("rate limit") || text.includes("over_email_send_rate_limit");
}
