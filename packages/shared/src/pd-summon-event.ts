/**
 * PalSummon.json —— PalDefender 的「頭目活動」定義檔(1.9.0 大改版後的形狀)。
 * 檔案放在 `Pal/Binaries/Win64/PalDefender/Pals/Summons/`,用 RCON `summon <檔名>` 啟動。
 * 規格來源:ultimeit.github.io/PalDefender/FileTypes/PalSummon/(2026-09-10 查)。
 *
 * 型別刻意沿用 PalDefender 的 PascalCase 欄位名 —— 編輯器直接讀寫原檔,不做鍵名轉換,
 * 少一層轉換就少一種「存回去欄位就不見了」的失敗方式。PalDefender 接受的別名
 * (ItemId / Amount / Exp / TechPoints…)這裡不產生,但讀取既有檔案時會保留(見 unknown 欄位)。
 */

export const PD_POOL_MODES = ["OneOf", "Pick", "All", "Independent"] as const;
export type PdPoolMode = (typeof PD_POOL_MODES)[number];

/** 各抽獎模式實際會用到哪些欄位 —— 其餘欄位 PalDefender 會忽略並發警告。 */
export const PD_POOL_MODE_FIELDS: Record<
  PdPoolMode,
  { weight: boolean; entryChance: boolean; rolls: boolean; unique: boolean; label: string; hint: string }
> = {
  OneOf: {
    weight: true, entryChance: false, rolls: false, unique: false,
    label: "抽一個(OneOf)", hint: "池子的機率通過後,依權重抽出恰好一項。",
  },
  Pick: {
    weight: true, entryChance: false, rolls: true, unique: true,
    label: "抽 N 個(Pick)", hint: "依權重抽 Rolls 次;Unique 開啟時抽過的不再重複。",
  },
  All: {
    weight: false, entryChance: false, rolls: false, unique: false,
    label: "全部給(All)", hint: "池子的機率通過後,每一項都給一次。",
  },
  Independent: {
    weight: false, entryChance: true, rolls: false, unique: false,
    label: "各自擲骰(Independent)", hint: "每一項用自己的機率獨立判定,可能全中或全不中。",
  },
};

export interface PdAmountRange {
  Min: number;
  Max: number;
}
/** 數量:固定整數或 Min/Max 區間(文字區間如 "1-3" 不合法)。 */
export type PdAmount = number | PdAmountRange;

/**
 * 一項獎勵。**必須恰好指定一種獎勵型別**:道具(ItemID)、帕魯蛋(EggID + PalTemplate)、
 * 經驗(EXP)、科技點(TechnologyPoints)、古代科技點(AncientTechnologyPoints)。
 */
export interface PdRewardEntry {
  ItemID?: string;
  EggID?: string;
  /** 帕魯蛋必填:決定蛋裡的帕魯(Pals/Templates/ 底下的範本)。 */
  PalTemplate?: string;
  Count?: PdAmount;
  /** 蛋的等級;0 = 沿用範本等級。 */
  Level?: number;
  EXP?: PdAmount;
  TechnologyPoints?: PdAmount;
  AncientTechnologyPoints?: PdAmount;
  /** 0–100;只在直接掉落與 Independent 池有效。PalDefender 也接受 "30%" 這種文字。 */
  Chance?: number | string;
  /** ≥1 的整數;只在 OneOf 與 Pick 池有效。 */
  Weight?: number;
  /** 只在 Pick 池有效(覆蓋池子的 Unique)。 */
  Unique?: boolean;
}

export interface PdLootPool {
  /** 只是給人看的標籤,不影響抽獎。 */
  Name?: string;
  /** 預設 OneOf。 */
  Mode?: PdPoolMode;
  /** 整池啟動的機率,預設 100。也接受 "30%" 這種文字。 */
  Chance?: number | string;
  /** Pick 模式抽幾次,預設 1。 */
  Rolls?: number;
  /** Pick 模式是否不重複,預設 true。 */
  Unique?: boolean;
  Entries: PdRewardEntry[];
}

/** 一個名次(或 Default)的獎勵內容:保證捷徑 + 直接掉落 + 抽獎池,三者相加。 */
export interface PdRewardDefinition {
  EXP?: PdAmount;
  TechnologyPoints?: PdAmount;
  AncientTechnologyPoints?: PdAmount;
  /** 每項各自獨立判定(Weight / Unique 在這裡無效)。 */
  Drops?: PdRewardEntry[];
  Pools?: PdLootPool[];
}

/** Rewards 的鍵:名次("1"、"2"…)或 "Default"(找不到對應名次時用)。 */
export const PD_REWARD_DEFAULT_KEY = "Default";

export interface PdSummonEncounter {
  /** Pals/Templates/ 底下的範本檔名(可省略 .json)。必填。 */
  PalTemplate: string;
  /** 公告、日誌、webhook 與傷害排行顯示的名稱;省略時用帕魯 ID。 */
  BossBattleName?: string;
  Uncapturable?: boolean;
  /** 血量低於這個百分比才能捕捉(0–100,預設 15);Uncapturable 為 true 時無效。 */
  CapturableAtHealthPercent?: number;
  DisableAI?: boolean;
  /** 關掉傷害統計、結算對話框與名次獎勵 —— 這時 Default 獎勵改為發給所有在線玩家。 */
  DisableDamageMeter?: boolean;
  SpawnScale?: number;
  HealthMultiplier?: number;
  DamageTakenMultiplier?: number;
  DamageDealtMultiplier?: number;
  X: number;
  Y: number;
  Z: number;
  DisableStatuses?: string[];
  Rewards?: Record<string, PdRewardDefinition>;
}

/** 建立新活動用的預設值(對齊官方預設,只留必填與最常改的幾項)。 */
export function emptyPdSummonEncounter(): PdSummonEncounter {
  return { PalTemplate: "", X: 0, Y: 0, Z: 0, CapturableAtHealthPercent: 15 };
}

export type PdEntryKind = "item" | "egg" | "exp" | "tech" | "ancientTech";

/** 這項獎勵是哪一種;同時指定多種(或都沒指定)時回 null —— 那是不合法的。 */
export function pdEntryKind(e: PdRewardEntry): PdEntryKind | null {
  const kinds: PdEntryKind[] = [];
  if (e.ItemID !== undefined) kinds.push("item");
  if (e.EggID !== undefined) kinds.push("egg");
  if (e.EXP !== undefined) kinds.push("exp");
  if (e.TechnologyPoints !== undefined) kinds.push("tech");
  if (e.AncientTechnologyPoints !== undefined) kinds.push("ancientTech");
  return kinds.length === 1 ? kinds[0] : null;
}

/**
 * 機率欄位 → 數字。PalDefender 接受數字或帶 % 的文字("30%"、"30.5"),
 * 所以讀既有檔案時不能直接當數字用。解析不出來或超出 0–100 回 null。
 */
export function pdChanceValue(v: number | string | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/%$/, ""));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

const isRange = (v: unknown): v is PdAmountRange =>
  !!v && typeof v === "object" && "Min" in (v as object) && "Max" in (v as object);

/** 數量欄位是否合法(整數 ≥ 1,或 Min ≤ Max 的整數區間)。 */
export function pdAmountValid(v: PdAmount | undefined): boolean {
  if (v === undefined) return true;
  if (typeof v === "number") return Number.isInteger(v) && v >= 1;
  if (isRange(v)) {
    const { Min, Max } = v;
    return Number.isInteger(Min) && Number.isInteger(Max) && Min >= 1 && Max >= Min;
  }
  return false;
}

/**
 * 檢查一份活動定義,回傳問題清單(繁中,前端直接顯示)。
 * `level: "error"` = PalDefender 會拒絕或行為明顯不是使用者要的;
 * `level: "warn"` = 檔案能讀,但那個欄位在這個位置**不會生效**(PalDefender 只發警告)。
 */
export interface PdSummonIssue {
  level: "error" | "warn";
  /** 給人看的位置,例如「名次 1 · 抽獎池 2 · 第 3 項」。 */
  where: string;
  message: string;
}

export function validatePdSummonEncounter(enc: PdSummonEncounter): PdSummonIssue[] {
  const issues: PdSummonIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warn", where, message });
  const basics = "基本設定";

  if (!enc.PalTemplate?.trim()) err(basics, "PalTemplate 必填 —— 指定 Pals/Templates/ 底下的範本檔名。");
  for (const axis of ["X", "Y", "Z"] as const) {
    if (!Number.isFinite(enc[axis])) err(basics, `座標 ${axis} 必須是數字。`);
  }
  if (enc.CapturableAtHealthPercent !== undefined) {
    const p = enc.CapturableAtHealthPercent;
    if (!Number.isFinite(p) || p < 0 || p > 100) err(basics, "可捕捉血量百分比必須在 0 到 100 之間。");
    else if (enc.Uncapturable) warn(basics, "已設為禁止捕捉,可捕捉血量百分比不會生效。");
  }
  for (const key of ["SpawnScale", "HealthMultiplier", "DamageTakenMultiplier", "DamageDealtMultiplier"] as const) {
    const v = enc[key];
    if (v !== undefined && (!Number.isFinite(v) || v <= 0)) err(basics, `${key} 必須大於 0。`);
  }

  const checkEntry = (e: PdRewardEntry, where: string, ctx: { weight: boolean; chance: boolean; unique: boolean }) => {
    const kind = pdEntryKind(e);
    if (kind === null) {
      err(where, "每一項獎勵只能是一種類型(道具 / 帕魯蛋 / 經驗 / 科技點 / 古代科技點)。");
      return;
    }
    if (kind === "egg" && !e.PalTemplate?.trim()) err(where, "帕魯蛋必須指定 PalTemplate,否則不知道要孵出什麼。");
    if (!pdAmountValid(e.Count)) err(where, "數量必須是 ≥ 1 的整數,或 Min ≤ Max 的整數區間。");
    for (const key of ["EXP", "TechnologyPoints", "AncientTechnologyPoints"] as const) {
      if (!pdAmountValid(e[key])) err(where, `${key} 必須是 ≥ 1 的整數,或 Min ≤ Max 的整數區間。`);
    }
    if (e.Level !== undefined && (!Number.isInteger(e.Level) || e.Level < 0)) {
      err(where, "蛋的等級必須是 ≥ 0 的整數(0 = 沿用範本等級)。");
    }
    if (e.Chance !== undefined) {
      if (pdChanceValue(e.Chance) === null) err(where, "機率必須在 0 到 100 之間(可寫 30 或 \"30%\")。");
      else if (!ctx.chance) warn(where, "這個位置的機率不會生效(直接掉落與「各自擲骰」池才有用)。");
    }
    if (e.Weight !== undefined) {
      if (!Number.isInteger(e.Weight) || e.Weight < 1) err(where, "權重必須是 ≥ 1 的整數(不要用 0,直接移除該項)。");
      else if (!ctx.weight) warn(where, "這個位置的權重不會生效(只有 OneOf 與 Pick 池會用)。");
    }
    if (e.Unique !== undefined && !ctx.unique) warn(where, "這個位置的 Unique 不會生效(只有 Pick 池會用)。");
  };

  for (const [rank, def] of Object.entries(enc.Rewards ?? {})) {
    const isDefault = rank.toLowerCase() === PD_REWARD_DEFAULT_KEY.toLowerCase();
    const where = isDefault ? "預設獎勵" : `名次 ${rank}`;
    if (!isDefault && !/^[1-9]\d*$/.test(rank)) {
      err(where, "名次必須是正整數(1、2、10…)或 Default。");
    }
    for (const key of ["EXP", "TechnologyPoints", "AncientTechnologyPoints"] as const) {
      if (!pdAmountValid(def[key])) err(where, `${key} 必須是 ≥ 1 的整數,或 Min ≤ Max 的整數區間。`);
    }
    (def.Drops ?? []).forEach((e, i) =>
      checkEntry(e, `${where} · 直接掉落第 ${i + 1} 項`, { weight: false, chance: true, unique: false }),
    );
    (def.Pools ?? []).forEach((pool, pi) => {
      const pwhere = `${where} · 抽獎池 ${pi + 1}${pool.Name ? `(${pool.Name})` : ""}`;
      const mode = pool.Mode ?? "OneOf";
      const spec = PD_POOL_MODE_FIELDS[mode];
      if (!spec) {
        err(pwhere, `抽獎模式「${String(mode)}」不存在(可用:${PD_POOL_MODES.join(" / ")})。`);
        return;
      }
      if (!pool.Entries?.length) err(pwhere, "抽獎池至少要有一項獎勵。");
      if (pool.Chance !== undefined && pdChanceValue(pool.Chance) === null) {
        err(pwhere, "整池啟動機率必須在 0 到 100 之間(可寫 35 或 \"35%\")。");
      }
      if (pool.Rolls !== undefined) {
        if (!Number.isInteger(pool.Rolls) || pool.Rolls < 1) err(pwhere, "抽獎次數必須是 ≥ 1 的整數。");
        else if (!spec.rolls) warn(pwhere, "這個模式不看抽獎次數(只有 Pick 會用)。");
      }
      if (pool.Unique !== undefined && !spec.unique) warn(pwhere, "這個模式不看 Unique(只有 Pick 會用)。");
      (pool.Entries ?? []).forEach((e, i) =>
        checkEntry(e, `${pwhere} · 第 ${i + 1} 項`, {
          weight: spec.weight,
          chance: spec.entryChance,
          unique: spec.unique,
        }),
      );
    });
  }
  return issues;
}
