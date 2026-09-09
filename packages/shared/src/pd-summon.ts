/**
 * PalDefender 召喚(REST `POST /v1/pdapi/summon/pal` 與 `/summon/npc`,需 1.9.0+)。
 *
 * 欄位對應官方文件的請求主體(ultimeit.github.io/PalDefender/RESTAPI/Endpoints/summon-pal/):
 * 這裡用小寫駝峰,agent 送出前轉成 PalDefender 的 PascalCase。
 */

/** 帕魯與 NPC 召喚共用的部分。 */
interface PdSummonBase {
  /** 世界座標(與 /getpos、地圖描點同一組)。 */
  x: number;
  y: number;
  z: number;
  /** 預設 1;用 PalTemplate 召喚帕魯時會被範本的等級覆蓋。 */
  level?: number;
  /** 禁止捕捉。 */
  uncapturable?: boolean;
  /** 關閉一般 AI(閃避之類的被動行為仍可能發生)。 */
  disableAI?: boolean;
}

export interface PdSummonPalRequest extends PdSummonBase {
  /** 帕魯種族 ID —— 與 template 二擇一。 */
  palId?: string;
  /** Pals/Templates/ 底下的範本檔名(可省略 .json)—— 與 palId 二擇一。 */
  template?: string;
  /** 關閉傷害統計與結算排行。 */
  disableDamageMeter?: boolean;
  /** 最大生命倍率,須大於 0。 */
  healthMultiplier?: number;
}

export interface PdSummonNpcRequest extends PdSummonBase {
  /** NPC ID 或角色 ID(例:PIDF_Soldier_AssaultRifle)。 */
  npcId: string;
}

/** PalDefender 回傳的召喚結果摘要。 */
export interface PdSummonResult {
  type: "Pal" | "NPC";
  /** 帕魯種族 ID / NPC ID;用範本召喚時是範本回報的帕魯。 */
  id: string;
  /** 用了哪個範本(僅範本召喚)。 */
  template?: string;
  level: number;
  uncapturable: boolean;
  disableAI: boolean;
  x: number;
  y: number;
  z: number;
}

export const PD_SUMMON_LIMITS = {
  /** 生命/傷害倍率的 UI 上限 —— PalDefender 本身不設限,這裡只防手滑打錯位數。 */
  maxMultiplier: 1000,
  minLevel: 1,
  maxLevel: 100,
} as const;
