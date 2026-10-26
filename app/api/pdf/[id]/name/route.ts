// Název souboru na Google Drive. Používá se při nahrávání k rozpoznání,
// o kterou metodiku jde – samotný název bývá výmluvnější než text uvnitř.
//
// Soubor se nestahuje celý: Drive pošle název v hlavičce Content-Disposition
// a tělo odpovědi rovnou zahodíme.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fileNameFromDisposition } from "@/lib/drive";

const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!FILE_ID.test(id)) {
    return NextResponse.json({ name: null }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ name: null }, { status: 401 });
  }

  const [{ data: appUser }, { data: myCountries }] = await Promise.all([
    supabase.from("users").select("role").eq("id", authUser.id).single(),
    supabase.from("user_countries").select("country_id").eq("user_id", authUser.id).limit(1),
  ]);

  // Rozpoznávání běží jen na obrazovce nahrávání, kam se ostatní nedostanou.
  // Účet bez země (čerstvá registrace) nahrávat nesmí.
  if (appUser?.role !== "admin" && (myCountries ?? []).length === 0) {
    return NextResponse.json({ name: null }, { status: 403 });
  }

  const driveResponse = await fetch(
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    { headers: { Range: "bytes=0-0" } }
  );

  // Tělo nepotřebujeme, jen hlavičku s názvem.
  await driveResponse.body?.cancel();

  const name = fileNameFromDisposition(driveResponse.headers.get("content-disposition"));
  return NextResponse.json(
    { name },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
