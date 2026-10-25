import Image from "next/image";

// Logo AI for children. Samotná značka je korálové kolečko, takže patří vždy
// na bílý podklad – na barevné ploše by ztratila kontrast.
export function Logo({
  size = 32,
  showName = true,
}: {
  /** Výška i šířka loga v pixelech. Obrázek je čtvercový. */
  size?: number;
  showName?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo-aidetem.png"
        alt="AI for children"
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {showName && (
        <span className="font-heading text-xl font-bold tracking-tight text-ink">
          AI kurikulum
        </span>
      )}
    </div>
  );
}
