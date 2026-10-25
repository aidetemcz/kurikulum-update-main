// Po zapsání změny vytvoří in-app notifikaci pro všechny uživatele dané
// země a pošle jim e-mail. Voláno ze server akce po nahrání nové verze
// (viz app/admin/upload/actions.ts).
import { createAdminClient } from "@/lib/supabase/server";
import { sendChangeNotificationEmail, sendNewerVersionEmail } from "@/lib/mail";

export async function notifyCountryAboutChange(params: {
  changeId: string;
  /** Země, kterým se má dát vědět – tedy všechny kromě té, která nahrála. */
  recipientCountryIds: string[];
  /** Kdo změnu nahrál. Sám sobě upozornění neposílá. */
  uploaderId: string;
  countryName: string;
  moduleName: string;
  versionNumber: number;
  uploadedAt: string;
  /** Celkové shrnutí, pokud ho editor napsal. */
  summary: string;
  /** Popisy jednotlivých označených míst v pořadí čtení. */
  notes: string[];
}) {
  const { changeId, recipientCountryIds, uploaderId, countryName, moduleName, versionNumber, uploadedAt, summary, notes } = params;
  const supabase = createAdminClient();

  if (recipientCountryIds.length === 0) return;

  // Kdo spravuje aspoň jednu ze zemí, kterým se dává vědět. Kdo jich má
  // víc, dostane e-mail stejně jen jednou.
  const { data: vazby, error } = await supabase
    .from("user_countries")
    .select("user_id, users (id, email)")
    .in("country_id", recipientCountryIds);

  if (error || !vazby) {
    console.error("Nepodařilo se načíst příjemce notifikace:", error);
    return;
  }

  const podleId = new Map<string, { id: string; email: string }>();
  for (const vazba of vazby) {
    const uzivatel = Array.isArray(vazba.users) ? vazba.users[0] : vazba.users;
    if (!uzivatel?.email) continue;
    if (uzivatel.id === uploaderId) continue;
    podleId.set(uzivatel.id, uzivatel);
  }
  const recipients = [...podleId.values()];

  for (const recipient of recipients) {
    const { data: notification } = await supabase
      .from("notifications")
      .insert({ user_id: recipient.id, change_id: changeId })
      .select()
      .single();

    try {
      const odeslani = await sendChangeNotificationEmail({
        to: recipient.email,
        moduleName,
        versionNumber,
        uploadedAt,
        summary,
        notes,
        countryName,
      });

      // Čas odeslání se zapíše, jen když e-mail opravdu odešel. Když
      // chybí přístup ke schránce, notifikace v appce zůstává, e-mail ne.
      if (!odeslani.sent) {
        console.warn(
          `E-mail na ${recipient.email} neodešel:`,
          "notConfigured" in odeslani ? "SMTP_USER / SMTP_PASSWORD nejsou nastavené" : odeslani.error
        );
      } else if (notification) {
        await supabase
          .from("notifications")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", notification.id);
      }
    } catch (emailError) {
      // Notifikace v appce zůstane vytvořená, i když se e-mail nepodaří poslat.
      console.error(`Nepodařilo se poslat e-mail na ${recipient.email}:`, emailError);
    }
  }
}

// Autor předchozí verze se dozví, že k ní přibyla novější.
export async function notifyPreviousAuthor(params: {
  changeId: string;
  authorId: string;
  moduleName: string;
  theirVersion: number;
  newVersion: number;
}) {
  const { changeId, authorId, moduleName, theirVersion, newVersion } = params;
  const supabase = createAdminClient();

  const { data: author } = await supabase
    .from("users")
    .select("email")
    .eq("id", authorId)
    .maybeSingle();

  if (!author?.email) return;

  // Notifikaci v appce už mohl dostat jako člen země – pak ji nezdvojujeme.
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", authorId)
    .eq("change_id", changeId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("notifications").insert({ user_id: authorId, change_id: changeId });
  }

  try {
    const odeslani = await sendNewerVersionEmail({
      to: author.email,
      moduleName,
      theirVersion,
      newVersion,
    });
    if (!odeslani.sent) {
      console.warn(`Autora ${author.email} se nepodařilo upozornit e-mailem.`);
    }
  } catch (emailError) {
    console.error(`Nepodařilo se upozornit autora ${author.email}:`, emailError);
  }
}
