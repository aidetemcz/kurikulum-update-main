import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // od téhle šířky stojí levé menu jako sloupec vedle obsahu;
        // pod ní se schová pod ikonu a obsah dostane celou šířku
        nav: "900px",
        // od téhle šířky se detail verze dělí na dokument a boční panel.
        // Počítáno včetně levého menu: 1060 − 256 (menu) − 64 (okraje)
        // = 740 px na obsah, tedy 340 px panel a ~376 px dokument.
        doc: "1060px",
        // od téhle šířky se vedle dokumentu vejde i formulář (obrazovka
        // nahrávání): 1380 − 256 − 64 = 1060 px na tři sloupce.
        // Níž se formulář přesune nad dokument, aby nezbyl proužek.
        wide: "1380px",
      },
      colors: {
        // barvy podle vizuálního stylu AI for children
        coral: "#DC5B5B", // primární akcentová barva
        mist: "#B3CDD6", // sekundární
        haze: "#DAE7EC", // světlé pozadí / karty
        ink: "#070707", // tmavý text
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Darker Grotesque", "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
