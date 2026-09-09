/**
 * PalDefender 版本比較 —— 用來判斷「這個功能這台伺服器的 PD 支不支援」。
 *
 * 版本字串來自模組安裝紀錄(`.palserver-mods.json`)或 RCON `/version`,形如
 * `v1.9.1` / `1.9.1` / `1.9.1-beta`。使用者手動安裝時可能完全沒有版本資訊,
 * 這時一律「放行」—— 偵測不到不該擋住功能,讓伺服器自己回錯誤比較誠實。
 */

/** 各功能需要的最低 PalDefender 版本。 */
export const PD_MIN_VERSION = {
  /** GET /player, /pals, /items, /techs, /progression(含離線玩家)。 */
  playerDetail: "1.8.0",
  /** POST /summon/pal, /summon/npc 與 /spawnnpc。 */
  summon: "1.9.0",
  /** /findbases 廢棄據點佇列。 */
  findBases: "1.9.0",
  /** Config.json 的 PalWebhooks 內建 Discord 推送。 */
  webhooks: "1.9.0",
  /** /spawnpal_ex 傷害排行與 PalSummon 獎勵系統。 */
  damageMeter: "1.9.1",
} as const;

export type PdFeature = keyof typeof PD_MIN_VERSION;

/** "v1.9.1-beta" → [1, 9, 1];解析不出數字就回 null。 */
export function parsePdVersion(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(raw);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

/** 已安裝版本是否 >= min。版本未知(null / 解析不出)時回 true —— 見檔頭。 */
export function pdVersionAtLeast(installed: string | null | undefined, min: string): boolean {
  const a = parsePdVersion(installed);
  const b = parsePdVersion(min);
  if (!a || !b) return true;
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/** 這台伺服器的 PalDefender 支不支援某個功能。 */
export function pdSupports(installed: string | null | undefined, feature: PdFeature): boolean {
  return pdVersionAtLeast(installed, PD_MIN_VERSION[feature]);
}
