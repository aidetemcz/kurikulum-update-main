"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireUser, canUpload, canWriteForCountry } from "@/lib/current-user";
import { resolveActiveCountry } from "@/lib/active-country";
import { extractDriveFileId, drivePreviewUrl } from "@/lib/drive";
import { sortMarks } from "@/lib/annotations";
import { createChangeNotifications, emailChangeRecipients, emailPreviousAuthor } from "@/lib/notify";
import { translateNotes } from "@/lib/translate";
import { toLocale } from "@/lib/i18n";
import { toDocumentKind, versionDate, type DocumentKind, type Mark } from "@/lib/types";
import { toDraftMarks, type DraftMark } from "@/lib/draft-marks";
import { userError } from "@/lib/user-error";
import { versionLabel } from "@/lib/version-label";

// ---------------------------------------------------------------------
// Rozpracovaná verze (draft)
// ---------------------------------------------------------------------
// Vzniká, jakmile je vyplněný modul, země a platný odkaz. Značky se k ní
// ukládají průběžně. V přehledu se neukazuje a notifikace neposílá –
// to obojí se děje až při zveřejnění.

export async function ensureDraftVersion(
  moduleId: string,
  countryId: string,
  driveLink: string,
  kind: DocumentKind = "teaching_material",
  /** Koncept, se kterým právě pracuje tahle záložka prohlížeče. */
  currentDraftId: string | null = null
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
  const druh = toDocumentKind(kind);

  // Každá záložka má svůj koncept – dřív sdílely jeden na uživatele a druhá
  // záložka přepsala první. Koncept téže lekce, země a druhu dokumentu se
  // jen doplní o nový odkaz. Patří-li k jiné lekci, zemi nebo druhu, nepřepíše
  // se a vznikne nový (rámečky do něj pak uloží průběžné ukládání).
  let opusteny: string | null = null;
  if (currentDraftId) {
    const { data: soucasny } = await supabase
      .from("document_versions")
      .select("id, module_id, country_id, kind, status, uploaded_by")
      .eq("id", currentDraftId)
      .maybeSingle();

    const stejny =
      soucasny &&
      soucasny.status === "draft" &&
      soucasny.uploaded_by === user.id &&
      soucasny.module_id === moduleId &&
      soucasny.country_id === countryId &&
      toDocumentKind(soucasny.kind) === druh;

    if (stejny) {
      const { data: updated, error } = await supabase
        .from("document_versions")
        .update({ file_url: fileUrl })
        .eq("id", soucasny.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (error) {
        return { error: await userError(t.saveFailedGeneric, error, "Koncept se nepodařilo upravit:") };
      }
      if (updated) return { draftId: soucasny.id, savedAt: new Date().toISOString() };
      // Mezitím se zveřejnil nebo zmizel – založí se nový.
    } else if (soucasny?.status === "draft" && soucasny.uploaded_by === user.id) {
      opusteny = soucasny.id;
    }
  }

  const { data, error } = await supabase
    .from("document_versions")
    .insert({
      module_id: moduleId,
      country_id: countryId,
      kind: druh,
      file_url: fileUrl,
      status: "draft",
      version_number: null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: await userError(t.saveFailedGeneric, error, "Koncept se nepodařilo založit:") };
  }

  // Koncept, od kterého záložka odešla (jiná lekce, země nebo druh), se
  // uklidí – ale jen když je prázdný. S rámečky zůstává, nic se neztratí.
  if (opusteny) {
    const { count } = await supabase
      .from("annotations")
      .select("id", { count: "exact", head: true })
      .eq("document_version_id", opusteny);
    if (count === 0) {
      await supabase
        .from("document_versions")
        .delete()
        .eq("id", opusteny)
        .eq("status", "draft")
        .eq("uploaded_by", user.id);
    }
  }

  return { draftId: data.id, savedAt: new Date().toISOString() };
}

// Uloží rámečky rozpracované verze. Jen do konceptu – zveřejněnou verzi
// tudy přepsat nejde (hlídá to funkce save_draft_marks v databázi, ve
// stejné transakci a pod stejným zámkem jako zveřejnění).
export async function saveDraftMarks(
  draftId: string,
  marks: Mark[]
): Promise<{ savedAt: string } | { error: string }> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user);

  if (!canUpload(user)) return { error: t.uploadNotAllowed };

  const supabase = await createClient();
  const vysledek = await ulozRamecky(supabase, draftId, toDraftMarks(marks));
  if ("error" in vysledek) {
    return {
      error:
        vysledek.error === "not_editable"
          ? t.draftNotEditable
          : await userError(t.saveFailedGeneric, vysledek.detail, "Koncept se nepodařilo uložit:"),
    };
  }
  return { savedAt: vysledek.savedAt };
}

async function ulozRamecky(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
  marks: DraftMark[]
): Promise<{ savedAt: string } | { error: "not_editable" | "failed"; detail: unknown }> {
  const { data, error } = await supabase.rpc("save_draft_marks", {
    p_draft_id: draftId,
    p_marks: marks,
  });
  if (error) {
    return {
      error: error.message.includes("draft_not_editable") ? "not_editable" : "failed",
      detail: error,
    };
  }
  return { savedAt: typeof data === "string" ? data : new Date().toISOString() };
}

export async function discardDraft(draftId: string): Promise<{ error: string } | null> {
  const user = await requireUser();
  const { t } = await resolveActiveCountry(user);
  if (!canUpload(user)) return { error: t.uploadNotAllowed };

  const supabase = await createClient();
  // Značky zmizí samy, mají v databázi nastavené mazání spolu s verzí.
  const { error } = await supabase
    .from("document_versions")
    .delete()
    .eq("id", draftId)
    .eq("status", "draft");

  return error
    ? { error: await userError(t.saveFailedGeneric, error, "Koncept se nepodařilo zahodit:") }
    : null;
}

// ---------------------------------------------------------------------
// Zveřejnění
// ---------------------------------------------------------------------

export type PublishState =
  | { error: string }
  | {
      // Zveřejnilo se, ale mezitím někdo jiný přidal vlastní verzi.
      warning: {
        /** Označení verzí, např. „10/26 – 2“. */
        otherVersion: string;
        otherAuthor: string;
        otherUploadedAt: string;
        savedVersion: string;
        moduleId: string;
        countryId: string;
      };
    }
  | null;

type PublishResult = {
  version_number: number;
  published_at: string;
  change_id: string;
  recipient_country_ids: string[];
  previous_version: number | null;
  previous_uploaded_at: string | null;
  previous_uploaded_by: string | null;
};

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
    .select("id, module_id, country_id, kind")
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
  const kind = toDocumentKind(draft.kind);

  // Rámečky přicházejí přímo s formulářem: průběžné ukládání mohlo ještě
  // čekat na časovač, a zveřejnit se má přesně to, co editor vidí.
  const odeslaneRamecky = formData.get("marks");
  if (typeof odeslaneRamecky === "string") {
    let ramecky: DraftMark[] = [];
    try {
      ramecky = toDraftMarks(JSON.parse(odeslaneRamecky));
    } catch {
      return { error: t.saveFailedGeneric };
    }
    const ulozeno = await ulozRamecky(supabase, draftId, ramecky);
    if ("error" in ulozeno) {
      return {
        error:
          ulozeno.error === "not_editable"
            ? t.draftNotEditable
            : await userError(t.saveFailedGeneric, ulozeno.detail, "Rámečky před zveřejněním se nepodařilo uložit:"),
      };
    }
  }

  // Číslo verze, přepnutí na zveřejněnou, shrnutí i řádky pro ostatní
  // země vzniknou v databázi najednou (funkce publish_version). Když cokoli
  // selže, nezveřejní se nic a jde to zkusit znovu.
  const { data: vysledek, error: publishError } = await supabase.rpc("publish_version", {
    p_draft_id: draftId,
    p_summary: summary,
  });

  if (publishError || !vysledek) {
    const zprava = publishError?.message ?? "";
    if (zprava.includes("publish_needs_mark")) return { error: t.needMark };
    if (zprava.includes("publish_not_draft")) return { error: t.draftNotEditable };
    return {
      error: await userError(t.saveFailedGeneric, publishError, "Zveřejnění verze se nepodařilo:"),
    };
  }

  const zverejneno = vysledek as PublishResult;
  const published = {
    version_number: zverejneno.version_number,
    uploaded_at: zverejneno.published_at,
  };
  const previous =
    zverejneno.previous_version !== null
      ? {
          version_number: zverejneno.previous_version,
          uploaded_at: zverejneno.previous_uploaded_at ?? "",
          uploaded_by: zverejneno.previous_uploaded_by,
        }
      : null;
  const change = { id: zverejneno.change_id };

  // Označení nové i předchozí verze (např. „10/26 – 2“) a čas zveřejnění
  // předchozí – označení dává databáze při zveřejnění (migrace 0019).
  const { data: oznacene } = await supabase
    .from("document_versions")
    .select("version_number, version_label, published_at, uploaded_at")
    .eq("module_id", moduleId)
    .eq("country_id", countryId)
    .eq("kind", kind)
    .eq("status", "published")
    .in(
      "version_number",
      [published.version_number, previous?.version_number].filter((cislo) => cislo != null)
    );
  const podleCisla = new Map((oznacene ?? []).map((radek) => [radek.version_number, radek]));
  const novaVerze = versionLabel(
    podleCisla.get(published.version_number) ?? { version_number: published.version_number }
  );
  const predchozi = previous ? podleCisla.get(previous.version_number) ?? null : null;
  const predchoziVerze = previous
    ? versionLabel(predchozi ?? { version_number: previous.version_number })
    : "";

  // Zveřejněné rámečky (už s definitivními id) pro překlad a e-maily.
  const { data: marks } = await supabase
    .from("annotations")
    .select("*")
    .eq("document_version_id", draftId);

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

  const { data: zemePrijemcu } = await supabase
    .from("countries")
    .select("id, locale")
    .in("id", zverejneno.recipient_country_ids);
  const prijemci = zemePrijemcu ?? [];

  const [{ data: moduleData }, { data: countryData }] = await Promise.all([
    supabase.from("modules").select("name").eq("id", moduleId).single(),
    supabase.from("countries").select("name, locale").eq("id", countryId).single(),
  ]);

  // Notifikace ve zvonečku vznikají hned – jsou rychlé a nesmí se ztratit.
  const { recipients, previousAuthor } = await createChangeNotifications({
    changeId: change.id,
    recipientCountryIds: zverejneno.recipient_country_ids,
    uploaderId: user.id,
    previousAuthorId: previous?.uploaded_by ?? null,
  });

  // Překlad a e-maily až po odeslání odpovědi: zveřejnění na ně nečeká
  // a jejich pomalost ani výpadek ho neshodí. Co se nepřeloží, dopřeloží
  // později lib/translate-missing.ts.
  const sourceLocale = toLocale(countryData?.locale);
  after(async () => {
    try {
      // Poznámky a shrnutí se přeloží do jazyků zemí, kterým se posílají,
      // a vždy do angličtiny. Originál zůstává, jak byl napsaný.
      await translatePublished({
        marks: marks ?? [],
        changeId: change.id,
        summary: summary || null,
        sourceLocale,
        targetLocales: ["en" as const, ...prijemci.map((country) => toLocale(country.locale))],
      });
    } catch (chyba) {
      console.error("Překlad po zveřejnění se nepodařil:", chyba);
    }

    await Promise.allSettled([
      emailChangeRecipients(recipients, {
        countryName: countryData?.name ?? "",
        moduleName: moduleData?.name ?? "",
        kind,
        versionLabel: novaVerze,
        uploadedAt: published.uploaded_at,
        summary,
        notes: noteList,
      }),
      previousAuthor && previous
        ? emailPreviousAuthor(previousAuthor, {
            moduleName: moduleData?.name ?? "",
            kind,
            theirVersion: predchoziVerze,
            newVersion: novaVerze,
          })
        : Promise.resolve(),
    ]);
  });

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
        otherVersion: predchoziVerze,
        otherAuthor: author?.email ?? "",
        // Ukazuje se čas zveřejnění té verze, ne vzniku jejího konceptu.
        otherUploadedAt: predchozi ? versionDate(predchozi) : previous.uploaded_at,
        savedVersion: novaVerze,
        moduleId,
        countryId,
      },
    };
  }

  redirect(`/modules/${moduleId}?country=${countryId}`);
}

// Překlad poznámek. Zveřejnění kvůli němu nikdy nespadne – když se
// nepovede, uloží se jen příznak a v appce se ukáže originál.
//
// Zapisuje se přes service role: překlad shrnutí patří do tabulky changes,
// do které editor po zveřejnění zapisovat nesmí.
async function translatePublished(params: {
  marks: { id: string; note: string; quote?: string | null }[];
  changeId: string;
  summary: string | null;
  sourceLocale: ReturnType<typeof toLocale>;
  targetLocales: ReturnType<typeof toLocale>[];
}) {
  const { marks, changeId, summary, sourceLocale, targetLocales } = params;
  const supabase = createAdminClient();

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
