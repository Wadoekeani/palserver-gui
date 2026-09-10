import { useEffect, useState } from "react";
import { FiStar, FiLock, FiX, FiMapPin, FiZap } from "react-icons/fi";
import {
  hasFeature,
  PD_MIN_VERSION,
  PD_SUMMON_LIMITS,
  type PdSummonResult,
} from "@palserver/shared";
import type { AgentClient } from "./api";
import { EntityPicker } from "./EntityPicker";
import { MapPickModal } from "./MapPickModal";
import { useGameData, palIconUrl, humanIconUrl } from "./gameData";
import { t, useI18n } from "./i18n";
import { Overlay, btn, btnGhost, card, errorCls, inputCls } from "./ui";

/**
 * 召喚帕魯 / NPC(贊助者先行版 pd-summon)。走 PalDefender REST
 * `POST /v1/pdapi/summon/pal` 與 `/summon/npc`(需 PalDefender 1.9.0 以上)。
 *
 * 座標與 tp / 地圖描點用的是同一套「地圖座標」,但 REST 的 Z 是必填(不像 tp 可留空
 * 讓伺服器自己找地面),所以描點之後仍要補 Z —— 可用主控台的 getpos 取得自己的高度。
 */

type Mode = "pal" | "npc";
type PalSource = "id" | "template";

/** 數字輸入:空字串代表未填,回傳 null。 */
const num = (s: string): number | null => {
  const v = Number(s.trim());
  return s.trim() !== "" && Number.isFinite(v) ? v : null;
};

export function SummonModal({
  client,
  instanceId,
  initialCoords,
  onClose,
}: {
  client: AgentClient;
  instanceId: string;
  /** 從地圖某點開啟時預填(地圖座標;z 可能不知道)。 */
  initialCoords?: { x: number; y: number; z?: number };
  onClose: () => void;
}) {
  useI18n();
  const game = useGameData();
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("pal");
  const [palSource, setPalSource] = useState<PalSource>("id");
  const [palId, setPalId] = useState("");
  const [template, setTemplate] = useState("");
  const [npcId, setNpcId] = useState("");
  const [x, setX] = useState(initialCoords ? String(initialCoords.x) : "");
  const [y, setY] = useState(initialCoords ? String(initialCoords.y) : "");
  const [z, setZ] = useState(initialCoords?.z !== undefined ? String(initialCoords.z) : "");
  const [level, setLevel] = useState("1");
  const [uncapturable, setUncapturable] = useState(false);
  const [disableAI, setDisableAI] = useState(false);
  const [disableDamageMeter, setDisableDamageMeter] = useState(false);
  const [healthMultiplier, setHealthMultiplier] = useState("1");
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PdSummonResult[]>([]);

  useEffect(() => {
    client
      .license()
      .then((l) => setEntitled(hasFeature("pd-summon", l)))
      .catch(() => setEntitled(false));
  }, [client]);

  const locked = entitled === false;
  const cx = num(x);
  const cy = num(y);
  const cz = num(z);
  const lv = num(level);
  const hp = num(healthMultiplier);
  const usingTemplate = mode === "pal" && palSource === "template";
  const who =
    mode === "npc" ? npcId.trim() : usingTemplate ? template.trim() : palId.trim();
  const coordsOk = cx !== null && cy !== null && cz !== null;
  const hpOk = mode === "npc" || usingTemplate || (hp !== null && hp > 0 && hp <= PD_SUMMON_LIMITS.maxMultiplier);
  const canSubmit = !locked && !busy && who !== "" && coordsOk && hpOk;

  const submit = async () => {
    if (cx === null || cy === null || cz === null) return;
    setBusy(true);
    setError(null);
    try {
      const base = {
        x: cx,
        y: cy,
        z: cz,
        uncapturable: uncapturable || undefined,
        disableAI: disableAI || undefined,
      };
      const res =
        mode === "npc"
          ? await client.summonNpc(instanceId, {
              ...base,
              npcId: npcId.trim(),
              level: lv ?? undefined,
            })
          : await client.summonPal(instanceId, {
              ...base,
              ...(usingTemplate ? { template: template.trim() } : { palId: palId.trim(), level: lv ?? undefined }),
              disableDamageMeter: disableDamageMeter || undefined,
              healthMultiplier: !usingTemplate && hp !== null && hp !== 1 ? hp : undefined,
            });
      setResults((prev) => [res, ...prev].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (value: boolean, set: (v: boolean) => void, label: string, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-2 text-[13px]">
      <input
        type="checkbox"
        className="mt-0.5 shrink-0"
        checked={value}
        onChange={(e) => set(e.target.checked)}
      />
      <span>
        <span className="font-bold">{t(label)}</span>
        {hint && <span className="block text-xs text-ink-muted">{t(hint)}</span>}
      </span>
    </label>
  );

  return (
    <Overlay onClose={onClose}>
      <div
        className={`${card} flex max-h-[86vh] w-160 max-w-full flex-col gap-3 overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-extrabold">
            <FiZap className="size-5 text-pal" /> {t("召喚帕魯 / NPC")}
            <span className="inline-flex items-center gap-1 rounded-full bg-pal/10 px-2 py-0.5 text-xs font-bold text-pal">
              <FiStar className="size-3" /> {t("贊助者")}
            </span>
          </h2>
          <button className="text-ink-muted transition hover:text-ink" onClick={onClose} aria-label={t("關閉")}>
            <FiX className="size-5" />
          </button>
        </div>

        {locked && (
          <div className="inline-flex items-center gap-2 rounded-cute border-2 border-sun/40 bg-sun/10 px-3 py-2 text-xs font-bold text-sun">
            <FiLock className="size-4 shrink-0" />
            {t("這是贊助者先行版功能。到「設定 → 贊助者識別碼」輸入識別碼即可使用。")}
          </div>
        )}

        <p className="text-xs text-ink-muted">
          {t("在指定座標放一隻帕魯或 NPC —— 辦活動用。需要 PalDefender {min} 以上並啟用 REST API。", {
            min: PD_MIN_VERSION.summon,
          })}
        </p>

        <div className={locked ? "pointer-events-none flex flex-col gap-3 opacity-55" : "flex flex-col gap-3"}>
          <div className="flex gap-1.5">
            {(["pal", "npc"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                  mode === m ? "border-pal bg-pal/10 text-pal" : "border-line text-ink-muted hover:border-pal/50"
                }`}
                onClick={() => setMode(m)}
              >
                {m === "pal" ? t("帕魯") : t("NPC")}
              </button>
            ))}
          </div>

          {mode === "pal" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                {(["id", "template"] as const).map((sourceKind) => (
                  <button
                    key={sourceKind}
                    type="button"
                    className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                      palSource === sourceKind
                        ? "border-pal bg-pal/10 text-pal"
                        : "border-line text-ink-muted hover:border-pal/50"
                    }`}
                    onClick={() => setPalSource(sourceKind)}
                  >
                    {sourceKind === "id" ? t("選帕魯") : t("用 PalTemplate 範本")}
                  </button>
                ))}
              </div>
              {palSource === "id" ? (
                <EntityPicker
                  catalog={game?.pals ?? []}
                  iconUrl={palIconUrl}
                  value={palId}
                  onChange={setPalId}
                  placeholder={t("搜尋帕魯名稱或 ID")}
                />
              ) : (
                <>
                  <input
                    className={inputCls}
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder={t("範本檔名(可省略 .json)")}
                  />
                  <p className="text-xs text-ink-muted">
                    {t("範本放在 PalDefender/Pals/Templates/ 底下,帕魯種類與等級由範本決定。")}
                  </p>
                </>
              )}
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
              {t("NPC")}
              <EntityPicker
                catalog={game?.humans ?? []}
                iconUrl={humanIconUrl}
                value={npcId}
                onChange={setNpcId}
                placeholder={t("搜尋 NPC 名稱或 ID(也可直接輸入 NPCID)")}
              />
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-ink-muted">{t("座標(地圖座標,三項都必填)")}</span>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["X", x, setX],
                  ["Y", y, setY],
                  ["Z", z, setZ],
                ] as const
              ).map(([label, value, set]) => (
                <label key={label} className="flex items-center gap-1 font-mono text-sm">
                  <span className="text-ink-muted">{label}</span>
                  <input
                    className={`${inputCls} w-24 font-mono`}
                    type="number"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                </label>
              ))}
              <button
                type="button"
                className={`${btnGhost} inline-flex shrink-0 items-center gap-1.5`}
                onClick={() => setShowMap(true)}
              >
                <FiMapPin className="size-4" /> {t("地圖描點")}
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              {t("召喚 API 的 Z 不能留空。在遊戲內站到目標位置,用主控台的 getpos 就能拿到完整座標。")}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {!usingTemplate && (
              <label className="flex items-center gap-2 text-[13px] font-bold">
                {t("等級")}
                <input
                  className={`${inputCls} w-20`}
                  type="number"
                  min={PD_SUMMON_LIMITS.minLevel}
                  max={PD_SUMMON_LIMITS.maxLevel}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                />
              </label>
            )}
            {mode === "pal" && !usingTemplate && (
              <label className="flex items-center gap-2 text-[13px] font-bold">
                {t("生命倍率")}
                <input
                  className={`${inputCls} w-24`}
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={healthMultiplier}
                  onChange={(e) => setHealthMultiplier(e.target.value)}
                />
              </label>
            )}
            {toggle(uncapturable, setUncapturable, "禁止捕捉")}
            {toggle(disableAI, setDisableAI, "關閉 AI", "站著不動;閃避之類的被動行為仍可能發生。")}
            {mode === "pal" &&
              toggle(disableDamageMeter, setDisableDamageMeter, "關閉傷害排行", "擊敗後不輸出傷害排行。")}
          </div>
        </div>

        {error && <p className={errorCls}>{error}</p>}

        <button
          className={`${btn} inline-flex items-center justify-center gap-1.5`}
          onClick={submit}
          disabled={!canSubmit}
        >
          <FiZap className="size-4" /> {busy ? t("召喚中…") : t("召喚")}
        </button>

        {results.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-ink-muted">{t("這次開啟後召喚的")}</span>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {results.map((r, i) => (
                <li key={i} className="rounded-xl bg-grass/10 px-2 py-1 text-grass">
                  {r.template ? `${r.template} → ${r.id}` : r.id}
                  {` · Lv ${r.level} · ${r.x} ${r.y} ${r.z}`}
                  {r.uncapturable ? ` · ${t("禁捕")}` : ""}
                  {r.disableAI ? ` · ${t("無 AI")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showMap && (
        <MapPickModal
          onClose={() => setShowMap(false)}
          onPick={(coords) => {
            const [px, py, pz] = coords.trim().split(/\s+/);
            if (px !== undefined) setX(px);
            if (py !== undefined) setY(py);
            if (pz !== undefined) setZ(pz);
            setShowMap(false);
          }}
        />
      )}
    </Overlay>
  );
}
