// Text, který leží pod vyznačenou značkou v PDF.
//
// Značka je jen obdélník přes stránku, kopie textu se nikam neukládá.
// Ostatní země ale potřebují vědět, co přesně se změnilo, a to v jejich
// jazyce. Proto si při kreslení značky přečteme text pod ní a při
// zveřejnění verze ho necháme přeložit spolu s poznámkou.
//
// U naskenovaných PDF a obrázků v dokumentu žádný text není – pak vrací
// prázdný řetězec a ukáže se jen poznámka.

/** Kousek textu ze stránky, jak ho vrací pdf.js getTextContent(). */
export type PdfTextItem = {
  str: string;
  /** Matice [a, b, c, d, e, f]; e a f je levý konec účaří v bodech PDF. */
  transform: number[];
  width: number;
  height: number;
};

/** Stačí z pdf.js PageViewport – převod bodů PDF na souřadnice stránky. */
export type PdfViewport = {
  width: number;
  height: number;
  convertToViewportPoint: (x: number, y: number) => number[];
};

/** Značka jako podíl 0..1 vůči stránce, levý horní roh je 0,0. */
export type QuoteRect = { x: number; y: number; w: number; h: number };

// Delší citace se do přehledu nevejdou a překlad by zbytečně prodražily.
const MAX_LENGTH = 1500;

export function textInRect(
  items: PdfTextItem[],
  viewport: PdfViewport,
  rect: QuoteRect
): string {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const casti: { top: number; left: number; text: string }[] = [];

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;

    const [, , c, d, e, f] = item.transform;
    // Výška bývá u některých písem nulová; pak ji odhadneme z velikosti písma.
    const vyska = item.height || Math.hypot(c, d);

    const [x1, y1] = viewport.convertToViewportPoint(e, f);
    const [x2, y2] = viewport.convertToViewportPoint(e + item.width, f + vyska);
    const left = Math.min(x1, x2) / viewport.width;
    const sirka = Math.abs(x2 - x1) / viewport.width;
    const top = Math.min(y1, y2) / viewport.height;
    const stred = (y1 + y2) / 2 / viewport.height;

    // Řádek patří do značky, když v ní leží jeho svislý střed.
    if (stred < rect.y || stred > bottom) continue;

    // Vodorovně vezmeme jen tu část řádku, kterou značka překrývá, a
    // dorovnáme ji na celá slova, ať se nepřekládá useknuté slovo.
    const zacatek = sirka > 0 ? (rect.x - left) / sirka : 0;
    const konec = sirka > 0 ? (right - left) / sirka : 1;
    if (konec <= 0 || zacatek >= 1) continue;

    const text = celaSlova(item.str, Math.max(0, zacatek), Math.min(1, konec));
    if (text) casti.push({ top, left, text });
  }

  // Čteme shora dolů a zleva doprava; kousky jednoho řádku leží skoro na
  // stejné výšce, proto ji porovnáváme s malou tolerancí.
  casti.sort((a, b) => (Math.abs(a.top - b.top) > 0.004 ? a.top - b.top : a.left - b.left));

  const vysledek = casti
    .map((cast) => cast.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return vysledek.length > MAX_LENGTH ? `${vysledek.slice(0, MAX_LENGTH).trimEnd()}…` : vysledek;
}

function celaSlova(text: string, od: number, po: number): string {
  if (od <= 0 && po >= 1) return text.trim();

  let start = Math.floor(od * text.length);
  let end = Math.ceil(po * text.length);
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;
  return text.slice(start, end).trim();
}
