"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import type { Dictionary } from "@/lib/i18n";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Vykreslování běží ve vlastním vlákně prohlížeče, aby stránka neztuhla.
// Soubor s vláknem se do /public kopíruje při instalaci (viz postinstall
// v package.json), takže jeho verze vždy sedí s verzí knihovny a appka
// nezávisí na cizí síti.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// PDF vykreslené přímo v appce: všechny stránky pod sebou, bílé listy
// s jemným stínem, žádná lišta čtečky ani rámeček.
export function PdfViewer({
  src,
  driveUrl,
  t,
  renderPageOverlay,
  onFirstPageText,
  onDocumentLoad,
}: {
  src: string;
  /** Odkaz na soubor v Drive pro případ, že se vykreslení nepovede. */
  driveUrl: string;
  t: Dictionary;
  /** Vrstva kreslená přes stránku – používá se pro značkování změn. */
  renderPageOverlay?: (pageIndex: number) => ReactNode;
  /** Text první strany. Podle něj se pozná, o kterou metodiku jde. */
  onFirstPageText?: (text: string) => void;
  /** Načtený dokument – značkování si z něj čte text pod značkami. */
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  // Stránky vykreslujeme v šířce kontejneru, ať kolem nezůstává prázdné místo.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={src}
        onLoadSuccess={async (pdf) => {
          setPageCount(pdf.numPages);
          onDocumentLoad?.(pdf);
          if (!onFirstPageText || pdf.numPages === 0) return;

          // Rozpoznávání metodiky je jen pomůcka, kvůli němu nemá smysl
          // hlásit chybu – když se text vytáhnout nedá, prostě se nepoužije.
          try {
            const page = await pdf.getPage(1);
            const content = await page.getTextContent();
            onFirstPageText(
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ")
            );
          } catch {
            onFirstPageText("");
          }
        }}
        loading={<PdfSkeleton text={t.loadingPdf} />}
        error={<PdfError t={t} driveUrl={driveUrl} />}
        noData={<PdfSkeleton text={t.loadingPdf} />}
      >
        {width > 0 &&
          Array.from({ length: pageCount }, (_, index) => (
            <div
              key={index}
              id={`pdf-page-${index}`}
              className="relative mb-3 w-fit last:mb-0"
            >
              <Page
                pageNumber={index + 1}
                width={width}
                renderAnnotationLayer={false}
                className="bg-white shadow-sm"
              />
              {renderPageOverlay?.(index)}
            </div>
          ))}
      </Document>
    </div>
  );
}

// Během načítání držíme místo v poměru stránky A4, ať obsah pod dokumentem
// neposkakuje.
function PdfSkeleton({ text }: { text: string }) {
  return (
    <div className="flex w-full animate-pulse items-center justify-center bg-haze/40 aspect-[1/1.414]">
      <p className="text-sm text-ink/50">{text}</p>
    </div>
  );
}

function PdfError({ t, driveUrl }: { t: Dictionary; driveUrl: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 bg-haze/40 py-12">
      <p className="text-sm text-ink/60">{t.pdfLoadFailed}</p>
      <a
        href={driveUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-coral hover:underline"
      >
        {t.openInDrive}
      </a>
    </div>
  );
}
