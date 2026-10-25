// Posílání e-mailových notifikací o nové verzi/změně metodiky přes SMTP
// běžné e-mailové schránky (např. Gmail / Google Workspace s heslem pro
// aplikace). Stejnou schránku používá i Supabase pro přihlašovací odkazy.
import nodemailer from "nodemailer";
import type { DocumentKind } from "@/lib/types";

// Firemní barvy AI for children. V e-mailu se styly píšou rovnou k prvkům,
// poštovní klienti společný stylopis většinou zahodí.
const KORALOVA = "#DC5B5B";
const SVETLA = "#DAE7EC";
const TMAVA = "#070707";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Bez přihlašovacích údajů ke schránce se e-maily neposílají. Není to důvod
// cokoli shodit – zveřejnění verze musí projít i tak, jen se o ní nikdo
// nedozví e-mailem.
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

// Spojení se vytváří až při odeslání (ne při načtení souboru), aby appka šla
// sestavit, i než jsou SMTP údaje nastavené (např. při prvním nasazení).
// Výchozí server je Gmail; jiná pošta si nastaví SMTP_HOST a SMTP_PORT.
function transport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

// Gmail povolí odesílat jen za adresu schránky, proto odesílatel je vždy
// SMTP_USER, měnit jde jen zobrazované jméno.
function sender(): string {
  return `"${process.env.SMTP_FROM_NAME ?? "AI kurikulum"}" <${process.env.SMTP_USER}>`;
}

async function send(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  try {
    await transport().sendMail({ from: sender(), ...message });
    return { sent: true };
  } catch (chyba) {
    return { sent: false, error: chyba instanceof Error ? chyba.message : String(chyba) };
  }
}

export type SendResult =
  | { sent: true }
  | { sent: false; notConfigured: true }
  | { sent: false; error: string };

export async function sendChangeNotificationEmail(params: {
  to: string;
  moduleName: string;
  kind?: DocumentKind;
  versionNumber: number;
  uploadedAt: string;
  summary: string;
  notes: string[];
  countryName: string;
}): Promise<SendResult> {
  const { to, moduleName, kind, versionNumber, uploadedAt, summary, notes, countryName } = params;
  const coJe = kind === "presentation" ? "prezentace" : "metodiky";
  const lekce = kind === "presentation" ? `${moduleName} (prezentace)` : moduleName;
  const url = siteUrl();

  if (!mailConfigured()) return { sent: false, notConfigured: true };

  return send({
    to,
    subject: `Nová verze ${coJe}: ${moduleName} (${countryName})`,
    text:
      `Modul "${lekce}" má novou verzi (v${versionNumber}, ${formatUtc(uploadedAt)}).\n\n` +
      (summary ? `Co se změnilo:\n${summary}\n\n` : "") +
      (notes.length
        ? `Označená místa v dokumentu:\n${notes
            .map((note, index) => `${index + 1}. ${note}`)
            .join("\n")}\n\n`
        : "") +
      `Otevřít appku: ${url}`,
    html: emailLayout(
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TMAVA}">` +
        `Modul <strong>${escapeHtml(lekce)}</strong> má novou verzi ` +
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
}

// Zpráva ve vlákně „Napsat adminovi“: adminům, když napíše uživatel,
// uživateli, když mu admin odpoví. Text zprávy jde celý, ať se dá přečíst
// i bez otevření appky.
export async function sendSupportEmail(params: {
  to: string;
  /** Kdo píše – e-mail uživatele, nebo „admin“. */
  from: string;
  body: string;
  /** Kam odkaz v e-mailu vede (vlákno v appce). */
  path: string;
}): Promise<SendResult> {
  const { to, from, body, path } = params;
  if (!mailConfigured()) return { sent: false, notConfigured: true };

  const odkaz = `${siteUrl()}${path}`;
  return send({
    to,
    subject: `Nová zpráva v AI kurikulu od ${from}`,
    text: `${from} píše:\n\n${body}\n\nOdpovědět: ${odkaz}`,
    html: emailLayout(
      `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:${TMAVA}">` +
        `<strong>${escapeHtml(from)}</strong> píše:</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${TMAVA};white-space:pre-line">${escapeHtml(body)}</p>` +
        `<p style="margin:0 0 16px;font-size:14px"><a href="${odkaz}" style="color:${KORALOVA}">Odpovědět v appce</a></p>`
    ),
  });
}

// Autorovi předchozí verze dáme vědět, že na ni někdo navázal.
export async function sendNewerVersionEmail(params: {
  to: string;
  moduleName: string;
  kind?: DocumentKind;
  theirVersion: number;
  newVersion: number;
}): Promise<SendResult> {
  const { to, kind, theirVersion, newVersion } = params;
  const coJe = kind === "presentation" ? "prezentace" : "metodiky";
  const moduleName =
    kind === "presentation" ? `${params.moduleName} (prezentace)` : params.moduleName;
  const url = siteUrl();

  if (!mailConfigured()) return { sent: false, notConfigured: true };

  return send({
    to,
    subject: `K tvé verzi ${coJe} přibyla novější: ${params.moduleName}`,
    text:
      `K tvé verzi v${theirVersion} modulu "${moduleName}" přibyla novější verze v${newVersion}.\n\n` +
      `Otevřít appku: ${url}`,
    html: emailLayout(
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TMAVA}">` +
        `K tvé verzi v${theirVersion} modulu <strong>${escapeHtml(moduleName)}</strong> ` +
        `přibyla novější verze v${newVersion}.</p>`
    ),
  });
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
