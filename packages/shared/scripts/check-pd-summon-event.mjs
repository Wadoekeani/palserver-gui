/**
 * pd-summon-event.ts 驗證器的自我檢查(專案沒有測試框架,用 node 直接跑)。
 *   pnpm --filter @palserver/shared build && node packages/shared/scripts/check-pd-summon-event.mjs
 * 重點:①每項獎勵只能是一種類型;②Weight/Chance/Unique 只在該模式有效時才不發警告;
 * ③官方文件的範例必須零錯誤(這條是防止我們比 PalDefender 還嚴格)。
 */
import assert from "node:assert/strict";
import {
  pdEntryKind,
  pdAmountValid,
  pdChanceValue,
  validatePdSummonEncounter,
} from "../dist/pd-summon-event.js";

const errs = (enc) => validatePdSummonEncounter(enc).filter((i) => i.level === "error");
const warns = (enc) => validatePdSummonEncounter(enc).filter((i) => i.level === "warn");

// 型別判斷
assert.equal(pdEntryKind({ ItemID: "Money" }), "item");
assert.equal(pdEntryKind({ EggID: "PalEgg_Dark_05", PalTemplate: "R.json" }), "egg");
assert.equal(pdEntryKind({ EXP: 100 }), "exp");
assert.equal(pdEntryKind({}), null, "沒指定類型 = 不合法");
assert.equal(pdEntryKind({ ItemID: "Money", EXP: 100 }), null, "混兩種 = 不合法");

// 數量
assert.equal(pdAmountValid(undefined), true);
assert.equal(pdAmountValid(1), true);
assert.equal(pdAmountValid(0), false, "至少 1");
assert.equal(pdAmountValid(1.5), false, "必須整數");
assert.equal(pdAmountValid({ Min: 1, Max: 3 }), true);
assert.equal(pdAmountValid({ Min: 3, Max: 1 }), false, "Max 不得小於 Min");
assert.equal(pdAmountValid("1-3"), false, "文字區間不合法");

// 基本設定
assert.equal(errs({ PalTemplate: "Boss.json", X: 1, Y: 2, Z: 3 }).length, 0);
assert.ok(errs({ PalTemplate: "", X: 1, Y: 2, Z: 3 }).length > 0, "PalTemplate 必填");
assert.ok(errs({ PalTemplate: "B", X: NaN, Y: 2, Z: 3 }).length > 0, "座標必須是數字");
assert.ok(errs({ PalTemplate: "B", X: 1, Y: 2, Z: 3, HealthMultiplier: 0 }).length > 0, "倍率必須 > 0");
assert.ok(
  errs({ PalTemplate: "B", X: 1, Y: 2, Z: 3, CapturableAtHealthPercent: 120 }).length > 0,
  "百分比上限 100",
);
assert.ok(
  warns({ PalTemplate: "B", X: 1, Y: 2, Z: 3, Uncapturable: true, CapturableAtHealthPercent: 15 }).length > 0,
  "禁捕時可捕捉百分比不生效,要發警告",
);

const base = { PalTemplate: "Boss.json", X: 1, Y: 2, Z: 3 };
const withRewards = (rewards) => ({ ...base, Rewards: rewards });

// 名次鍵
assert.ok(errs(withRewards({ 0: { EXP: 1 } })).length > 0, "名次 0 不合法");
assert.ok(errs(withRewards({ abc: { EXP: 1 } })).length > 0, "任意名稱不合法");
assert.equal(errs(withRewards({ 1: { EXP: 1 }, Default: { EXP: 1 } })).length, 0);
assert.equal(errs(withRewards({ default: { EXP: 1 } })).length, 0, "Default 大小寫不敏感");

// 直接掉落:Weight / Unique 無效要警告,Chance 有效不警告
assert.equal(warns(withRewards({ 1: { Drops: [{ ItemID: "Money", Chance: 30 }] } })).length, 0);
assert.ok(warns(withRewards({ 1: { Drops: [{ ItemID: "Money", Weight: 2 }] } })).length > 0);
assert.ok(warns(withRewards({ 1: { Drops: [{ ItemID: "Money", Unique: true }] } })).length > 0);

// 池子:OneOf 用 Weight 沒事、用 entry Chance 要警告
const pool = (p) => withRewards({ 1: { Pools: [p] } });
assert.equal(warns(pool({ Mode: "OneOf", Entries: [{ ItemID: "A", Weight: 7 }] })).length, 0);
assert.ok(warns(pool({ Mode: "OneOf", Entries: [{ ItemID: "A", Chance: 50 }] })).length > 0);
// Independent 反過來
assert.equal(warns(pool({ Mode: "Independent", Entries: [{ ItemID: "A", Chance: 50 }] })).length, 0);
assert.ok(warns(pool({ Mode: "Independent", Entries: [{ ItemID: "A", Weight: 3 }] })).length > 0);
// Pick 才看 Rolls / Unique
assert.equal(warns(pool({ Mode: "Pick", Rolls: 2, Unique: true, Entries: [{ ItemID: "A" }] })).length, 0);
assert.ok(warns(pool({ Mode: "All", Rolls: 2, Entries: [{ ItemID: "A" }] })).length > 0);
// 空池與不存在的模式
assert.ok(errs(pool({ Mode: "OneOf", Entries: [] })).length > 0, "空池要報錯");
assert.ok(errs(pool({ Mode: "Nope", Entries: [{ ItemID: "A" }] })).length > 0, "模式不存在要報錯");
// 蛋要有 PalTemplate
assert.ok(errs(pool({ Entries: [{ EggID: "PalEgg_Dark_05" }] })).length > 0);

// 機率可以是帶 % 的文字(官方接受),讀既有檔案時不可誤報
assert.equal(pdChanceValue(30), 30);
assert.equal(pdChanceValue("30%"), 30);
assert.equal(pdChanceValue("30.5"), 30.5);
assert.equal(pdChanceValue("abc"), null);
assert.equal(pdChanceValue(101), null);
assert.equal(errs(withRewards({ 1: { Drops: [{ ItemID: "Money", Chance: "50%" }] } })).length, 0);
assert.equal(errs(pool({ Mode: "OneOf", Chance: "35%", Entries: [{ ItemID: "A" }] })).length, 0);

// 官方文件的完整範例(FileTypes/PalSummon):必須零錯誤
const official = {
  ...base,
  Rewards: {
    1: { Drops: [{ ItemID: "Money", Count: 50000 }, { TechnologyPoints: 5 }] },
    2: { Drops: [{ EXP: { Min: 10000, Max: 20000 } }] },
    Default: { Drops: [{ ItemID: "Money", Count: 1000, Chance: 75 }] },
    3: {
      EXP: { Min: 10000, Max: 20000 },
      TechnologyPoints: 2,
      AncientTechnologyPoints: 1,
      Drops: [{ ItemID: "Money", Count: 5000 }],
      Pools: [
        {
          Name: "Equipment jackpot",
          Mode: "OneOf",
          Chance: 35,
          Entries: [
            { ItemID: "AncientArmor", Weight: 7 },
            { ItemID: "AncientHelmet", Weight: 7 },
            { ItemID: "SkyAssaultRifle", Weight: 5 },
            { EggID: "PalEgg_Dark_05", PalTemplate: "RaidReward.json", Weight: 1 },
          ],
        },
      ],
    },
  },
};
assert.deepEqual(errs(official), [], "官方範例不該有錯誤");

console.log("pd-summon-event: 全部通過");
