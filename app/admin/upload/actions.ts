"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, canUpload, canWriteForCountry } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { extractDriveFileId, drivePreviewUrl } from "@/lib/drive";
import { sortMarks } from "@/lib/annotations";
import { notifyCountryAboutChange, notifyPreviousAuthor } from "@/lib/notify";
import { translateNotes } from "@/lib/translate";
import { toLocale } from "@/lib/i18n";
import type { Mark } from "@/lib/types";

// Kolikrát zkusíme zveřejnění znovu, když nám někdo souběžně vezme číslo verze.
const VERSION_ATTEMPTS = 5;

// ---------------------------------------------------------------------
// Rozpracovaná verze (draft)
// ---------------------------------------------------------------------
// Vzniká, jakmile je vyplněný modul, země a platný odkaz. Značky se k ní
// ukládají průběžně. V přehledu se neukazuje a notifikace neposílá –
// to obojí se děje až při zveřejnění.

export async function ensureDraftVersion(
  moduleId: string,
  countryId: string,
  driveLink: string
): Promise<{ draftId: string; savedAt: string } | { error: string }> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user, countryId);

  if (!canUpload(user)) return { error: t.uploadNotAllowed };
  // Formulář cizí zemi nenabízí, ale na tom se to stát nesmí – někdo může
  // poslat požadavek i mimo něj.
  if (countryId && !canWriteForCountry(user, countryId)) {
    return { error: t.uploadForeignCountry };
  }

  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return { error: t.driveLinkNotRecognized };
  if (!moduleId || !countryId) return { error: t.uploadMissingFields };

  const supabase = await createClient();
  const fileUrl = drivePreviewUrl(fileId);

  // Jeden rozpracovaný záznam na uživatele – když mezitím změnil modul,
  // zemi nebo odkaz, jen ho přepíšeme.
  const { data: existing } = await supabase
    .from("document_versions")
    .select("id")
    .eq("uploaded_by", user.id)
    .eq("status", "draft")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("document_versions")
      .update({ module_id: moduleId, country_id: countryId, file_url: fileUrl })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: `${t.saveFailedDetail} ${error.message}` };
    // Nula řádků bez chyby znamená, že zápis zastavila pravidla v databázi.
    if (!updated) return { error: t.publishBlocked };
    return { draftId: existing.id, savedAt: new Date().toISOString() };
  }

  const { data, error } = await supabase
    .from("document_versions")
    .insert({
      module_id: moduleId,
      country_id: countryId,
      file_url: fileUrl,
      status: "draft",
      version_number: null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: `${t.saveFailedDetail} ${error?.message ?? ""}` };
  return { draftId: data.id, savedAt: new Date().toISOString() };
}

export async function saveDraftMarks(
  draftId: string,
  marks: Mark[]
): Promise<{ savedAt: string } | { error: string }> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user);

  if (!canUpload(user)) return { error: t.uploadNotAllowed };

  const supabase = await createClient();

  // Nové značky zapisujeme dřív, než smažeme ty původní – kdyby zápis
  // selhal, o rozdělanou práci uživatel nepřijde.
  const { data: existing, error: readError } = await supabase
    .from("annotations")
    .select("id")
    .eq("document_version_id", draftId);

  if (readError) return { error: `${t.saveFailedDetail} ${readError.message}` };

  const described = marks.filter((mark) => mark.note?.trim());

  if (described.length > 0) {
    const { error } = await supabase.from("annotations").insert(
      described.map((mark) => ({
        document_version_id: draftId,
        page: mark.page,
        x: mark.x,
        y: mark.y,
        w: mark.w,
        h: mark.h,
        note: mark.note,
        category: mark.category,
        quote: mark.quote ?? null,
      }))
    );

    if (error) return { error: `${t.saveFailedDetail} ${error.message}` };
  }

  const previousIds = (existing ?? []).map((row) => row.id);
  if (previousIds.length > 0) {
    const { error } = await supabase.from("annotations").delete().in("id", previousIds);
    if (error) return { error: `${t.saveFailedDetail} ${error.message}` };
  }

  return { savedAt: new Date().toISOString() };
}

export async function discardDraft(draftId: string): Promise<{ error: string } | null> {
  const user = await requireUser();
  if (!canUpload(user)) return { error: "forbidden" };

  const supabase = await createClient();
  // Značky zmizí samy, mají v databázi nastavené mazání spolu s verzí.
  const { error } = await supabase
    .from("document_versions")
    .delete()
    .eq("id", draftId)
    .eq("status", "draft");

  return error ? { error: error.message } : null;
}

// ---------------------------------------------------------------------
// Zveřejnění
// ---------------------------------------------------------------------

export type PublishState =
  | { error: string }
  | {
      // Zveřejnilo se, ale mezitím někdo jiný přidal vlastní verzi.
      warning: {
        otherVersion: number;
        otherAuthor: string;
        otherUploadedAt: string;
        savedVersion: number;
        moduleId: string;
        countryId: string;
      };
    }
  | null;

export async function publishVersion(
  _prevState: PublishState,
  formData: FormData
): Promise<PublishState> {
  const user = await requireUser();

  const draftId = String(formData.get("draftId") ?? "");
  const summary = String(formData.get("note") ?? "").trim();
  const knownLatest = Number(formData.get("knownLatest") ?? 0);

  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("document_versions")
    .select("id, module_id, country_id")
    .eq("id", draftId)
    .eq("status", "draft")
    .maybeSingle();

  const { t } = await resolveActiveCountry(user, draft?.country_id);

  if (!canUpload(user)) return { error: t.uploadNotAllowed };
  if (!draft) return { error: t.uploadMissingFields };
  if (!canWriteForCountry(user, draft.country_id)) {
    return { error: t.uploadForeignCountry };
  }

  const { module_id: moduleId, country_id: countryId } = draft;

  const { data: marks } = await supabase
    .from("annotations")
    .select("*")
    .eq("document_version_id", draftId);

  if ((marks ?? []).length === 0 && !summary) return { error: t.needMarkOrSummary };

  // Číslo verze přidělujeme až tady. Souběžný zápis odmítne databáze
  // (dvojice modul+země+číslo je unikátní), takže to zkusíme s dalším číslem.
  let published: { version_number: number; uploaded_at: string } | null = null;
  let previous: { version_number: number; uploaded_at: string; uploaded_by: string | null } | null =
    null;
  let lastError = "";

  for (let attempt = 0; attempt < VERSION_ATTEMPTS && !published; attempt++) {
    const { data: latest } = await supabase
      .from("document_versions")
      .select("version_number, uploaded_at, uploaded_by")
      .eq("module_id", moduleId)
      .eq("country_id", countryId)
      .eq("status", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    previous = latest ?? null;

    // maybeSingle, ne single: když pravidla v databázi zápis nepustí,
    // vrátí se nula řádků. single() by z toho udělal nesrozumitelné
    // "Cannot coerce the result to a single JSON object".
    const { data, error } = await supabase
      .from("document_versions")
      .update({
        version_number: (latest?.version_number ?? 0) + 1,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("status", "draft")
      .select("version_number, uploaded_at")
      .maybeSingle();

    if (data) {
      published = data;
    } else {
      lastError = error?.message ?? t.publishBlocked;
      if (error?.code !== "23505") break;
    }
  }

  if (!published) return { error: `${t.saveFailedDetail} ${lastError}`.trim() };

  const noteList = sortMarks(
    (marks ?? []).map((mark) => ({
      id: mark.id,
      page: mark.page,
      x: mark.x,
      y: mark.y,
      w: mark.w,
      h: mark.h,
      note: mark.note,
      category: mark.category,
    }))
  ).map((mark) => mark.note);

  // Ostatní země dostanou ke každé vyznačené změně svůj řádek – ten drží,
  // jestli už na ni zareagovaly. Země se berou z tabulky, ne z pevného
  // seznamu, takže nově přidaná země se zapojí sama.
  //
  // Vlastní změna se nevrací do žádné ze zemí, které nahrávající spravuje:
  // kdo má Česko i angličtinu, nemá co odbavovat sám po sobě.
  const { data: allCountries } = await supabase.from("countries").select("id, locale");

  const vlastni = new Set([countryId, ...user.country_ids]);
  const prijemci = (allCountries ?? []).filter((country) => !vlastni.has(country.id));

  const statusRows = prijemci.flatMap((country) =>
    (marks ?? []).map((mark) => ({ annotation_id: mark.id, country_id: country.id }))
  );

  // Obyčejný insert, ne upsert: rozpracovanou verzi jde zveřejnit jen jednou
  // (podruhé se už nenajde mezi draft verzemi), takže se řádky nemají jak
  // zdvojit. Navíc "on conflict" by editor stejně neprošel – na cizí řádky
  // kvůli RLS nevidí, a Postgres v tu chvíli zápis odmítne.
  if (statusRows.length > 0) {
    const { error: statusError } = await supabase
      .from("annotation_country_status")
      .insert(statusRows);

    if (statusError) {
      return { error: `${t.saveFailedDetail} ${statusError.message}`.trim() };
    }
  }

  const { data: change, error: changeError } = await supabase
    .from("changes")
    .insert({
      document_version_id: draftId,
      note: summary || noteList.map((note, index) => `${index + 1}. ${note}`).join("\n"),
      category: null,
    })
    .select()
    .single();

  if (changeError || !change) {
    return { error: `${t.saveFailedDetail} ${changeError?.message ?? ""}`.trim() };
  }

  // Poznámky a shrnutí se přeloží do jazyků zemí, kterým se posílají,
  // a vždy do angličtiny. Originál zůstává, jak byl napsaný.
  await translatePublished({
    supabase,
    marks: marks ?? [],
    changeId: change.id,
    summary: summary || null,
    sourceLocale: toLocale(
      (await supabase.from("countries").select("locale").eq("id", countryId).maybeSingle())
        .data?.locale
    ),
    targetLocales: [
      "en" as const,
      ...prijemci.map((country) => toLocale(country.locale)),
    ],
  });

  const [{ data: moduleData }, { data: countryData }] = await Promise.all([
    supabase.from("modules").select("name").eq("id", moduleId).single(),
    supabase.from("countries").select("name").eq("id", countryId).single(),
  ]);

  // Notifikace odcházejí jednou, až je verze opravdu zveřejněná.
  await notifyCountryAboutChange({
    changeId: change.id,
    recipientCountryIds: prijemci.map((country) => country.id),
    uploaderId: user.id,
    countryName: countryData?.name ?? "",
    moduleName: moduleData?.name ?? "",
    versionNumber: published.version_number,
    uploadedAt: published.uploaded_at,
    summary,
    notes: noteList,
  });

  if (previous?.uploaded_by && previous.uploaded_by !== user.id) {
    await notifyPreviousAuthor({
      changeId: change.id,
      authorId: previous.uploaded_by,
      moduleName: moduleData?.name ?? "",
      theirVersion: previous.version_number,
      newVersion: published.version_number,
    });
  }

  revalidatePath("/");
  revalidatePath("/changes");
  revalidatePath(`/modules/${moduleId}`);

  // Když mezitím přibyla cizí verze, nepřesměrováváme – uživatel se to má
  // dozvědět hned a rozhodnout se, jestli se úpravy nepřekrývají.
  if (previous && previous.version_number > knownLatest && previous.uploaded_by !== user.id) {
    const { data: author } = await supabase
      .from("users")
      .select("email")
      .eq("id", previous.uploaded_by ?? "")
      .maybeSingle();

    return {
      warning: {
        otherVersion: previous.version_number,
        otherAuthor: author?.email ?? "",
        otherUploadedAt: previous.uploaded_at,
        savedVersion: published.version_number,
        moduleId,
        countryId,
      },
    };
  }

  redirect(`/modules/${moduleId}?country=${countryId}`);
}

// Překlad poznámek. Zveřejnění kvůli němu nikdy nespadne – když se
// nepovede, uloží se jen příznak a v appce se ukáže originál.
async function translatePublished(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  marks: { id: string; note: string; quote?: string | null }[];
  changeId: string;
  summary: string | null;
  sourceLocale: ReturnType<typeof toLocale>;
  targetLocales: ReturnType<typeof toLocale>[];
}) {
  const { supabase, marks, changeId, summary, sourceLocale, targetLocales } = params;

  // Text pod značkami jde do téhož překladu, jen za poznámky a shrnutí.
  const citace = marks.filter((mark) => mark.quote?.trim());
  const texts = [
    ...marks.map((mark) => mark.note),
    ...(summary ? [summary] : []),
    ...citace.map((mark) => mark.quote as string),
  ];
  if (texts.length === 0) return;

  const prelozene = await translateNotes(texts, sourceLocale, [...new Set(targetLocales)]);

  for (const [index, mark] of marks.entries()) {
    const vysledek = prelozene[index];
    if (!vysledek) continue;
    await supabase
      .from("annotations")
      .update({
        source_locale: vysledek.sourceLocale,
        translations: vysledek.translations,
        translation_failed: vysledek.failed,
      })
      .eq("id", mark.id);
  }

  const prvniCitace = marks.length + (summary ? 1 : 0);
  for (const [index, mark] of citace.entries()) {
    const vysledek = prelozene[prvniCitace + index];
    if (!vysledek) continue;
    await supabase
      .from("annotations")
      .update({ quote_translations: vysledek.translations })
      .eq("id", mark.id);
  }

  const proShrnuti = summary ? prelozene[marks.length] : null;
  if (proShrnuti) {
    await supabase
      .from("changes")
      .update({
        source_locale: proShrnuti.sourceLocale,
        translations: proShrnuti.translations,
        translation_failed: proShrnuti.failed,
      })
      .eq("id", changeId);
  }
}
