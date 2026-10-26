// Zvýraznění aktivní položky v levém menu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNavActive } from "@/lib/nav";

const PRIPADY: [string, string, boolean][] = [
  ["/", "/", true],
  ["/", "/changes/abc", true],
  ["/", "/modules", false],
  ["/modules", "/modules", true],
  ["/modules", "/modules/123", true],
  ["/modules", "/", false],
  ["/admin/upload", "/admin/upload", true],
  ["/admin", "/admin/upload", false],
  ["/admin", "/admin", true],
  ["/admin", "/admin/messages", false],
  ["/admin/messages", "/admin/messages/xyz", true],
  ["/help", "/help", true],
];

for (const [href, pathname, ocekavano] of PRIPADY) {
  test(`${href} na ${pathname} → ${ocekavano ? "aktivní" : "neaktivní"}`, () => {
    assert.equal(isNavActive(href, pathname), ocekavano);
  });
}
