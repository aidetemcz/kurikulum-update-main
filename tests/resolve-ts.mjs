const KOREN = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const cesta = specifier.startsWith("@/") ? new URL(specifier.slice(2), KOREN).href : specifier;
  try {
    return await nextResolve(cesta, context);
  } catch (chyba) {
    const relativni = /^(\.|\/|file:)/.test(cesta);
    if (relativni && !/\.[cm]?[jt]s$/.test(cesta)) return nextResolve(`${cesta}.ts`, context);
    throw chyba;
  }
}
