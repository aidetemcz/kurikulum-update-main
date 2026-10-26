// Upozornění na zveřejněnou změnu: notifikace ve zvonečku a e-maily.
//
// Notifikace se zakládají hned při zveřejnění (jedním zápisem), e-maily
// se posílají až po odeslání odpovědi (after() v app/admin/upload/actions.ts),
// aby pomalá pošta nezdržela ani neshodila zveřejnění.
import { createAdminClient } from "@/lib/supabase/server";
import { sendChangeNotificationEmail, sendNewerVersionEmail } from "@/lib/mail";
import type { DocumentKind } from "@/lib/types";

export type Recipient = { id: string; email: string; notificationId: string | null };

// Kdo spravuje aspoň jednu ze zemí, kterým se změna posílá (kromě toho,
// kdo ji nahrál), dostane jednu notifikaci – i když má zemí víc.
// Autor předchozí verze ji dostane taky, ať se dozví o novější.
export async function createChangeNotifications(params: {
  changeId: string;
  recipientCountryIds: string[];
  uploaderId: string;
  previousAuthorId: string | null;
}): Promise<{ recipients: Recipient[]; previousAuthor: Recipient | null }> {
  const { changeId, recipientCountryIds, uploaderId, previousAuthorId } = params;
  const supabase = createAdminClient();

  const podleId = new Map<string, { id: string; email: string }>();
  if (recipientCountryIds.length > 0) {
    const { data: vazby, error } = await supabase
      .from("user_countries")
      .select("user_id, users (id, email)")
      .in("country_id", recipientCountryIds);
    if (error) console.error("Nepodařilo se načíst příjemce notifikace:", error);

    for (const vazba of vazby ?? []) {
      const uzivatel = Array.isArray(vazba.users) ? vazba.users[0] : vazba.users;
      if (!uzivatel?.email || uzivatel.id === uploaderId) continue;
      podleId.set(uzivatel.id, uzivatel);
    }
  }

  let autor: { id: string; email: string } | null = null;
  if (previousAuthorId && previousAuthorId !== uploaderId) {
    const { data } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", previousAuthorId)
      .maybeSingle();
    if (data?.email) autor = data;
  }

  const komu = [...podleId.values(), ...(autor && !podleId.has(autor.id) ? [autor] : [])];
  const idNotifikaci = new Map<string, string>();
  if (komu.length > 0) {
    const { data: vlozene, error } = await supabase
      .from("notifications")
      .insert(komu.map((uzivatel) => ({ user_id: uzivatel.id, change_id: changeId })))
      .select("id, user_id");
    if (error) console.error("Notifikace se nepodařilo založit:", error);
    for (const radek of vlozene ?? []) idNotifikaci.set(radek.user_id, radek.id);
  }

  const sNotifikaci = (uzivatel: { id: string; email: string }): Recipient => ({
    ...uzivatel,
    notificationId: idNotifikaci.get(uzivatel.id) ?? null,
  });

  return {
    recipients: [...podleId.values()].map(sNotifikaci),
    previousAuthor: autor ? sNotifikaci(autor) : null,
  };
}

// E-maily lidem ze zemí, kterým změna přišla. Posílají se souběžně přes
// sdílené spojení (lib/mail.ts); chyba jednoho neshodí ostatní.
export async function emailChangeRecipients(
  recipients: Recipient[],
  params: {
    countryName: string;
    moduleName: string;
    kind?: DocumentKind;
    versionNumber: number;
    uploadedAt: string;
    summary: string;
    notes: string[];
  }
) {
  const supabase = createAdminClient();

  await Promise.allSettled(
    recipients.map(async (recipient) => {
      try {
        const odeslani = await sendChangeNotificationEmail({ to: recipient.email, ...params });

        // Čas odeslání se zapíše, jen když e-mail opravdu odešel. Když
        // chybí přístup ke schránce, notifikace v appce zůstává, e-mail ne.
        if (!odeslani.sent) {
          console.warn(
            `E-mail na ${recipient.email} neodešel:`,
            "notConfigured" in odeslani ? "SMTP_USER / SMTP_PASSWORD nejsou nastavené" : odeslani.error
          );
        } else if (recipient.notificationId) {
          await supabase
            .from("notifications")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", recipient.notificationId);
        }
      } catch (emailError) {
        console.error(`Nepodařilo se poslat e-mail na ${recipient.email}:`, emailError);
      }
    })
  );
}

// Autor předchozí verze se dozví, že k ní přibyla novější.
export async function emailPreviousAuthor(
  author: Recipient,
  params: { moduleName: string; kind?: DocumentKind; theirVersion: number; newVersion: number }
) {
  try {
    const odeslani = await sendNewerVersionEmail({ to: author.email, ...params });
    if (!odeslani.sent) console.warn(`Autora ${author.email} se nepodařilo upozornit e-mailem.`);
  } catch (emailError) {
    console.error(`Nepodařilo se upozornit autora ${author.email}:`, emailError);
  }
}
