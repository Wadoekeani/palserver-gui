/**
 * paldefender-version.ts 的自我檢查(專案沒有測試框架,用 node 直接跑)。
 *   pnpm --filter @palserver/shared build && node packages/shared/scripts/check-pd-version.mjs
 * 重點在數字比較(1.10 > 1.9)與「版本未知一律放行」這兩條,改動那支檔案後跑一次。
 */
import assert from "node:assert/strict";
import { parsePdVersion, pdSupports, pdVersionAtLeast } from "../dist/paldefender-version.js";

assert.deepEqual(parsePdVersion("v1.9.1-beta"), [1, 9, 1]);
assert.deepEqual(parsePdVersion("1.9"), [1, 9, 0]);
assert.equal(parsePdVersion("nightly"), null);

assert.equal(pdVersionAtLeast("1.9.1", "1.9.0"), true);
assert.equal(pdVersionAtLeast("1.9.0", "1.9.1"), false);
assert.equal(pdVersionAtLeast("1.9.0", "1.9.0"), true);
assert.equal(pdVersionAtLeast("1.8.3", "1.9.0"), false);
assert.equal(pdVersionAtLeast("v1.10.0", "1.9.0"), true, "10 > 9 要用數字比,不是字串比");
assert.equal(pdVersionAtLeast(null, "1.9.0"), true, "版本未知不可擋住功能");
assert.equal(pdVersionAtLeast("", "1.9.0"), true);

assert.equal(pdSupports("1.8.0", "summon"), false);
assert.equal(pdSupports("1.9.0", "summon"), true);
assert.equal(pdSupports("1.9.0", "damageMeter"), false);
assert.equal(pdSupports("1.9.1", "damageMeter"), true);

console.log("paldefender-version: 全部通過");
