// Spouštění testů v čistém Node (node --test) bez dalších balíčků:
// Node sám umí odstranit typy z .ts souborů, tady se jen doplní to, co
// umí Next.js a Node ne – zkratka „@/…“ a importy bez přípony .ts.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
