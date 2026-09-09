/**
 * PalDefender Config.json options the GUI manages.
 * Keys and semantics from the official docs
 * (ultimeit.github.io/PalDefender/FileTypes/Config.md).
 *
 * Scalar settings (bool / int / float / string) are exposed here — the array
 * settings (MOTD, bannedChatWords, bannedTechnologies, adminIPs, BannedCampWorker)
 * are left to the raw JSON editor for now. Writes merge, so any key we don't
 * list is preserved untouched (PalDefender adds keys per version).
 *
 * `group` marks a setting that lives in a nested object rather than at the top
 * level (PalDefender 1.9 put the Discord webhook URLs under `PalWebhooks`).
 */

export type PdOptionCategory =
  | "anticheat"
  | "protection"
  | "admin"
  | "chat"
  | "announce"
  | "logging"
  | "webhook"
  | "misc";

/** 巢狀設定的父物件鍵 —— PalDefender 1.9 起把 webhook URL 收在 `PalWebhooks` 物件裡。 */
export type PdOptionGroup = "PalWebhooks";

interface PdOptionBase {
  category: PdOptionCategory;
  label: string;
  hint?: string;
  warn?: string;
  /** 設定住在 Config.json 的這個子物件裡,而非頂層。 */
  group?: PdOptionGroup;
}

export type PdOptionMeta =
  | ({ type: "bool"; default: boolean } & PdOptionBase)
  | ({ type: "int"; default: number; min: number; max: number } & PdOptionBase)
  | ({ type: "float"; default: number; min: number; max: number; step: number } & PdOptionBase)
  | ({ type: "string"; default: string; placeholder?: string; /** 輸入框預設遮蔽(webhook URL 等) */ secret?: boolean } & PdOptionBase);

export const PALDEFENDER_OPTIONS = {
  // ── 反外掛處置 ──
  shouldWarnCheaters: { type: "bool", default: true, category: "anticheat", label: "警告作弊者", hint: "偵測到作弊時傳送警告訊息給該玩家。" },
  shouldWarnCheatersReason: { type: "bool", default: true, category: "anticheat", label: "警告時附上原因" },
  shouldKickCheaters: { type: "bool", default: false, category: "anticheat", label: "自動踢出作弊者" },
  shouldBanCheaters: { type: "bool", default: false, category: "anticheat", label: "自動封鎖作弊者" },
  shouldIPBanCheaters: { type: "bool", default: false, category: "anticheat", label: "自動 IP 封鎖作弊者", warn: "IP 封鎖可能誤傷同一 IP 下的其他玩家。" },
  damageCheatDetectionEnabled: { type: "bool", default: true, category: "anticheat", label: "傷害作弊偵測", hint: "比對用戶端回報的傷害與伺服器重建的傷害,差距過大即記錄。" },
  damageCheatDetectionTolerancePercent: { type: "float", default: 5, min: 0, max: 100, step: 0.5, category: "anticheat", label: "傷害偵測容許誤差(%)", hint: "誤判太多時調高這個值,不必整個關掉偵測。 需 PalDefender 1.9.1 以上。" },
  damageCheatDetectionWeaponBasePowerMultiplier: { type: "float", default: 1.5, min: 1, max: 10, step: 0.1, category: "anticheat", label: "武器基礎威力上限倍率", hint: "重建傷害時允許的武器威力上限倍率。 需 PalDefender 1.9.1 以上。" },
  staminaCheatDetectionEnabled: { type: "bool", default: true, category: "anticheat", label: "體力作弊偵測", hint: "偵測與體力消耗有關的異常動作,寫入日誌供管理員檢視。 需 PalDefender 1.9.0 以上。" },
  ammoCheatDetectionEnabled: { type: "bool", default: true, category: "anticheat", label: "彈藥/武器作弊偵測", hint: "偵測異常的武器與彈藥狀態。 需 PalDefender 1.9.0 以上。" },

  // ── 漏洞防護 ──
  steamidProtection: { type: "bool", default: true, category: "protection", label: "防止重複 UserId 登入" },
  disableIllegalItemProtection: { type: "bool", default: false, category: "protection", label: "停用非法道具防護", warn: "關閉後模組/除錯道具將不再被攔截,一般不建議停用。" },
  doActionUponIllegalPalStats: { type: "bool", default: true, category: "protection", label: "自動處理異常帕魯數值" },
  palStatsMaxRank: { type: "int", default: -1, min: -1, max: 20, category: "protection", label: "帕魯強化上限", hint: "-1 = 自動偵測。" },
  pvpMaxToBuildingDamage: { type: "int", default: 0, min: 0, max: 100000, category: "protection", label: "PvP 對建築最大傷害(0 = 不限)" },
  pvpMaxToPalDamage: { type: "int", default: 0, min: 0, max: 100000, category: "protection", label: "PvP 對帕魯最大傷害(0 = 不限)" },
  pveMaxToPalBanThreshold: { type: "int", default: 0, min: 0, max: 1000000, category: "protection", label: "PvE 帕魯傷害封鎖閥值(0 = 關閉)" },
  treeLimiter: { type: "float", default: 0, min: 0, max: 5, step: 0.05, category: "protection", label: "砍樹速率限制(秒/棵)", hint: "限制每棵樹的最短破壞時間,避免火箭快速砍樹造成大量卡頓。0 = 關閉。" },
  antiVacuumEnabled: { type: "bool", default: true, category: "protection", label: "遠端吸物防護(Anti-Vacuum)", hint: "阻擋距離過遠的撿取請求(外掛「吸物」)。管理員在允許作弊時可略過。 需 PalDefender 1.9.0 以上。" },
  antiVacuumMaxPickupDistance: { type: "float", default: 800, min: 100, max: 100000, step: 50, category: "protection", label: "允許的最大撿取距離", hint: "單位為遊戲內距離,官方預設 800。" },
  antiVacuumBlockAutoPickup: { type: "bool", default: true, category: "protection", label: "反吸物:一般自動撿取" },
  antiVacuumBlockEggPickup: { type: "bool", default: true, category: "protection", label: "反吸物:帕魯蛋" },
  antiVacuumBlockRelicObtain: { type: "bool", default: true, category: "protection", label: "反吸物:遺物" },
  antiVacuumBlockNoteObtain: { type: "bool", default: true, category: "protection", label: "反吸物:筆記" },
  antiVacuumShowBlockMessage: { type: "bool", default: true, category: "protection", label: "反吸物:向玩家顯示攔截訊息" },
  antiVacuumBlockMessage: { type: "string", default: "", category: "protection", label: "反吸物攔截訊息", placeholder: "留空 = 使用 PalDefender 預設訊息", hint: "被攔截時顯示給玩家的文字。" },
  baseCampDupeDetectionEnabled: { type: "bool", default: true, category: "protection", label: "據點複製(dupe)偵測" },
  preventUnsupportedWorkbenchRecipes: { type: "bool", default: true, category: "protection", label: "阻擋工作台不支援的配方" },
  droppedPalPickupRange: { type: "int", default: 99999, min: 0, max: 999999, category: "protection", label: "掉落帕魯的最大撿取距離" },
  blockEmergencyRespawn: { type: "bool", default: true, category: "protection", label: "停用選單的緊急重生", hint: "阻擋玩家用「緊急重生」脫離卡點或戰鬥。 需 PalDefender 1.9.0 以上。", warn: "PalDefender 1.9 預設為開啟 —— 升級後玩家會發現緊急重生失效,不想要就在這裡關掉。" },

  // ── 白名單與管理員 ──
  useWhitelist: { type: "bool", default: false, category: "admin", label: "啟用白名單(WhiteList.json)",
    warn: "開啟前先到「玩家」分頁把自己與朋友加入白名單 — 名單為空時所有人(包括你的朋友)都會被擋在門外。" },
  useAdminWhitelist: { type: "bool", default: false, category: "admin", label: "啟用管理員 IP 白名單", hint: "需在 adminIPs 設定 IP(用原始檔編輯)。官方建議開啟以防漏洞。" },
  adminAutoLogin: { type: "bool", default: false, category: "admin", label: "白名單管理員加入時自動登入管理模式" },
  preventAdminPasswordInChat: { type: "bool", default: true, category: "admin", label: "防止管理員密碼在聊天中外洩" },
  allowAdminCheats: { type: "bool", default: false, category: "admin", label: "允許管理員使用作弊指令(如 godmode)", hint: "同時決定管理員能否略過部分防護(反吸物、體力/彈藥偵測)。" },
  allowGodmodeOnehit: { type: "bool", default: false, category: "admin", label: "godmode 可一擊擊殺" },
  whitelistMessage: { type: "string", default: "", category: "admin", label: "白名單拒絕訊息", placeholder: "留空 = 使用 PalDefender 預設訊息", hint: "非白名單玩家被擋下時看到的文字。" },

  // ── 聊天 ──
  chatBypassWait: { type: "bool", default: false, category: "chat", label: "移除聊天冷卻時間" },
  chatMessageMaxLen: { type: "int", default: 200, min: 1, max: 1000, category: "chat", label: "聊天訊息長度上限" },

  // ── 公告 ──
  announceConnections: { type: "bool", default: false, category: "announce", label: "公告玩家上下線" },
  dontAnnounceAdminConnections: { type: "bool", default: false, category: "announce", label: "不公告管理員上下線" },
  announcePunishments: { type: "bool", default: false, category: "announce", label: "公告作弊處罰(踢出/封鎖)" },
  announcePlayerDeaths: { type: "bool", default: false, category: "announce", label: "公告玩家死亡" },
  announceOpenOilrigBoxes: { type: "bool", default: false, category: "announce", label: "公告鑽油平台寶箱開啟" },
  announceHelicopterKills: { type: "bool", default: false, category: "announce", label: "公告直升機擊殺" },
  announcePlayerSummons: { type: "bool", default: false, category: "announce", label: "公告玩家召喚帕魯" },
  announceAdminSummons: { type: "bool", default: false, category: "announce", label: "公告管理員召喚帕魯" },

  // ── 日誌 ──
  logChat: { type: "bool", default: false, category: "logging", label: "記錄聊天訊息" },
  logRCON: { type: "bool", default: false, category: "logging", label: "記錄 RCON 指令使用" },
  logPlayerLogins: { type: "bool", default: false, category: "logging", label: "記錄玩家上下線" },
  logPlayerDeaths: { type: "bool", default: false, category: "logging", label: "記錄玩家死亡" },
  logPlayerBuildings: { type: "bool", default: false, category: "logging", label: "記錄玩家建築(建造/取消/拆除)" },
  logPlayerSummons: { type: "bool", default: false, category: "logging", label: "記錄玩家召喚帕魯" },
  logPlayerCaptures: { type: "bool", default: false, category: "logging", label: "記錄玩家捕捉帕魯" },
  logCraftings: { type: "bool", default: false, category: "logging", label: "記錄玩家製作" },
  logTechUnlocks: { type: "bool", default: false, category: "logging", label: "記錄科技解鎖" },
  logPlayerUID: { type: "bool", default: false, category: "logging", label: "日誌中記錄玩家 UserId" },
  logPlayerIP: { type: "bool", default: false, category: "logging", label: "日誌中記錄玩家 IP" },
  logNetworking: { type: "bool", default: false, category: "logging", label: "記錄用戶端網路資料" },
  logNetworkingToConsole: { type: "bool", default: true, category: "logging", label: "網路日誌同時輸出到主控台" },
  logPlayerDamage: { type: "bool", default: false, category: "logging", label: "記錄玩家造成的傷害", hint: "在主控台輸出每次玩家傷害的回報值與基礎值,與傷害作弊偵測互相獨立。 需 PalDefender 1.9.1 以上。" },
  logOpenOilrigBoxes: { type: "bool", default: true, category: "logging", label: "記錄鑽油平台寶箱開啟" },
  logHelicopterKills: { type: "bool", default: true, category: "logging", label: "記錄武裝直升機擊殺" },

  webhookURL_Chat: { type: "string", default: "", category: "webhook", label: "聊天訊息", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "全域與附近(Say)聊天。" },
  webhookURL_GuildChat: { type: "string", default: "", category: "webhook", label: "公會聊天", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "公會頻道訊息,含公會名稱。" },
  webhookURL_Commands: { type: "string", default: "", category: "webhook", label: "聊天指令", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "玩家/管理員在遊戲內輸入的指令,含執行者名稱。" },
  webhookURL_Deaths: { type: "string", default: "", category: "webhook", label: "死亡與擊殺", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "需同時開啟「公告玩家死亡」或「記錄玩家死亡」。" },
  webhookURL_JoinLeave: { type: "string", default: "", category: "webhook", label: "玩家上下線", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "需開啟「公告玩家上下線」;開了「不公告管理員上下線」則排除管理員。" },
  webhookURL_Summons: { type: "string", default: "", category: "webhook", label: "召喚與傷害排行", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "玩家/管理員召喚公告,以及召喚結束時的傷害排行榜。" },
  webhookURL_Oilrig: { type: "string", default: "", category: "webhook", label: "鑽油平台與直升機", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "需開啟對應的公告設定。" },
  webhookURL_AntiCheats: { type: "string", default: "", category: "webhook", label: "反作弊偵測", group: "PalWebhooks", secret: true, placeholder: "https://discord.com/api/webhooks/…", hint: "所有自動與待人工複核的偵測;是否附上 UserId / IP 由日誌設定決定。" },

  // ── 其他 ──
  exitServerOnStartupFailure: {
    type: "bool", default: false, category: "misc",
    label: "PalDefender 啟動失敗時關閉伺服器",
    hint: "保護存檔不在無反外掛的情況下運行。",
    warn: "這會以錯誤碼結束行程。GUI 已能辨識這種「啟動即失敗」的關閉並自動停止重啟(不會與崩潰自動重啟打成無限迴圈),但仍請留意重啟紀錄中的「啟動失敗」提示並修正 PalDefender 問題。",
  },
  disableButchering: { type: "bool", default: false, category: "misc", label: "停用屠宰" },
  disableRenaming: { type: "bool", default: false, category: "misc", label: "停用角色改名" },
  disablePalRenaming: { type: "bool", default: false, category: "misc", label: "停用帕魯改名" },
  OilrigGoalBoxLocktime: { type: "int", default: 300, min: 0, max: 3600, category: "misc", label: "鑽油平台目標寶箱鎖定時間(秒)" },
  RCONTimeout: { type: "float", default: 5, min: 1, max: 60, step: 0.5, category: "misc", label: "RCON 連線逾時(秒)" },
  RCONUsePacketIdFix: { type: "bool", default: false, category: "misc", label: "修正 RCON 封包 ID 問題" },
  RCONbase64: { type: "bool", default: true, category: "misc", label: "使用 Base64 RCON 文字編碼", hint: "讓 RCON 指令可安全傳送中文、日文與其他非 ASCII 文字。" },
} as const satisfies Record<string, PdOptionMeta>;

export type PdOptionKey = keyof typeof PALDEFENDER_OPTIONS;

export const PD_CATEGORY_LABELS: Record<PdOptionCategory, string> = {
  anticheat: "反外掛處置",
  protection: "漏洞防護",
  admin: "白名單與管理員",
  chat: "聊天",
  announce: "公告",
  logging: "日誌",
  webhook: "Discord Webhook(PalDefender 內建)",
  misc: "其他",
};

export type PdOptionValue = number | boolean | string;
export type PalDefenderConfig = Partial<Record<PdOptionKey, PdOptionValue>>;

/** MOTD(登入公告)是 Config.json 的字串陣列,每行一則;上限做基本防呆。 */
export const PD_MOTD_MAX_LINES = 30;
/** 字串型設定的長度上限(webhook URL、攔截訊息)。 */
export const PD_STRING_MAX_LEN = 2000;
export const PD_MOTD_MAX_LEN = 500;

export interface PalDefenderConfigStatus {
  supported: boolean;
  reason?: string;
  /** false when Config.json doesn't exist yet (server never started) */
  exists: boolean;
  values: PalDefenderConfig;
  /** MOTD 各行(字串陣列);scalar 之外另行處理。空陣列 = 未設定。 */
  motd: string[];
}

/** 寫入用的 patch:scalar 設定 +(可選)MOTD 陣列。 */
export type PalDefenderConfigPatch = PalDefenderConfig & { motd?: string[] };
