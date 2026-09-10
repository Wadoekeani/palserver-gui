/**
 * RCON command catalog.
 *
 * `builtin` — the dedicated server's own console commands
 *   (docs.palworldgame.com/settings-and-operation/commands)
 * `paldefender` — added by the PalDefender plugin, RCON-capable subset only
 *   (ultimeit.github.io/PalDefender/Commands/); chat-only commands such as
 *   /giveme or /godmode are deliberately omitted since RCON can't run them.
 *
 * When PalDefender is installed the agent asks the server for its real list
 * via /getrconcmds and filters this catalog by it, so a plugin update that
 * adds or drops a command doesn't strand the UI.
 */

export type CommandSource = "builtin" | "paldefender";

export type CommandCategory =
  | "server"
  | "players"
  | "moderation"
  | "items"
  | "pals"
  | "tech"
  | "bases"
  | "world"
  | "cleanup";

export interface CommandArg {
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
  /** 用玩家選單渲染此參數(可挑線上/曾見過的玩家,也可自由輸入 UserId / 座標)。
   *  讓一個指令能有多個玩家參數(name 各異),例如 tp 的來源玩家 + 目標玩家。 */
  player?: boolean;
  /** 座標參數:提供「在地圖上描點」按鈕(填入世界座標 x y),也可自由輸入。 */
  coord?: boolean;
  /** 遺物類型參數:渲染為下拉選單,選項來自 RELIC_TYPES。 */
  relicType?: boolean;
}

/* 靈魂雕像(give_relic)支援的遺物類型清單。 */
export const RELIC_TYPES = [
  "CapturePower", "HungerReduction", "SwimSpeed", "FoodDecayReduction",
  "JumpPower", "GliderSpeed", "ClimbSpeed", "StatusAilmentResist",
  "StaminaReduction", "SphereHoming", "ExpBonus", "RainbowPassiveRate",
  "MoveSpeed",
] as const;

/* 雕像名稱(對應 give_relic 的 RelicType 內部 ID)。前端用 t() 翻譯成其他語言。 */
export const RELIC_TYPE_LABELS: Record<string, string> = {
  CapturePower: "翠葉鼠",
  HungerReduction: "棉悠悠",
  SwimSpeed: "企丸丸",
  FoodDecayReduction: "肚肚鱷",
  JumpPower: "燎火鹿",
  GliderSpeed: "達鼠泥",
  ClimbSpeed: "新葉猿",
  StatusAilmentResist: "瞅什魔",
  StaminaReduction: "搗蛋貓",
  SphereHoming: "秘斯媞雅",
  ExpBonus: "佩克龍",
  RainbowPassiveRate: "八雲犬",
  MoveSpeed: "旺財",
};

export interface CommandSpec {
  name: string;
  source: CommandSource;
  category: CommandCategory;
  label: string;
  args: CommandArg[];
  /** Destructive or irreversible — the UI confirms before running. */
  dangerous?: boolean;
  /** 選定指令時顯示的補充說明(zh-TW 原文,前端 t() 翻譯)。 */
  hint?: string;
  /** 伺服器回報的別名 —— /getrconcmds 可能只列出別名(例:findunusedbases)。 */
  aliases?: string[];
}

const userId = (label = "玩家 UserId"): CommandArg => ({
  name: "userid",
  label,
  required: true,
  placeholder: "steam_7656119…",
});

export const COMMANDS: CommandSpec[] = [
  // ── built-in ─────────────────────────────────────────────────────────
  { name: "Info", source: "builtin", category: "server", label: "顯示伺服器資訊", args: [] },
  { name: "ShowPlayers", source: "builtin", category: "players", label: "列出所有在線玩家", args: [] },
  { name: "Save", source: "builtin", category: "server", label: "儲存世界資料", args: [] },
  {
    name: "Shutdown",
    source: "builtin",
    category: "server",
    label: "倒數後關閉伺服器",
    dangerous: true,
    args: [
      { name: "seconds", label: "延遲秒數", required: true, placeholder: "60" },
      { name: "message", label: "通知訊息", required: false, placeholder: "Server_restarting" },
    ],
  },
  { name: "DoExit", source: "builtin", category: "server", label: "立即強制停止伺服器", args: [], dangerous: true },
  { name: "KickPlayer", source: "builtin", category: "moderation", label: "踢出玩家", args: [userId()] },
  { name: "BanPlayer", source: "builtin", category: "moderation", label: "封鎖玩家", args: [userId()], dangerous: true },
  { name: "UnBanPlayer", source: "builtin", category: "moderation", label: "解除封鎖", args: [userId()] },
  // 官方 TeleportToPlayer / TeleportToMe 需要「遊戲內執行者(admin 角色)」,純 RCON
  // 沒有這個角色,套用無效(同 giveme/godmode 被省略的理由)。玩家間傳送改用
  // PalDefender 的 tp(第一參數就是來源玩家,不依賴執行者)。

  // ── PalDefender ──────────────────────────────────────────────────────
  { name: "version", source: "paldefender", category: "server", label: "顯示遊戲與 PalDefender 版本", args: [] },
  { name: "reloadcfg", source: "paldefender", category: "server", label: "重新載入設定與封鎖名單", args: [] },
  {
    name: "pgbroadcast",
    source: "paldefender",
    category: "server",
    label: "廣播訊息(支援中文)",
    args: [{ name: "message", label: "訊息", required: true, placeholder: "伺服器將在 5 分鐘後重啟" }],
  },
  {
    name: "alert",
    source: "paldefender",
    category: "server",
    label: "發送醒目警示訊息",
    args: [{ name: "message", label: "訊息", required: true }],
  },
  {
    name: "setadmin",
    source: "paldefender",
    category: "moderation",
    label: "授予/取消管理員權限",
    args: [userId()],
  },
  {
    name: "addadminip",
    source: "paldefender",
    category: "moderation",
    label: "將 IP 加入管理員白名單",
    args: [{ name: "ip", label: "IP 位址", required: true, placeholder: "100.64.0.1" }],
  },
  { name: "getpos", source: "paldefender", category: "players", label: "查詢玩家座標", args: [{ ...userId(), required: false }] },
  { name: "getip", source: "paldefender", category: "moderation", label: "查詢玩家 IP", args: [userId()] },
  {
    name: "kick",
    source: "paldefender",
    category: "moderation",
    label: "踢出玩家(可附原因)",
    args: [userId(), { name: "reason", label: "原因", required: false }],
  },
  {
    name: "ban",
    source: "paldefender",
    category: "moderation",
    label: "封鎖玩家(可附原因)",
    dangerous: true,
    args: [userId(), { name: "reason", label: "原因", required: false }],
  },
  {
    name: "ipban",
    source: "paldefender",
    category: "moderation",
    label: "IP 封鎖玩家",
    dangerous: true,
    args: [userId(), { name: "reason", label: "原因", required: false }],
  },
  {
    name: "unban",
    source: "paldefender",
    category: "moderation",
    label: "解除封鎖 UserId",
    args: [userId()],
  },
  {
    name: "banip",
    source: "paldefender",
    category: "moderation",
    label: "封鎖 IP",
    dangerous: true,
    args: [{ name: "ip", label: "IP 位址", required: true }],
  },
  { name: "unbanip", source: "paldefender", category: "moderation", label: "解除 IP 封鎖", args: [{ name: "ip", label: "IP 位址", required: true }] },
  { name: "whitelist_add", source: "paldefender", category: "moderation", label: "加入白名單", args: [userId()] },
  { name: "whitelist_remove", source: "paldefender", category: "moderation", label: "移出白名單", args: [userId()] },
  { name: "whitelist_get", source: "paldefender", category: "moderation", label: "列出白名單", args: [] },
  {
    name: "renameplayer",
    source: "paldefender",
    category: "players",
    label: "重新命名玩家",
    args: [userId(), { name: "name", label: "新暱稱", required: true }],
  },
  {
    name: "settime",
    source: "paldefender",
    category: "world",
    label: "設定世界時間",
    args: [{ name: "hour", label: "時間", required: true, placeholder: "0-23 / day / night" }],
  },
  // tp(傳送玩家)改為贊助者先行版的專屬 modal(TeleportModal + POST /teleport),
  // 不放在一般指令清單裡。底層一樣走 PalDefender `tp <來源> <目標玩家|x y z>`。

  {
    name: "give_exp",
    source: "paldefender",
    category: "players",
    label: "給予經驗值",
    args: [userId(), { name: "amount", label: "數量", required: true, placeholder: "1000" }],
  },
  {
    name: "givestats",
    source: "paldefender",
    category: "players",
    label: "給予狀態點數",
    args: [userId(), { name: "count", label: "點數", required: false, placeholder: "1" }],
  },
  {
    name: "give",
    source: "paldefender",
    category: "items",
    label: "給予道具",
    args: [
      userId(),
      { name: "itemid", label: "道具 ID", required: true, placeholder: "Wood" },
      { name: "amount", label: "數量", required: false, placeholder: "1" },
    ],
  },
  {
    name: "delitem",
    source: "paldefender",
    category: "items",
    label: "移除道具",
    args: [
      userId(),
      { name: "itemid", label: "道具 ID", required: true },
      { name: "amount", label: "數量", required: false, placeholder: "1" },
    ],
  },
  {
    name: "clearinv",
    source: "paldefender",
    category: "cleanup",
    label: "清空玩家背包",
    dangerous: true,
    hint: "清空指定玩家背包(或指定容器)的物品,可減少世界殘留物件與存檔量。",
    args: [userId(), { name: "container", label: "容器(選填)", required: false }],
  },
  {
    name: "give_relic",
    source: "paldefender",
    category: "items",
    label: "給予靈魂雕像",
    args: [
      userId(),
      { name: "relicType", label: "雕像類型", required: true, relicType: true },
      { name: "amount", label: "數量", required: false, placeholder: "1" },
    ],
  },
  {
    name: "givepal",
    source: "paldefender",
    category: "pals",
    label: "給予帕魯",
    args: [
      userId(),
      { name: "palid", label: "帕魯 ID", required: true, placeholder: "Lamball" },
      { name: "level", label: "等級", required: false, placeholder: "1" },
    ],
  },
  {
    name: "spawnpal",
    source: "paldefender",
    category: "pals",
    label: "生成野生帕魯",
    args: [
      { name: "palid", label: "帕魯 ID", required: true },
      { name: "coords", label: "座標與等級(選填)", required: false, coord: true, placeholder: "x y z level" },
    ],
  },
  {
    name: "summon",
    source: "paldefender",
    category: "pals",
    label: "啟動頭目活動(PalSummon)",
    hint: "啟動 PalDefender/Pals/Summons/ 底下的活動檔(檔名不含 .json)。用「頭目活動」分頁編輯這些檔案比較快。",
    args: [{ name: "file", label: "活動檔名", required: true, placeholder: "不含 .json" }],
  },
  {
    name: "spawnpal_ex",
    source: "paldefender",
    category: "pals",
    label: "生成野生帕魯(含傷害排行)",
    hint: "參數與「生成野生帕魯」完全相同,差別是這隻會被計入傷害統計,擊敗後在主控台輸出傷害排行。需 PalDefender 1.9.1 以上。",
    args: [
      { name: "palid", label: "帕魯 ID", required: true },
      { name: "coords", label: "座標與等級(選填)", required: false, coord: true, placeholder: "x y z level" },
    ],
  },
  {
    name: "spawnpal_ex_j",
    source: "paldefender",
    category: "pals",
    label: "以範本生成帕魯(含傷害排行)",
    hint: "用 PalTemplate 範本名生成,並計入傷害排行。範本放在 PalDefender/Pals/Templates/。需 PalDefender 1.9.1 以上。",
    args: [
      { name: "template", label: "範本名稱", required: true, placeholder: "PalTemplate 檔名(不含 .json)" },
      { name: "coords", label: "座標與等級(選填)", required: false, coord: true, placeholder: "x y z level" },
    ],
  },
  {
    name: "spawnnpc",
    source: "paldefender",
    category: "pals",
    label: "生成 NPC(含 AI)",
    hint: "需 PalDefender 1.9.0 以上。",
    args: [
      { name: "npcid", label: "NPC ID 或角色 ID", required: true },
      { name: "coords", label: "座標與等級(選填)", required: false, coord: true, placeholder: "x y z level" },
    ],
  },
  {
    name: "giveegg",
    source: "paldefender",
    category: "pals",
    label: "給予帕魯蛋",
    args: [
      userId(),
      { name: "eggid", label: "蛋 ID", required: true },
      { name: "palid", label: "帕魯 ID", required: true },
      { name: "level", label: "等級", required: false },
    ],
  },
  { name: "exportpals", source: "paldefender", category: "pals", label: "匯出玩家的帕魯", args: [{ ...userId(), required: false }] },
  {
    name: "deletepals",
    source: "paldefender",
    category: "cleanup",
    label: "依條件刪除帕魯",
    dangerous: true,
    hint: "依條件批次刪除玩家的帕魯(例如清理離線玩家的過量帕魯),減輕伺服器物件負擔。",
    args: [userId(), { name: "filter", label: "篩選條件", required: true }],
  },
  {
    name: "learntech",
    source: "paldefender",
    category: "tech",
    label: "解鎖科技(all = 全部)",
    args: [userId(), { name: "techid", label: "科技 ID", required: true, placeholder: "all" }],
  },
  {
    name: "unlearntech",
    source: "paldefender",
    category: "tech",
    label: "鎖回科技(all = 全部)",
    args: [userId(), { name: "techid", label: "科技 ID", required: true, placeholder: "all" }],
  },
  {
    name: "givetechpoints",
    source: "paldefender",
    category: "tech",
    label: "給予科技點數",
    args: [userId(), { name: "amount", label: "數量", required: false, placeholder: "1" }],
  },
  {
    name: "givebosstechpoints",
    source: "paldefender",
    category: "tech",
    label: "給予古代科技點數",
    args: [userId(), { name: "amount", label: "數量", required: false, placeholder: "1" }],
  },
  { name: "gettechids", source: "paldefender", category: "tech", label: "列出所有科技 ID", args: [] },
  { name: "getskinids", source: "paldefender", category: "pals", label: "列出所有帕魯造型 ID", args: [] },
  {
    name: "getnearestbase",
    source: "paldefender",
    category: "bases",
    label: "查詢最近的據點擁有者",
    args: [{ name: "coords", label: "座標(選填)", required: false, coord: true, placeholder: "x y z" }],
  },
  {
    name: "killnearestbase",
    source: "paldefender",
    category: "cleanup",
    label: "摧毀最近的據點",
    dangerous: true,
    hint: "刪除離指定座標最近的據點,可清除無主/廢棄據點;PalDefender 刪除前會自動輸出該據點的 JSON 備份。",
    args: [{ name: "coords", label: "座標(選填)", required: false, coord: true, placeholder: "x y z" }],
  },
  {
    name: "findbases",
    source: "paldefender",
    category: "cleanup",
    label: "尋找閒置/廢棄據點",
    aliases: ["findunusedbases"],
    hint: "第一次執行會建立佇列,之後可用 visit / next 傳送過去、kill 摧毀。過濾條件範例:inactive days=30 或 unused builds<=5。需 PalDefender 1.9.0 以上。",
    args: [
      {
        name: "argv",
        label: "子指令與過濾條件",
        required: false,
        placeholder: "empty|inactive|unused|all days=30 builds<=5 / visit / next / kill [next]",
      },
    ],
  },
  {
    name: "setguildleader",
    source: "paldefender",
    category: "bases",
    label: "指定公會會長",
    args: [userId()],
  },
  { name: "exportguilds", source: "paldefender", category: "bases", label: "匯出所有公會為 JSON", args: [] },
  {
    name: "admingun",
    source: "paldefender",
    category: "server",
    label: "取得管理員之槍",
    aliases: ["agun"],
    hint: "需在遊戲內已是管理員狀態。可秒殺目標與移除建築物件;登出、死亡或關閉管理模式時自動回收。需 PalDefender 1.9.0 以上。",
    dangerous: true,
    args: [],
  },
  {
    name: "setting",
    source: "paldefender",
    category: "world",
    label: "讀寫遊戲設定(實驗性)",
    hint: "直接讀寫 UPalGameSetting 的欄位。用戶端顯示的數值可能不會跟著更新。需 PalDefender 1.9.0 以上。",
    dangerous: true,
    args: [
      { name: "name", label: "設定名稱", required: true },
      { name: "op", label: "操作", required: true, placeholder: "get | set | add | sub" },
      { name: "value", label: "新值(get 以外必填)", required: false },
    ],
  },
];

export const COMMAND_CATEGORY_LABELS: Record<CommandCategory, string> = {
  server: "伺服器",
  players: "玩家",
  moderation: "管理與封鎖",
  items: "道具",
  pals: "帕魯",
  tech: "科技",
  bases: "據點與公會",
  world: "世界",
  cleanup: "清理",
};

/** Build the wire command string, quoting nothing — Palworld's parser is
 * whitespace-separated and does not understand quotes. */
export function buildCommand(spec: CommandSpec, values: Record<string, string>): string {
  const parts = [spec.name];
  for (const arg of spec.args) {
    const value = values[arg.name]?.trim();
    if (value) parts.push(value);
  }
  return parts.join(" ");
}

export interface RconCommandsResponse {
  /** false when RCON is off / no admin password (with `reason`). */
  available: boolean;
  reason?: string;
  paldefender: boolean;
  commands: CommandSpec[];
}
