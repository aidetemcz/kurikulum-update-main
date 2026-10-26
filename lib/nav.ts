// Která položka levého menu patří k právě otevřené stránce. Pod-stránky
// se počítají k nadřazené položce (detail lekce k Metodikám apod.).
export function isNavActive(href: string, pathname: string): boolean {
  const cesta = pathname.replace(/\/+$/, "") || "/";
  const pod = (zaklad: string) => cesta === zaklad || cesta.startsWith(`${zaklad}/`);

  switch (href) {
    case "/":
      return cesta === "/" || pod("/changes");
    case "/admin":
      // Administrace jen přesně – Nahrát a Zprávy mají vlastní položky.
      return cesta === "/admin";
    default:
      return pod(href);
  }
}
