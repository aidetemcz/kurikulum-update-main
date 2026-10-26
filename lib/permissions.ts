import type { AppUser, UserRole } from "@/lib/types";

// Role z databáze převedená na roli appky. Dřívější „viewer“ (a cokoli
// neznámého) se chová jako editor – a protože editor smí zapisovat jen
// za své země, nedostane tím žádná práva navíc.
export function normalizeRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "editor";
}

// Nahrávat a vyřizovat změny smí admin a editor s aspoň jednou zemí.
// Registrace je otevřená, takže nový účet je editor bez země – a ten
// nesmí nic, dokud mu admin zemi nepřiřadí.
export function canUpload(user: AppUser): boolean {
  return user.role === "admin" || user.country_ids.length > 0;
}
