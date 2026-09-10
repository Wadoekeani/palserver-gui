# Agent REST API 參考

palserver-GUI 由兩個行程組成:**agent**(常駐、跑在伺服器主機上,管理 Palworld 伺服器行程)與
**GUI 前端**(瀏覽器頁面,呼叫 agent 的 REST API)。agent 對外只有一組 HTTP API —— GUI 前端、
官方 Discord bot([discord-bot.md](discord-bot.md))都只是它的客戶端,你也可以用同一組 API
寫自己的 bot、面板或自動化工具。本文列出全部端點;想快速上手、只需要常用子集,看
[discord-bot.md](discord-bot.md) 的「自製機器人開發者指南」章節。

事件通知(伺服器 → 你)走另一條路:[webhooks.md](webhooks.md)。本文只涵蓋「你 → 伺服器」的指令
呼叫方向。

---

## Base URL

```
http://<agent 主機>:8250
```

預設埠 `8250`,可在 GUI 設定頁或環境變數改。同機呼叫用 `127.0.0.1`;跨機用主機的 LAN / VPN
位址(Tailscale 等)。agent 若開了 TLS 則是自簽憑證,同機可跳過憑證驗證,跨機建議走 VPN + HTTP
而非驗證自簽憑證。

## 認證

- **同機**(呼叫端與 agent 跑在同一台、連 `127.0.0.1`/`localhost`):預設**免 token**。
- **跨機**:HTTP header 帶 `Authorization: Bearer <AGENT_TOKEN>`。token 在 GUI 設定頁可複製,
  等同 agent 的**完整控制權**,請妥善保管;可在設定頁重新產生(換發後舊 token 失效)。
- 也支援**配對碼**:`POST /api/pair` 帶好念的配對碼換發長 token(給遠端裝置首次設定用,見下方
  「Agent 本身」表格)。
- **狀態碼語意**:
  - `401` —— token 缺失或錯誤。
  - `403` —— 該功能屬贊助者先行版,此 agent 尚未用贊助者識別碼解鎖(本文表格中標「(贊助限定)」
    的端點皆可能回 403;請把 403 當「功能未解鎖」處理,不要重試)。
  - `404` —— 找不到指定的 instance / 資源。
  - `409` —— 狀態衝突(例如伺服器正在執行中,無法做需要停止才能做的操作)。回應通常帶
    `{ error: "中文說明" }`,可直接顯示給使用者。

## 內容型別

- 一般請求/回應皆為 `application/json`。無 body 的 `POST` 送 `{}` 即可。
- 檔案上傳(`PUT /api/instances/:id/files/upload`)是**原始位元組**(`application/octet-stream`
  或任意二進位),不是 JSON —— 檔案內容直接當 request body,路徑走 query string。
- 檔案下載端點(`export`、`saves/backup/download`、`config-backups/download`)回應
  `Content-Disposition: attachment`,直接是檔案串流。

## 通用錯誤格式

失敗回應一律是:

```json
{ "error": "中文錯誤說明" }
```

`error` 訊息是給人看的繁中說明(可直接顯示在 UI),不是機器可解析的錯誤碼;要做程式判斷請看
HTTP 狀態碼。

---

## 端點總覽

以下依功能域分組,組內按路徑排序。除非特別註明,`:id` 皆為 instance id(來自
`GET /api/instances` 的 `id` 欄位)。標「(贊助限定)」的端點在未解鎖贊助者先行版時回 403。

### 1. Agent 本身

不帶 `:id` 的端點,操作 agent 自身而非某個伺服器實例。

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/addresses` | — | `{ addresses: { ip, vpn }[] }` | 本機可連 IPv4 位址,標出 Tailscale/Radmin/Hamachi |
| `POST /api/import-save/inspect` | `{ sourcePath }` | `{ worlds: ExternalWorldCandidate[] }`(型別見 `@palserver/shared`) | 掃描外部路徑找可匯入的世界 |
| `GET /api/info` | — | 型別 `AgentInfo`(name/version/dockerVersion/instanceCount/authenticated/platform/availableBackends) | 公開端點,免認證也能打,但會一併回報這次請求的授權狀態 |
| `DELETE /api/license` | — | 清除贊助者識別碼後的狀態 | |
| `GET /api/license` | — | 目前贊助者授權狀態 | |
| `PUT /api/license` | `{ code }` | 設定後的授權狀態 | 贊助者識別碼(先行版授權),一碼綁一台 |
| `GET /api/mods/latest` | — | 各模組元件(UE4SS/PalDefender 等)最新穩定版 | agent 端 6 小時快取 |
| `POST /api/pair` | `{ code }` | `{ token }` | 用配對碼換發長 token;此端點本身免 token(靠配對碼保護) |
| `GET /api/pair/code` | — | `{ pairingCode }` | 需已授權;查目前配對碼,產生「邀請連線」連結用 |
| `POST /api/pair/rotate` | — | `{ pairingCode }` | 輪替配對碼(需已授權),舊碼即刻失效 |
| `POST /api/restart` | — | `{ restarting: boolean }` | 重啟 agent 自己(僅免安裝執行檔會真的重啟;開發模式回 `false`) |
| `GET /api/settings` | — | 系統/網路設定,每欄帶 `{ value, envLocked }` | `envLocked=true` 表示被環境變數鎖定,面板應顯示為灰化 |
| `PUT /api/settings` | `{ requireToken?, tls?, agentPort?, agentHost?, webOrigins?, autoOpenBrowser?, bootStart? }` | 更新後設定 | 寫入 data-dir/settings.json,多數欄位需重啟 agent 生效 |
| `GET /api/system-review` | — (贊助限定 `dashboard-stats`) | 主機硬體+網路實測與健檢評分 | |
| `GET /api/telemetry` | — | 匿名遙測開關狀態 | `envDisabled=true` 表示被 `PALSERVER_TELEMETRY=0` 強制停用 |
| `PUT /api/telemetry` | `{ enabled }` | 更新後狀態 | |
| `POST /api/translate` | `{ q: string[], tl: string }` | 譯文陣列(對應輸入順序) | 日誌翻譯用;結果記憶體快取,同句不重複呼叫 Google |
| `GET /api/update` | `?force=1` 可選 | 型別 `AgentUpdateStatus` | GUI 自我更新狀態;`force=1` 略過 6 小時檢查快取 |
| `POST /api/update/apply` | — | `202` + `{ applying, latestVersion }` | 換版會重啟行程;之後輪詢 `GET /api/update` 看 `phase`/`lastError` |
| `PUT /api/update/prefs` | `{ autoCheck?, autoApply?, channel? }` | 更新後的 `AgentUpdateStatus` | |

### 2. 實例管理(CRUD / duplicate / export / import)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances` | — | `InstanceSummary[]` | 全部實例摘要清單 |
| `POST /api/instances` | 型別 `CreateInstanceInput`:`name`、`backend`(native/docker/k8s)、`flavor`(vanilla/modded)、`dockerImage?`、`runtime?`(native/wine)、`gamePort?`、`serverDir?`、`k8sNamespace?` 等、`settings`(WorldSettings 片段) | 建立後的實例(`InstanceSummary` 形狀) | 名稱重複回 409；`gamePort` 省略時從 8211 起自動找可用埠 |
| `GET /api/instances/:id` | — | 型別 `InstanceDetail`(含 `settings`、`serverDir`、`effectiveServerDir`、`autoStart` 等) | |
| `DELETE /api/instances/:id` | — | `204` | 真正刪除:停行程/移除容器、刪 agent 自管目錄；k8s 只縮到 0,保留叢集 PVC |
| `PUT /api/instances/:id/auto-start` | `{ enabled }` | `{ autoStart }` | agent 啟動時自動開服(每實例) |
| `POST /api/instances/:id/duplicate` | `{ name? }` | 新實例(`InstanceSummary`) | 複製設定+世界存檔,不複製遊戲執行檔；僅 native、需先停止來源 |
| `GET /api/instances/:id/export` | — | 檔案串流(`.tar.gz`) | 匯出存檔+ini+PalDefender 設定，不含遊戲執行檔；僅 native |
| `POST /api/instances/:id/import-save` | `{ worldPath, overwrite? }` | 型別 `ImportSaveResult` | 匯入外部存檔到此實例；需先停止伺服器 |
| `POST /api/instances/:id/mirror` | `{ targetId }` | `{ mirrored, worldGuid, targetId }` | 同 agent 內把存檔+INI 鏡像遷移到另一個實例 |
| `PUT /api/instances/:id/server-dir` | `{ serverDir }` | 更新後的實例路徑資訊 | 僅 native；改路徑不搬檔案，留空回到 agent 管理資料夾；執行中/安裝中不可改 |
| `PUT /api/instances/:id/settings` | 型別 `Partial<WorldSettings>`(對應 `PalWorldSettings.ini` 全部設定項,定義見 `@palserver/shared` 的 `WORLD_OPTIONS`) | 更新後的完整 `WorldSettings` | 改埠會先做跨欄位撞埠檢查（遊戲埠/查詢埠/REST/RCON） |
| `POST /api/instances/:id/settings/sync-ini` | — | `{ settings, changedKeys }` | 把 ini 檔的外部改動併回 store（編輯原始檔後呼叫） |

### 3. 生命週期(start / stop / restart / update / version)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `POST /api/instances/:id/restart` | `AnnounceBody`(見下)可選 | `InstanceSummary` | 依序:公告倒數(如有)→ 停止 → 啟動 |
| `GET /api/instances/:id/restart-policy` | — | 型別 `RestartStatus`(policy/events/restartsLastHour/memoryMB) | 自動重啟策略(排程/記憶體閾值/崩潰重啟) |
| `PUT /api/instances/:id/restart-policy` | 型別 `RestartPolicy`(scheduled/memory/crash/announceSeconds/announceTemplates) | 更新後 policy | |
| `POST /api/instances/:id/start` | — | `InstanceSummary` | 啟動前會先套用 PalDefender 預設值、重新校對 ini |
| `GET /api/instances/:id/stats` | — | 型別 `InstanceStats`(cpuPercent/memoryBytes/uptimeSeconds 等) | 伺服器未執行時回 409 |
| `POST /api/instances/:id/stop` | `AnnounceBody`:`{ announceTemplate?, immediate? }` 可選 | `InstanceSummary` | `immediate:true` 會中止進行中的倒數公告直接停止 |
| `POST /api/instances/:id/update` | `{ fresh? }` | 更新結果(依 backend 而定) | `fresh:true` = 刪除遊戲本體後全新下載（保留存檔/設定）；執行中回 409 |
| `GET /api/instances/:id/version` | — | 型別 `VersionStatus`(gameVersion/installedBuild/latestBuild/updateAvailable) | |

`AnnounceBody`:停止/重啟前若帶 `announceTemplate` 且伺服器在跑，依該實例的 `announceSeconds`
設定先在遊戲聊天室倒數公告（`0` 秒 = 不公告）。

### 4. 即時狀態與玩家

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/guilds` | — | 型別 `PdGuildList`(`detailed` 標示是否含公會細節) | 需 PalDefender REST；`detailed` 需贊助授權，未授權時 name/level/members 會被清空 |
| `GET /api/instances/:id/guilds/:guildId` | — (贊助限定 `guild-map`) | 型別 `PdGuildDetail`(含 members/camps) | |
| `GET /api/instances/:id/live` | — | 型別 `LiveStatus`(available/info/metrics/players) | 需遊戲 REST API 已啟用（GUI 世界設定），否則 `available:false` |
| `GET /api/instances/:id/paldefender-players` | — | 型別 `PdPlayerList`(含離線玩家) | |
| `GET /api/instances/:id/paldefender-rest` | — | 型別 `PdRestStatus`(installed/configExists/enabled/hasToken/port) | |
| `PUT /api/instances/:id/paldefender-rest/enabled` | `{ enabled }` | 更新後 `PdRestStatus` | 啟用時會檢查與其他實例的埠衝突 |
| `PUT /api/instances/:id/paldefender-rest/port` | `{ port }` | `PdRestStatus` + `{ applied: "on-next-restart" }` | |
| `POST /api/instances/:id/paldefender-rest/token` | `{ regenerate? }` | `PdRestStatus` + `{ hasToken }` | 產生/換發 agent 呼叫 PalDefender REST 用的 token |
| `GET /api/instances/:id/players/:identifier/detail` | — | 型別 `PlayerDetail`(pals/items/techs/progression) | |
| `GET /api/instances/:id/players/events` | `?limit`(1–500,預設 100) | `PresenceEvent[]`(`{ at, type: "join"\|"leave", userId, name }`) | |
| `GET /api/instances/:id/players/known` | — | `KnownPlayer[]` | 統一名冊:有開 PalDefender REST 以其為準（含離線），否則用 agent 自己的紀錄 |

### 5. 玩家管理與 moderation

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `POST /api/instances/:id/announce` | `{ message }` | `{ announced: message }` | 遊戲內廣播 |
| `POST /api/instances/:id/items/give` | `{ userId, items: { itemId, amount }[] }`(items 最多 50 筆,`amount` 1–99999) | `{ output }`(RCON 原始輸出) | (贊助限定 `bulk-items`)僅 Windows；需已安裝 PalDefender；走 RCON `giveitems` |
| `GET /api/instances/:id/moderation` | — | 型別 `ModerationLists`(whitelistEnabled/whitelist/bans) | 讀自 PalDefender 的 JSON 檔，伺服器關閉時也能看 |
| `POST /api/instances/:id/moderation/:action` | `:action` ∈ `whitelist_add`/`whitelist_remove`/`ban`/`unban`/`banip`/`unbanip`；body `{ value, reason? }` | 操作結果 | |
| `POST /api/instances/:id/pals/give` | 型別 `CustomPalInput`(mode: pal/egg、userId、palId、nickname?、gender?、level?、activeSkills?、passives?、ivs?、condensedPals?、souls?、partnerSkillLevel?，見 `@palserver/shared`) | 給予結果 | (贊助限定 `custom-pal`)僅 Windows；需已安裝 PalDefender；走 PalTemplate + RCON `givepal_j` |
| `POST /api/instances/:id/players/:userId/ban` | `{ message? }` | `{ banned: userId }` | |
| `POST /api/instances/:id/players/:userId/kick` | `{ message? }` | `{ kicked: userId }` | |
| `POST /api/instances/:id/players/:userId/unban` | — | `{ unbanned: userId }` | |
| `POST /api/instances/:id/paldefender/summon/pal` | `{ x, y, z, palId? \| template?, level?, uncapturable?, disableAI?, disableDamageMeter?, healthMultiplier? }`(palId 與 template 恰好擇一) | 型別 `PdSummonResult` | (贊助限定 `pd-summon`)僅 Windows；需 PalDefender 1.9.0 以上並啟用 REST；走 `POST /v1/pdapi/summon/pal` |
| `POST /api/instances/:id/paldefender/summon/npc` | `{ npcId, x, y, z, level?, uncapturable?, disableAI? }` | 型別 `PdSummonResult` | (贊助限定 `pd-summon`)同上；走 `POST /v1/pdapi/summon/npc` |
| `POST /api/instances/:id/paldefender/findbases` | `{ argv }`(只接受英數與 `= < > _ -` 空白,例:`inactive days=30`、`visit`、`kill next`) | `{ output }`(PalDefender 原始輸出,未解析) | (贊助限定 `pd-findbases`)僅 Windows；需 PalDefender 1.9.0 以上；走 RCON `findbases`,佇列狀態在 PalDefender 那側 |
| `POST /api/instances/:id/teleport` | `{ source, target }`(`source` = 玩家識別字串;`target` = 玩家 UserId 或座標「x y [z]」) | `{ output }`(RCON 原始輸出) | (贊助限定 `teleport`)僅 Windows；需已安裝 PalDefender;走 RCON `tp` 指令 |

### 6. RCON

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/rcon/commands` | — | `{ available, reason?, paldefender, commands[] }` | 有裝 PalDefender 時優先用它回報的可用指令清單（避免與外掛版本不同步） |
| `POST /api/instances/:id/rcon` | `{ command }` | `{ command, output }` | 任意 RCON 指令 |

### 7. 模組(mods / pak-mods / palschema / boss-respawns)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/boss-respawns` | — | 頭目回報模組狀態(`supported`/`modInstalled`/`state`) | 倒數計算函式 `bossRespawnInfo` 見 `@palserver/shared` |
| `POST /api/instances/:id/boss-respawns/install` | — (贊助限定 `boss-respawn`) | `{ installed: "boss-reporter", version, applied }` | 純伺服器端 UE4SS Lua 模組；執行中會回 409 |
| `POST /api/instances/:id/boss-respawns/uninstall` | — (贊助限定 `boss-respawn`) | `{ removed: "boss-reporter" }` | |
| `GET /api/instances/:id/mods` | — | 型別 `ModsStatus`(ue4ss/paldefender/luaMods/pakMods) | |
| `POST /api/instances/:id/mods/:component/enabled` | `:component` ∈ `ue4ss`/`paldefender`；body `{ enabled }` | 更新後 `ModsStatus` | 暫時停用/啟用（改名主 DLL,不刪檔）；native 執行中回 409 |
| `POST /api/instances/:id/mods/:component/install` | `:component` ∈ `ue4ss`/`paldefender`；body `{ channel? }`(stable/beta) | 安裝結果 | native 執行中需先停止；docker/k8s 需容器在跑 |
| `POST /api/instances/:id/mods/:component/uninstall` | `:component` ∈ `ue4ss`/`paldefender` | `{ removed: component }` | 執行中回 409(檔案被鎖定) |
| `POST /api/instances/:id/mods/lua-toggle` | `{ name, enabled }` | 更新後 `ModsStatus` | 切換單一 UE4SS Lua mod |
| `DELETE /api/instances/:id/pak-mods` | `?name` | `204` | |
| `GET /api/instances/:id/pak-mods` | — | `{ mods: [] }` | 跨平台(native/docker/k8s)，UE 引擎原生載入 |
| `POST /api/instances/:id/pak-mods/toggle` | `{ name, enabled }` | `{ toggled: name, enabled }` | |
| `DELETE /api/instances/:id/pal-stats` | — | 清空結果 | 清空所有物種數值調整;刻意不做贊助 gate（贊助到期也能改回原設定） |
| `GET /api/instances/:id/pal-stats` | — | 物種數值調整表 | |
| `PUT /api/instances/:id/pal-stats` | `{ row, values }`(`row` = 物種 ID,`values` 動態產生自 `PAL_STAT_OPTIONS`,見 `routes.ts:1714`) | 更新後結果 | (贊助限定 `pal-stats`) |
| `GET /api/instances/:id/palschema` | — | PalSchema 安裝狀態 | 物種數值編輯器底層引擎 |
| `POST /api/instances/:id/palschema/enabled` | `{ enabled }` | 更新後狀態 | 暫時停用/啟用（整個資料夾搬出/搬回 Mods/,不刪檔） |
| `POST /api/instances/:id/palschema/install` | — (贊助限定 `pal-stats`) | `{ installed: "palschema", version, applied }` | 執行中回 409(DLL 被鎖) |
| `POST /api/instances/:id/palschema/uninstall` | — (贊助限定 `pal-stats`) | `{ removed: "palschema" }` | |

### 8. 世界與引擎設定

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/config-backups` | — | 型別 `ConfigSnapshotList` | INI 設定快照清單(PalWorldSettings.ini + Engine.ini) |
| `POST /api/instances/:id/config-backups` | `{ reason? }` | `201` + 型別 `ConfigSnapshotInfo` | 手動建立一份設定快照 |
| `GET /api/instances/:id/config-backups/download` | `?name` | 檔案串流(`.json`) | |
| `POST /api/instances/:id/config-backups/restore` | `{ name }` | 還原結果 | native 需先停止伺服器;k8s 反過來需伺服器運行中(才能 exec 進 Pod 寫檔),兩者不符都回 409 |
| `GET /api/instances/:id/config-health` | — | 型別 `ConfigHealth`(world/engine 各自 `FileHealth`) | 設定檔是否存在/損毀 |
| `POST /api/instances/:id/config/regenerate` | `{ file }`(`"world"` \| `"engine"`) | 重新生成結果 | 動手前自動留一份快照 |
| `GET /api/instances/:id/engine-settings` | — | `EngineSettings`(欄位定義見 `@palserver/shared` `ENGINE_OPTIONS`) | Engine.ini 效能相關設定 |
| `PUT /api/instances/:id/engine-settings` | 動態產生自 `ENGINE_OPTIONS`(見 `routes.ts:1832`) | `{ ...status, applied: "on-next-restart" }` | 動手前自動留一份快照 |
| `GET /api/instances/:id/launch-options` | — | `{ launchOptions, queryPort }` | 命令列啟動參數 + Steam 查詢埠 |
| `PUT /api/instances/:id/launch-options` | `{ launchOptions? }`,欄位動態產生自 `LAUNCH_OPTIONS`(見 `routes.ts:1855`) | 更新後結果 | |
| `GET /api/instances/:id/paldefender-config` | — | PalDefender `Config.json` 內容 | |
| `PUT /api/instances/:id/paldefender-config` | 動態產生自 `PALDEFENDER_OPTIONS` + `{ motd?: string[] }`(見 `routes.ts:1645`) | 更新後結果 | |

### 9. 檔案管理

Base path 皆為實例的伺服器根目錄(native)或 Pod 內 `/palworld` 根目錄(k8s)。

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `DELETE /api/instances/:id/files` | `?path` | `204` | |
| `GET /api/instances/:id/files` | `?path`(預設空字串 = 根目錄) | `{ path, entries: DirEntry[] }` | 目錄列表 |
| `GET /api/instances/:id/files/content` | `?path` | 型別 `FileContent`(`{ path, content }`) | 讀取文字檔內容(供編輯器開啟) |
| `PUT /api/instances/:id/files/content` | `{ path, content }` | `{ saved, applied }` | 改到 `PalWorldSettings.ini`/`Engine.ini` 時自動先留快照 |
| `POST /api/instances/:id/files/dir` | `{ path }` | `201` + `{ created: path }` | 建立目錄 |
| `PUT /api/instances/:id/files/upload` | **原始位元組**(非 JSON);`?path` | `{ uploaded, size }` | 串流寫入磁碟,大型 pak mod 上傳不會塞爆記憶體;改到 ini 設定檔時自動先留快照 |
| `GET /api/instances/:id/logs/sources` | — | `LogSource[]`(`{ id, label, available }`) | 可用的日誌來源(agent/game/paldefender);實際串流走 WebSocket,見下方章節 |

### 10. 存檔與備份(saves/*)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `POST /api/instances/:id/save` | — | `{ saved: true }` | 立即存世界檔(透過遊戲 REST API) |
| `POST /api/instances/:id/save-unlocks/fast-travel` | — (贊助限定 `map-unlocks`) | 解鎖結果 | 全體玩家快速傳送全開;需伺服器停止(運行中寫入會損壞存檔) |
| `GET /api/instances/:id/saves` | — | 型別 `SavesStatus` + `schedule`(`BackupSchedule`) | 世界清單、備份清單、排程 |
| `POST /api/instances/:id/saves/active` | `{ worldGuid }` | `{ active: worldGuid, applied: "on-next-start" }` | 切換啟用中的世界;native 需先停止,k8s 需伺服器運行中(要能 exec 進 Pod) |
| `PUT /api/instances/:id/saves/auto-scan` | `{ enabled, intervalMinutes? }` | 更新後設定 | 每小時自動掃描開關(排行榜分頁用) |
| `DELETE /api/instances/:id/saves/backup` | `?name` | `204` | |
| `POST /api/instances/:id/saves/backup` | `{ worldGuid }` | `201` + 型別 `BackupInfo` | 立即備份指定世界 |
| `GET /api/instances/:id/saves/backup/download` | `?name` | 檔案串流(`.tar.gz`) | |
| `GET /api/instances/:id/saves/breeding-snapshot` | `?worldGuid`(省略 = 啟用中世界) | 型別 `SaveBreedingSnapshot` | 配種計算器專用輕量快照,只含帕魯 |
| `GET /api/instances/:id/saves/guilds-snapshot` | `?worldGuid`(省略 = 啟用中世界) | 公會快照(存檔掃描產出) | |
| `GET /api/instances/:id/saves/health` | `?worldGuid` | 型別 `SaveHealthStatus` | 存檔健檢(唯讀分析)目前狀態 |
| `POST /api/instances/:id/saves/health` | `{ worldGuid }` | `202` + `SaveHealthStatus` | 觸發一次健檢掃描(非同步) |
| `POST /api/instances/:id/saves/host-fix` | `{ worldGuid, oldSav, newSav }` | 型別 `HostFixResult` | 主機角色修復(共玩存檔搬上專用伺服器);動手前強制備份 |
| `POST /api/instances/:id/saves/pal-owner-fix` | `{ worldGuid, toSav }` | 過戶結果 | 把殘留共玩 host uid 名下的帕魯過戶給指定玩家存檔;動手前強制備份 |
| `DELETE /api/instances/:id/saves/player` | `?worldGuid&file` | `204` | 刪除單一玩家存檔 |
| `GET /api/instances/:id/saves/players-snapshot` | `?worldGuid&uid`(皆可選) | 全玩家快照,或帶 `uid` 時回單一玩家完整檔案 | |
| `POST /api/instances/:id/saves/restore` | `{ backup }` | 還原結果 | 從備份檔還原 |
| `PUT /api/instances/:id/saves/schedule` | `{ enabled?, intervalMinutes?, keep?, skipWhenEmpty? }` | 型別 `BackupSchedule` | 自動備份排程設定 |
| `POST /api/instances/:id/saves/schedule/run` | — | 排程執行結果 | 立即跑一次排程備份(與定時器同一段程式碼) |
| `GET /api/instances/:id/saves/stats-history` | `?worldGuid` | 掃描統計歷史 + `autoScan` 設定 | 排行榜/週報分頁用 |
| `POST /api/instances/:id/saves/world-options-fix` | `{ worldGuid }` | 停用結果 | 停用共玩遺留的 `WorldOptions.sav`(會蓋掉 ini 的世界設定與 AdminPassword) |

### 11. 連線與網路(connection / ports / external-address)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/connection` | — | 型別 `ConnectionInfo`(gamePort/lan/vpns/publicIp/behindNat/externalAddress) | 給玩家的連線位址 |
| `PUT /api/instances/:id/external-address` | `{ address }` | `{ externalAddress }` | 玩家連線用的公開位址(playit.gg 隧道等),使用者手動填 |
| `GET /api/instances/:id/ports/check` | — | 五種埠(game/query/rest/rcon/paldefender)的占用檢查結果,附建議替代埠 | 伺服器運行中時回 409(自己占著埠,檢查無意義) |
| `PUT /api/instances/:id/ports` | `{ game?, query?, rest?, rcon?, paldefender? }`(1024–65535) | 更新後結果 | 需先停止伺服器 |

### 12. 公開地圖(public-map)

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/public-map` | — | 型別 `PublicMapStatus`(settings/shareUrl/lastPublish) | 查看/關閉永遠放行,不受贊助授權過期影響 |
| `PUT /api/instances/:id/public-map` | `{ settings: Partial<PublicMapSettings> }` | 更新後 `PublicMapStatus` | 只擋「從關閉切成開啟」這個轉換需贊助授權;已開啟時改子設定不受限(授權過期的服主仍能調整顯示內容) |
| `POST /api/instances/:id/public-map/rotate` | — (贊助限定 `public-map`) | 換發後的分享連結 | 換一個新的 `shareId`,舊連結失效 |

### 13. Webhook(贊助限定)

全組端點皆需 `featureEnabled("webhooks")`,未解鎖回 403。事件格式、簽章演算法、投遞語意見
[webhooks.md](webhooks.md)。

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `DELETE /api/instances/:id/webhooks/:whId` | — | `{ ok: true }` 或 404 | |
| `GET /api/instances/:id/webhooks` | — | webhook 清單(不含 secret,只回 `secretSet`) | |
| `POST /api/instances/:id/webhooks` | webhook 設定(URL、訂閱事件、格式 generic/discord 等) | `201` + 建立結果(含一次性 secret) | |
| `PUT /api/instances/:id/webhooks/:whId` | 同建立輸入的部分欄位 | 更新結果 | |
| `GET /api/instances/:id/webhooks/:whId/deliveries` | — | 投遞紀錄 | |
| `POST /api/instances/:id/webhooks/:whId/rotate-secret` | — | 換發後的新 secret(一次性顯示) | |
| `POST /api/instances/:id/webhooks/:whId/test` | — | 測試投遞結果 | 送出 `webhook.ping` 事件 |

### 14. Discord Bot(同機代管,贊助限定)

同機由 agent 自跑並監督的 Discord bot 設定(與 webhook 共用贊助閘門);token 只寫入、不回讀。

| 端點 | body / query 摘要 | 回傳摘要 | 備註 |
|---|---|---|---|
| `GET /api/instances/:id/discord-bot` | — | 型別 `DiscordBotStatus`(settings/tokenSet/running/lastError) | |
| `PUT /api/instances/:id/discord-bot` | 型別 `DiscordBotSettings` 的部分欄位 + `token?`(enabled/adminUserIds/notifyChannelId/notifyEvents/statusChannelId) | 更新後 `DiscordBotStatus` | |

上述 14 組共涵蓋 136 條路由;其餘 2 條是 WebSocket 端點,獨立列在下一節。

---

## WebSocket 端點

以下兩個端點走 WebSocket(`{ websocket: true }`),不是一般 HTTP request/response;連不到指定
instance 時 socket 會以 code `4004` 關閉。

| 端點 | 說明 |
|---|---|
| `GET /api/instances/:id/logs` | 日誌即時串流。query `?source=agent\|game\|paldefender`(預設 `agent`),對應 `GET .../logs/sources` 列出的來源。每則訊息是一行純文字日誌。 |
| `GET /api/instances/:id/players/feed` | 玩家上下線等即時事件推播(`subscribePlayerFeed`)。 |

跨語言連線方式與一般 WebSocket client 相同(`ws://` 或 `wss://` + 上述路徑)。認證:同機免
token;跨機在 URL 加 `?token=<AGENT_TOKEN>` query 參數,例如
`ws://<host>:8250/api/instances/<id>/logs?token=…&source=agent`(GUI 前端就是這樣連的,見
`packages/web/src/api.ts` 的 `logsSocket`)。

---

## 相容性約定

- **新增欄位不算破壞**:回應物件未來可能新增欄位,請把消費端寫成「多的欄位容忍、缺的欄位給
  預設值」,不要假設欄位清單是封閉的。
- **贊助閘門**:標「(贊助限定)」的端點在該 agent 沒有有效贊助者授權時回 `403`
  `{ error: "…請在設定頁輸入贊助者識別碼解鎖。" }`。請把 403 當「功能未解鎖」處理,不要重試或
  當成一般錯誤。
- **狀態衝突(409)**:多數會修改伺服器檔案的端點(mods 安裝、設定檔重建、存檔還原等)在伺服器
  執行中(或某些 k8s 端點反過來要求運行中)會回 409,錯誤訊息是可直接顯示的中文說明。
- **自律**:查詢類端點(`/live`、`/saves`、`/players/*` 等)請控制在每 5–15 秒一次的等級;
  操作類端點不要重試風暴 —— agent 對同一實例的操作有互斥,衝突會回 4xx/5xx。
- **本文與程式碼不一致時**:以 `packages/agent/src/routes.ts` 的實際實作為準,並歡迎回報文件
  落後之處。

## 相關文件

- [discord-bot.md](discord-bot.md) —— 精簡版端點參考 + 快速上手範例,官方 Discord bot 就是
  這組 API 的一個客戶端實作。
- [webhooks.md](webhooks.md) —— 事件通知(伺服器 → 你)的訂閱、簽章驗證與投遞語意。
