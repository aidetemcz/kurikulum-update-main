// Posílání e-mailových notifikací o nové verzi/změně metodiky přes Resend.
import { Resend } from "resend";

// Firemní barvy AI for children. V e-mailu se styly píšou rovnou k prvkům,
// poštovní klienti společný stylopis většinou zahodí.
const KORALOVA = "#DC5B5B";
const SVETLA = "#DAE7EC";
const TMAVA = "#070707";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Bez klíče k Resendu se e-maily neposílají. Není to důvod cokoli shodit –
// zveřejnění verze musí projít i tak, jen se o ní nikdo nedozví e-mailem.
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult =
  | { sent: true }
  | { sent: false; notConfigured: true }
  | { sent: false; error: string };

export async function sendChangeNotificationEmail(params: {
  to: string;
  moduleName: string;
  versionNumber: number;
  uploadedAt: string;
  summary: string;
  notes: string[];
  countryName: string;
}): Promise<SendResult> {
  const { to, moduleName, versionNumber, uploadedAt, summary, notes, countryName } = params;
  const url = siteUrl();

  if (!mailConfigured()) return { sent: false, notConfigured: true };

  // Klient se vytváří až tady (ne při načtení souboru), aby appka šla
  // sestavit, i než je RESEND_API_KEY nastavený (např. při prvním nasazení).
  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "AI kurikulum <onboarding@resend.dev>",
    to,
    subject: `Nová verze metodiky: ${moduleName} (${countryName})`,
    text:
      `Modul "${moduleName}" má novou verzi (v${versionNumber}, ${formatUtc(uploadedAt)}).\n\n` +
      (summary ? `Co se změnilo:\n${summary}\n\n` : "") +
      (notes.length
        ? `Označená místa v dokumentu:\n${notes
            .map((note, index) => `${index + 1}. ${note}`)
            .join("\n")}\n\n`
        : "") +
      `Otevřít appku: ${url}`,
    html: emailLayout(
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TMAVA}">` +
        `Modul <strong>${escapeHtml(moduleName)}</strong> má novou verzi ` +
        `(v${versionNumber}, ${escapeHtml(formatUtc(uploadedAt))}).</p>` +
        (summary
          ? `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${TMAVA}">Co se změnilo</p>` +
            `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${TMAVA}">${escapeHtml(summary)}</p>`
          : "") +
        (notes.length
          ? `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${TMAVA}">Označená místa v dokumentu</p>` +
            `<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:${TMAVA}">` +
            notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("") +
            `</ol>`
          : "")
    ),
  });

  return odpoved(result);
}

// Autorovi předchozí verze dáme vědět, že na ni někdo navázal.
export async function sendNewerVersionEmail(params: {
  to: string;
  moduleName: string;
  theirVersion: number;
  newVersion: number;
}): Promise<SendResult> {
  const { to, moduleName, theirVersion, newVersion } = params;
  const url = siteUrl();

  if (!mailConfigured()) return { sent: false, notConfigured: true };

  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "AI kurikulum <onboarding@resend.dev>",
    to,
    subject: `K tvé verzi metodiky přibyla novější: ${moduleName}`,
    text:
      `K tvé verzi v${theirVersion} modulu "${moduleName}" přibyla novější verze v${newVersion}.\n\n` +
      `Otevřít appku: ${url}`,
    html: emailLayout(
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TMAVA}">` +
        `K tvé verzi v${theirVersion} modulu <strong>${escapeHtml(moduleName)}</strong> ` +
        `přibyla novější verze v${newVersion}.</p>`
    ),
  });

  return odpoved(result);
}

// Resend chybu nevyhazuje, vrací ji vedle dat.
function odpoved(result: { error: { name: string; message: string } | null }): SendResult {
  if (result.error) return { sent: false, error: `${result.error.name}: ${result.error.message}` };
  return { sent: true };
}

// Společný rám e-mailu: logo nahoře, obsah, tlačítko do appky.
// Logo je odkazované úplnou adresou, ne přílohou – přílohy poštovní
// klienti ukazují jako soubor ke stažení.
export function emailLayout(obsah: string): string {
  const url = siteUrl();

  return `<!doctype html>
<html lang="cs">
  <body style="margin:0;padding:0;background-color:${SVETLA};font-family:Inter,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SVETLA};padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;padding:32px">
            <tr>
              <td style="padding-bottom:24px">
                <img src="${url}/logo-aidetem-192.png" width="48" height="48" alt="AI for children"
                     style="display:block;border:0;width:48px;height:48px" />
              </td>
            </tr>
            <tr>
              <td>${obsah}</td>
            </tr>
            <tr>
              <td style="padding-top:8px">
                <a href="${url}"
                   style="display:inline-block;background-color:${KORALOVA};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:12px">
                  Otevřít appku
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Texty chodí od uživatelů, do HTML je nelze vložit tak, jak jsou.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// V e-mailu neznáme časové pásmo příjemce, proto čas píšeme v UTC.
function formatUtc(value: string): string {
  return new Date(value).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}
