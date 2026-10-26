// Serverová proxy k PDF na Google Drive.
//
// Appka si soubor stáhne na serveru a pošle ho prohlížeči ze své vlastní
// adresy. Díky tomu ho umí vykreslit vlastní renderer (react-pdf), který
// na rozdíl od vloženého okna Googlu dovolí do dokumentu kreslit a určovat
// polohu v něm.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractDriveFileId } from "@/lib/drive";

// ID souboru na Drive – ověřujeme tvar, ať se do dotazu nedostane nic jiného.
const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!FILE_ID.test(id)) {
    return new NextResponse("Neplatné ID souboru", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return new NextResponse("Nepřihlášený uživatel", { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  // Admin a editor potřebují vidět náhled ještě předtím, než verzi uloží,
  // takže jim projde jakékoli ID. Ostatním pošleme soubor jen tehdy, když
  // k němu v databázi existuje verze, kterou smí vidět (o to se starají
  // pravidla Row Level Security). Jinak by se z appky stala otevřená proxy
  // na libovolný soubor na Drive.
  const canPreviewAnything =
    appUser?.role === "admin" || appUser?.role === "editor";

  if (!canPreviewAnything) {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("file_url")
      .like("file_url", `%${id}%`)
      .limit(5);

    const known = (versions ?? []).some(
      (version) => extractDriveFileId(version.file_url) === id
    );

    if (!known) {
      return new NextResponse("Dokument nenalezen", { status: 404 });
    }
  }

  // confirm=t přeskočí mezistránku s potvrzením, kterou Drive ukazuje
  // u větších souborů.
  const driveResponse = await fetch(
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
  );

  const contentType = driveResponse.headers.get("content-type") ?? "";

  // Když soubor není sdílený pro kohokoli s odkazem, Drive místo PDF vrátí
  // HTML stránku s přihlášením.
  if (!driveResponse.ok || !driveResponse.body || contentType.includes("text/html")) {
    console.error(
      `PDF ${id} se nepodařilo stáhnout z Drive: HTTP ${driveResponse.status}, typ ${contentType}`
    );
    return new NextResponse(
      "Soubor se nepodařilo stáhnout z Google Drive. Zkontrolujte, že je sdílený pro kohokoli s odkazem.",
      { status: 502 }
    );
  }

  return new NextResponse(driveResponse.body, {
    headers: {
      "Content-Type": "application/pdf",
      // Prohlížeč si soubor podrží hodinu, ať se nestahuje při každém
      // zobrazení znovu. Záměrně "private": dokumenty jsou dostupné jen
      // lidem z dané země, takže je nesmí ukládat sdílená mezipaměť.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
