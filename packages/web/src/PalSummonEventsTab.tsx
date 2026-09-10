import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCopy,
  FiFileText,
  FiInfo,
  FiLock,
  FiMapPin,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiStar,
  FiTrash2,
} from "react-icons/fi";
import {
  emptyPdSummonEncounter,
  hasFeature,
  PD_MIN_VERSION,
  PD_POOL_MODES,
  PD_POOL_MODE_FIELDS,
  PD_REWARD_DEFAULT_KEY,
  pdEntryKind,
  validatePdSummonEncounter,
  type PdAmount,
  type PdEntryKind,
  type PdLootPool,
  type PdPoolMode,
  type PdRewardDefinition,
  type PdRewardEntry,
  type PdSummonEncounter,
} from "@palserver/shared";
import type { AgentClient } from "./api";
import { EntityPicker } from "./EntityPicker";
import { FileEditor } from "./FileManager";
import { MapPickModal } from "./MapPickModal";
import { useGameData, itemIconUrl } from "./gameData";
import { t, useI18n } from "./i18n";
import { EmptyState, btn, btnDanger, btnGhost, card, errorCls, inputCls, Select } from "./ui";

/**
 * 頭目活動編輯器(贊助者先行版 pd-summon-event)。
 *
 * 編輯的是 PalDefender 的 PalSummon.json:`Pal/Binaries/Win64/PalDefender/Pals/Summons/*.json`,
 * 用 RCON `summon <檔名>` 啟動。讀寫走既有的檔案 API,所以不需要專屬的 agent 端點;
 * 存回去時保留檔案裡我們沒建模的鍵(PalDefender 的別名欄位不會被吃掉)。
 */

const SUMMONS_DIR = "Pal/Binaries/Win64/PalDefender/Pals/Summons";

/** 名次排序:數字小的在前,Default 最後。 */
const rankOrder = (a: string, b: string): number => {
  const da = a.toLowerCase() === PD_REWARD_DEFAULT_KEY.toLowerCase();
  const db = b.toLowerCase() === PD_REWARD_DEFAULT_KEY.toLowerCase();
  if (da !== db) return da ? 1 : -1;
  return Number(a) - Number(b);
};

const ENTRY_KIND_LABELS: Record<PdEntryKind, string> = {
  item: "道具",
  egg: "帕魯蛋",
  exp: "經驗值",
  tech: "科技點",
  ancientTech: "古代科技點",
};

/** 換獎勵類型:清掉其他類型的欄位,只留通用的機率/權重/不重複。 */
function withKind(e: PdRewardEntry, kind: PdEntryKind): PdRewardEntry {
  const keep: PdRewardEntry = { Chance: e.Chance, Weight: e.Weight, Unique: e.Unique };
  for (const k of ["Chance", "Weight", "Unique"] as const) if (keep[k] === undefined) delete keep[k];
  switch (kind) {
    case "item":
      return { ...keep, ItemID: "", Count: 1 };
    case "egg":
      return { ...keep, EggID: "", PalTemplate: "", Count: 1, Level: 0 };
    case "exp":
      return { ...keep, EXP: 1 };
    case "tech":
      return { ...keep, TechnologyPoints: 1 };
    case "ancientTech":
      return { ...keep, AncientTechnologyPoints: 1 };
  }
}

/** 數量欄位:固定值 ↔ Min/Max 區間。 */
function AmountInput({
  value,
  onChange,
  label,
}: {
  value: PdAmount | undefined;
  onChange: (v: PdAmount | undefined) => void;
  label: string;
}) {
  useI18n();
  const isRange = typeof value === "object" && value !== null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-ink-muted">{t(label)}</span>
      {isRange ? (
        <>
          <input
            className={`${inputCls} w-20`}
            type="number"
            min={1}
            value={value.Min}
            onChange={(e) => onChange({ Min: Number(e.target.value), Max: value.Max })}
          />
          <span className="text-xs text-ink-muted">–</span>
          <input
            className={`${inputCls} w-20`}
            type="number"
            min={1}
            value={value.Max}
            onChange={(e) => onChange({ Min: value.Min, Max: Number(e.target.value) })}
          />
        </>
      ) : (
        <input
          className={`${inputCls} w-24`}
          type="number"
          min={1}
          value={value ?? ""}
          placeholder="1"
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      )}
      <button
        type="button"
        className={`${btnGhost} px-2 py-0.5 text-xs`}
        onClick={() =>
          onChange(isRange ? value.Min : { Min: typeof value === "number" ? value : 1, Max: typeof value === "number" ? value : 1 })
        }
      >
        {isRange ? t("改固定值") : t("改區間")}
      </button>
    </div>
  );
}

/** 一項獎勵(道具 / 蛋 / 經驗 / 科技點)。ctx 決定要不要顯示機率、權重、不重複。 */
function EntryRow({
  entry,
  onChange,
  onRemove,
  ctx,
}: {
  entry: PdRewardEntry;
  onChange: (e: PdRewardEntry) => void;
  onRemove: () => void;
  ctx: { weight: boolean; chance: boolean; unique: boolean };
}) {
  useI18n();
  const game = useGameData();
  const kind = pdEntryKind(entry);
  const amountKey =
    kind === "exp" ? "EXP" : kind === "tech" ? "TechnologyPoints" : kind === "ancientTech" ? "AncientTechnologyPoints" : null;

  return (
    <div className="flex flex-col gap-2 rounded-cute border-2 border-line p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-32"
          value={kind ?? "item"}
          onChange={(e) => onChange(withKind(entry, e.target.value as PdEntryKind))}
        >
          {(Object.keys(ENTRY_KIND_LABELS) as PdEntryKind[]).map((k) => (
            <option key={k} value={k}>
              {t(ENTRY_KIND_LABELS[k])}
            </option>
          ))}
        </Select>
        {kind === null && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-berry">
            <FiAlertTriangle className="size-3.5" /> {t("這一項的類型不明確,請重新選一次")}
          </span>
        )}
        <button type="button" className={`${btnDanger} ml-auto px-2 py-1`} onClick={onRemove} aria-label={t("移除")}>
          <FiTrash2 className="size-3.5" />
        </button>
      </div>

      {kind === "item" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <EntityPicker
              catalog={game?.items ?? []}
              iconUrl={itemIconUrl}
              value={entry.ItemID ?? ""}
              onChange={(id) => onChange({ ...entry, ItemID: id })}
              placeholder={t("搜尋道具名稱或 ID")}
            />
          </div>
          <AmountInput value={entry.Count} onChange={(v) => onChange({ ...entry, Count: v })} label="數量" />
        </div>
      )}

      {kind === "egg" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <EntityPicker
                catalog={game?.eggs ?? []}
                iconUrl={itemIconUrl}
                value={entry.EggID ?? ""}
                onChange={(id) => onChange({ ...entry, EggID: id })}
                placeholder={t("搜尋帕魯蛋")}
              />
            </div>
            <AmountInput value={entry.Count} onChange={(v) => onChange({ ...entry, Count: v })} label="數量" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} min-w-56 flex-1`}
              value={entry.PalTemplate ?? ""}
              onChange={(e) => onChange({ ...entry, PalTemplate: e.target.value })}
              placeholder={t("蛋裡的帕魯:PalTemplate 範本檔名")}
            />
            <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
              {t("等級")}
              <input
                className={`${inputCls} w-20`}
                type="number"
                min={0}
                value={entry.Level ?? 0}
                onChange={(e) => onChange({ ...entry, Level: Number(e.target.value) })}
              />
              <span className="font-normal">{t("0 = 用範本的")}</span>
            </label>
          </div>
        </div>
      )}

      {amountKey && (
        <AmountInput
          value={entry[amountKey]}
          onChange={(v) => onChange({ ...entry, [amountKey]: v })}
          label={t(ENTRY_KIND_LABELS[kind as PdEntryKind])}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {ctx.chance && (
          <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
            {t("機率(%)")}
            <input
              className={`${inputCls} w-20`}
              type="number"
              min={0}
              max={100}
              value={typeof entry.Chance === "string" ? entry.Chance.replace(/%$/, "") : (entry.Chance ?? "")}
              placeholder="100"
              onChange={(e) =>
                onChange({ ...entry, Chance: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </label>
        )}
        {ctx.weight && (
          <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
            {t("權重")}
            <input
              className={`${inputCls} w-20`}
              type="number"
              min={1}
              value={entry.Weight ?? ""}
              placeholder="1"
              onChange={(e) =>
                onChange({ ...entry, Weight: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </label>
        )}
        {ctx.unique && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-ink-muted">
            <input
              type="checkbox"
              checked={entry.Unique ?? true}
              onChange={(e) => onChange({ ...entry, Unique: e.target.checked })}
            />
            {t("不重複")}
          </label>
        )}
      </div>
    </div>
  );
}

/** 一個抽獎池。 */
function PoolCard({
  pool,
  index,
  onChange,
  onRemove,
}: {
  pool: PdLootPool;
  index: number;
  onChange: (p: PdLootPool) => void;
  onRemove: () => void;
}) {
  useI18n();
  const mode: PdPoolMode = pool.Mode ?? "OneOf";
  const spec = PD_POOL_MODE_FIELDS[mode] ?? PD_POOL_MODE_FIELDS.OneOf;
  const ctx = { weight: spec.weight, chance: spec.entryChance, unique: spec.unique };

  return (
    <div className="flex flex-col gap-2 rounded-cute border-2 border-pal/30 bg-pal/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold text-ink-muted">{t("抽獎池 {n}", { n: index + 1 })}</span>
        <input
          className={`${inputCls} w-40 py-1 text-xs`}
          value={pool.Name ?? ""}
          onChange={(e) => onChange({ ...pool, Name: e.target.value || undefined })}
          placeholder={t("標籤(選填)")}
        />
        <Select className="w-40" value={mode} onChange={(e) => onChange({ ...pool, Mode: e.target.value as PdPoolMode })}>
          {PD_POOL_MODES.map((m) => (
            <option key={m} value={m}>
              {t(PD_POOL_MODE_FIELDS[m].label)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
          {t("整池機率(%)")}
          <input
            className={`${inputCls} w-20`}
            type="number"
            min={0}
            max={100}
            value={typeof pool.Chance === "string" ? pool.Chance.replace(/%$/, "") : (pool.Chance ?? "")}
            placeholder="100"
            onChange={(e) => onChange({ ...pool, Chance: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </label>
        {spec.rolls && (
          <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
            {t("抽幾次")}
            <input
              className={`${inputCls} w-16`}
              type="number"
              min={1}
              value={pool.Rolls ?? 1}
              onChange={(e) => onChange({ ...pool, Rolls: Number(e.target.value) })}
            />
          </label>
        )}
        {spec.unique && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-ink-muted">
            <input
              type="checkbox"
              checked={pool.Unique ?? true}
              onChange={(e) => onChange({ ...pool, Unique: e.target.checked })}
            />
            {t("同一項不重複")}
          </label>
        )}
        <button type="button" className={`${btnDanger} ml-auto px-2 py-1`} onClick={onRemove}>
          <FiTrash2 className="size-3.5" />
        </button>
      </div>
      <p className="inline-flex items-start gap-1.5 text-xs text-ink-muted">
        <FiInfo className="mt-0.5 size-3.5 shrink-0" />
        {t(spec.hint)}
      </p>
      <div className="flex flex-col gap-2">
        {(pool.Entries ?? []).map((entry, i) => (
          <EntryRow
            key={i}
            entry={entry}
            ctx={ctx}
            onChange={(next) =>
              onChange({ ...pool, Entries: (pool.Entries ?? []).map((x, j) => (j === i ? next : x)) })
            }
            onRemove={() => onChange({ ...pool, Entries: (pool.Entries ?? []).filter((_, j) => j !== i) })}
          />
        ))}
      </div>
      <button
        type="button"
        className={`${btnGhost} inline-flex w-fit items-center gap-1.5 text-xs`}
        onClick={() => onChange({ ...pool, Entries: [...(pool.Entries ?? []), { ItemID: "", Count: 1, Weight: 1 }] })}
      >
        <FiPlus className="size-3.5" /> {t("加一項獎勵")}
      </button>
    </div>
  );
}

/** 一個名次(或預設)的獎勵內容。 */
function RewardEditor({
  def,
  onChange,
}: {
  def: PdRewardDefinition;
  onChange: (d: PdRewardDefinition) => void;
}) {
  useI18n();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-cute border-2 border-line p-3">
        <span className="text-xs font-extrabold text-ink-muted">{t("保證給的(不用擲骰)")}</span>
        <div className="flex flex-wrap gap-4">
          <AmountInput value={def.EXP} onChange={(v) => onChange({ ...def, EXP: v })} label="經驗值" />
          <AmountInput
            value={def.TechnologyPoints}
            onChange={(v) => onChange({ ...def, TechnologyPoints: v })}
            label="科技點"
          />
          <AmountInput
            value={def.AncientTechnologyPoints}
            onChange={(v) => onChange({ ...def, AncientTechnologyPoints: v })}
            label="古代科技點"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold text-ink-muted">{t("直接掉落(每項各自擲自己的機率)")}</span>
        {(def.Drops ?? []).map((entry, i) => (
          <EntryRow
            key={i}
            entry={entry}
            ctx={{ weight: false, chance: true, unique: false }}
            onChange={(next) => onChange({ ...def, Drops: (def.Drops ?? []).map((x, j) => (j === i ? next : x)) })}
            onRemove={() => onChange({ ...def, Drops: (def.Drops ?? []).filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          className={`${btnGhost} inline-flex w-fit items-center gap-1.5 text-xs`}
          onClick={() => onChange({ ...def, Drops: [...(def.Drops ?? []), { ItemID: "", Count: 1 }] })}
        >
          <FiPlus className="size-3.5" /> {t("加一項掉落")}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold text-ink-muted">{t("抽獎池")}</span>
        {(def.Pools ?? []).map((pool, i) => (
          <PoolCard
            key={i}
            pool={pool}
            index={i}
            onChange={(next) => onChange({ ...def, Pools: (def.Pools ?? []).map((x, j) => (j === i ? next : x)) })}
            onRemove={() => onChange({ ...def, Pools: (def.Pools ?? []).filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          className={`${btnGhost} inline-flex w-fit items-center gap-1.5 text-xs`}
          onClick={() =>
            onChange({
              ...def,
              Pools: [...(def.Pools ?? []), { Mode: "OneOf", Entries: [{ ItemID: "", Count: 1, Weight: 1 }] }],
            })
          }
        >
          <FiPlus className="size-3.5" /> {t("加一個抽獎池")}
        </button>
      </div>
    </div>
  );
}

export function PalSummonEventsTab({
  client,
  instanceId,
  running,
}: {
  client: AgentClient;
  instanceId: string;
  running: boolean;
}) {
  useI18n();
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [dirMissing, setDirMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [enc, setEnc] = useState<PdSummonEncounter | null>(null);
  const [dirty, setDirty] = useState(false);
  const [rank, setRank] = useState<string>(PD_REWARD_DEFAULT_KEY);
  const [showMap, setShowMap] = useState(false);
  const [rawPath, setRawPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    client
      .license()
      .then((l) => setEntitled(hasFeature("pd-summon-event", l)))
      .catch(() => setEntitled(false));
  }, [client]);

  const listFiles = useCallback(async () => {
    try {
      const res = await client.listFiles(instanceId, SUMMONS_DIR);
      setNames(
        res.entries
          .filter((e) => !e.isDir && e.name.toLowerCase().endsWith(".json"))
          .map((e) => e.name)
          .sort(),
      );
      setDirMissing(false);
      setError(null);
    } catch (err) {
      // 目錄還不存在是正常的(PalDefender 只在用到時才建),不當成錯誤嚇人。
      setNames([]);
      setDirMissing(true);
      setError(err instanceof Error && !/not found|ENOENT|不存在/i.test(err.message) ? err.message : null);
    }
  }, [client, instanceId]);

  useEffect(() => {
    void listFiles();
  }, [listFiles]);

  const open = async (name: string) => {
    if (dirty && !confirm(t("有未儲存的變更,確定要切換嗎?"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await client.readFile(instanceId, `${SUMMONS_DIR}/${name}`);
      const parsed = JSON.parse(res.content) as PdSummonEncounter;
      setEnc(parsed);
      setSelected(name);
      setDirty(false);
      const ranks = Object.keys(parsed.Rewards ?? {}).sort(rankOrder);
      setRank(ranks[0] ?? PD_REWARD_DEFAULT_KEY);
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? t("這個檔案不是有效的 JSON —— 請用「原始 JSON」修好再回來編輯。")
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setSelected(name);
      setEnc(null);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const raw = prompt(t("新活動的檔名(不含 .json)"));
    const base = raw?.trim();
    if (!base) return;
    if (!/^[\w.-]+$/.test(base)) {
      setError(t("檔名只能用英數、底線、減號與點。"));
      return;
    }
    const name = `${base}.json`;
    if (names?.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(t("已經有同名的活動了。"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (dirMissing) await client.makeDir(instanceId, SUMMONS_DIR).catch(() => {});
      const fresh = emptyPdSummonEncounter();
      await client.writeFile(instanceId, `${SUMMONS_DIR}/${name}`, JSON.stringify(fresh, null, 4));
      await listFiles();
      setEnc(fresh);
      setSelected(name);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (!selected || !enc) return;
    const name = selected.replace(/\.json$/i, "") + "-copy.json";
    setBusy(true);
    try {
      await client.writeFile(instanceId, `${SUMMONS_DIR}/${name}`, JSON.stringify(enc, null, 4));
      await listFiles();
      setNotice(t("已複製為 {name}", { name }));
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(t("確定要刪除活動「{name}」嗎?此動作無法復原。", { name: selected }))) return;
    setBusy(true);
    try {
      await client.deleteFile(instanceId, `${SUMMONS_DIR}/${selected}`);
      setSelected(null);
      setEnc(null);
      setDirty(false);
      await listFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected || !enc) return;
    setBusy(true);
    setError(null);
    try {
      await client.writeFile(instanceId, `${SUMMONS_DIR}/${selected}`, JSON.stringify(enc, null, 4));
      setDirty(false);
      setNotice(t("已儲存 —— 下次啟動這個活動就會用新的設定。"));
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    if (!selected) return;
    if (dirty && !confirm(t("有未儲存的變更,啟動時會用檔案裡的舊設定。要繼續嗎?"))) return;
    const name = selected.replace(/\.json$/i, "");
    if (!confirm(t("要在伺服器上啟動活動「{name}」嗎?玩家會立刻看到公告。", { name }))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await client.rconExec(instanceId, `summon ${name}`);
      setNotice(res.output?.trim() || t("已送出啟動指令。"));
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const patch = (next: Partial<PdSummonEncounter>) => {
    setEnc((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  };

  const issues = useMemo(() => (enc ? validatePdSummonEncounter(enc) : []), [enc]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const ranks = useMemo(() => Object.keys(enc?.Rewards ?? {}).sort(rankOrder), [enc]);

  const setReward = (key: string, def: PdRewardDefinition | null) => {
    setEnc((prev) => {
      if (!prev) return prev;
      const rewards = { ...(prev.Rewards ?? {}) };
      if (def === null) delete rewards[key];
      else rewards[key] = def;
      return { ...prev, Rewards: Object.keys(rewards).length ? rewards : undefined };
    });
    setDirty(true);
  };

  const addRank = () => {
    const used = new Set(ranks.map((r) => r.toLowerCase()));
    if (!used.has(PD_REWARD_DEFAULT_KEY.toLowerCase())) {
      setReward(PD_REWARD_DEFAULT_KEY, {});
      setRank(PD_REWARD_DEFAULT_KEY);
      return;
    }
    let n = 1;
    while (used.has(String(n))) n++;
    setReward(String(n), {});
    setRank(String(n));
  };

  if (entitled === false) {
    return (
      <div className="flex flex-col gap-4">
        <div className="inline-flex items-center gap-2 rounded-cute border-2 border-sun/40 bg-sun/10 px-3 py-2 text-xs font-bold text-sun">
          <FiLock className="size-4 shrink-0" />
          {t("這是贊助者先行版功能。到「設定 → 贊助者識別碼」輸入識別碼即可使用。")}
        </div>
        <EmptyState icon={<FiStar />}>
          {t("頭目活動編輯器:自訂頭目、傷害排行與名次獎勵(加權抽獎),用 PalDefender 的 PalSummon 檔案。")}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className={errorCls}>{error}</p>}
      {notice && <p className="rounded-xl bg-grass/10 px-3 py-2 text-[13px] font-bold text-grass">{notice}</p>}

      <div className={`${card} flex flex-col gap-2`}>
        <p className="inline-flex items-center gap-2 text-sm font-extrabold">
          <FiStar className="size-4 text-pal" /> {t("頭目活動(PalSummon)")}
          <span className="inline-flex items-center gap-1 rounded-full bg-pal/10 px-2 py-0.5 text-xs font-bold text-pal">
            <FiStar className="size-3" /> {t("贊助者")}
          </span>
        </p>
        <p className="text-xs text-ink-muted">
          {t(
            "在固定座標放一隻自訂頭目,擊敗後依傷害排行發獎。檔案存在 {dir},用 RCON summon 啟動 —— 需要 PalDefender {min} 以上。",
            { dir: SUMMONS_DIR, min: PD_MIN_VERSION.damageMeter },
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-64" value={selected ?? ""} onChange={(e) => void open(e.target.value)}>
          <option value="" disabled>
            {names?.length ? t("選一個活動…") : t("還沒有任何活動")}
          </option>
          {(names ?? []).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={() => void create()} disabled={busy}>
          <FiPlus className="size-4" /> {t("新活動")}
        </button>
        <button className={btnGhost} onClick={() => void listFiles()} aria-label={t("重新整理")}>
          <FiRefreshCw className="size-4" />
        </button>
        {selected && (
          <>
            <button
              className={`${btnGhost} inline-flex items-center gap-1.5`}
              onClick={() => setRawPath(`${SUMMONS_DIR}/${selected}`)}
            >
              <FiFileText className="size-4" /> {t("原始 JSON")}
            </button>
            <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={() => void duplicate()} disabled={busy || !enc}>
              <FiCopy className="size-4" /> {t("複製")}
            </button>
            <button className={`${btnDanger} inline-flex items-center gap-1.5`} onClick={() => void remove()} disabled={busy}>
              <FiTrash2 className="size-4" /> {t("刪除")}
            </button>
          </>
        )}
      </div>

      {!selected && (
        <EmptyState icon={<FiStar />}>
          {t("選一個活動來編輯,或按「新活動」建立一個。")}
        </EmptyState>
      )}

      {selected && enc && (
        <>
          <div className={`${card} flex flex-col gap-3`}>
            <h3 className="text-sm font-extrabold text-ink-muted">{t("基本設定")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                {t("頭目範本(PalTemplate)")}
                <input
                  className={inputCls}
                  value={enc.PalTemplate ?? ""}
                  onChange={(e) => patch({ PalTemplate: e.target.value })}
                  placeholder={t("Pals/Templates/ 底下的檔名")}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                {t("活動名稱(公告與排行榜顯示)")}
                <input
                  className={inputCls}
                  value={enc.BossBattleName ?? ""}
                  onChange={(e) => patch({ BossBattleName: e.target.value || undefined })}
                  placeholder={t("留空 = 用帕魯名稱")}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {(["X", "Y", "Z"] as const).map((axis) => (
                <label key={axis} className="flex flex-col gap-1 font-mono text-xs font-bold text-ink-muted">
                  {axis}
                  <input
                    className={`${inputCls} w-24 font-mono`}
                    type="number"
                    value={enc[axis] ?? 0}
                    onChange={(e) => patch({ [axis]: Number(e.target.value) } as Partial<PdSummonEncounter>)}
                  />
                </label>
              ))}
              <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={() => setShowMap(true)}>
                <FiMapPin className="size-4" /> {t("地圖描點")}
              </button>
              <span className="text-xs text-ink-muted">{t("Z 可用遊戲內的 getpos 取得。")}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
                <input
                  type="checkbox"
                  checked={enc.Uncapturable ?? false}
                  onChange={(e) => patch({ Uncapturable: e.target.checked || undefined })}
                />
                {t("禁止捕捉")}
              </label>
              <label className="flex items-center gap-2 text-[13px] font-bold">
                {t("可捕捉血量(%)")}
                <input
                  className={`${inputCls} w-20`}
                  type="number"
                  min={0}
                  max={100}
                  value={enc.CapturableAtHealthPercent ?? 15}
                  onChange={(e) => patch({ CapturableAtHealthPercent: Number(e.target.value) })}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
                <input
                  type="checkbox"
                  checked={enc.DisableAI ?? false}
                  onChange={(e) => patch({ DisableAI: e.target.checked || undefined })}
                />
                {t("關閉 AI")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
                <input
                  type="checkbox"
                  checked={enc.DisableDamageMeter ?? false}
                  onChange={(e) => patch({ DisableDamageMeter: e.target.checked || undefined })}
                />
                {t("關閉傷害排行")}
                <span className="text-xs font-normal text-ink-muted">{t("(改為所有在線玩家都拿預設獎勵)")}</span>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  ["SpawnScale", "體型倍率"],
                  ["HealthMultiplier", "生命倍率"],
                  ["DamageTakenMultiplier", "受傷倍率"],
                  ["DamageDealtMultiplier", "輸出倍率"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                  {t(label)}
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={enc[key] ?? 1}
                    onChange={(e) => patch({ [key]: Number(e.target.value) } as Partial<PdSummonEncounter>)}
                  />
                </label>
              ))}
            </div>

            <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
              {t("要壓制的狀態(逗號分隔,選填)")}
              <input
                className={inputCls}
                value={(enc.DisableStatuses ?? []).join(", ")}
                onChange={(e) => {
                  const list = e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  patch({ DisableStatuses: list.length ? list : undefined });
                }}
                placeholder={t("狀態名稱;PalDefender 會跳過認不出來的")}
              />
            </label>
          </div>

          <div className={`${card} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-ink-muted">{t("獎勵")}</h3>
              <button className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={addRank}>
                <FiPlus className="size-4" /> {t("加一個名次")}
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              {t("名次沒有專屬獎勵時會用「預設」;有專屬獎勵的名次不會再拿預設(是取代,不是相加)。")}
            </p>

            {ranks.length === 0 ? (
              <EmptyState icon={<FiStar />}>{t("還沒有任何獎勵。按「加一個名次」開始。")}</EmptyState>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {ranks.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                        rank === r ? "border-pal bg-pal/10 text-pal" : "border-line text-ink-muted hover:border-pal/50"
                      }`}
                      onClick={() => setRank(r)}
                    >
                      {r.toLowerCase() === PD_REWARD_DEFAULT_KEY.toLowerCase() ? t("預設") : t("第 {r} 名", { r })}
                    </button>
                  ))}
                </div>
                {enc.Rewards?.[rank] && (
                  <>
                    <RewardEditor def={enc.Rewards[rank]} onChange={(d) => setReward(rank, d)} />
                    <button
                      className={`${btnDanger} inline-flex w-fit items-center gap-1.5 text-xs`}
                      onClick={() => {
                        if (!confirm(t("要移除這個名次的獎勵嗎?"))) return;
                        setReward(rank, null);
                        setRank(ranks.find((r) => r !== rank) ?? PD_REWARD_DEFAULT_KEY);
                      }}
                    >
                      <FiTrash2 className="size-3.5" /> {t("移除這個名次")}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {issues.length > 0 && (
            <div className={`${card} flex flex-col gap-1.5`}>
              <h3 className="inline-flex items-center gap-2 text-sm font-extrabold text-ink-muted">
                <FiAlertTriangle className="size-4 text-sun" /> {t("檢查結果")}
              </h3>
              {issues.map((issue, i) => (
                <p
                  key={i}
                  className={`text-xs ${issue.level === "error" ? "font-bold text-berry" : "text-sun"}`}
                >
                  {issue.level === "error" ? t("錯誤") : t("不會生效")} · {issue.where} — {issue.message}
                </p>
              ))}
            </div>
          )}

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-cute border-2 border-line bg-card p-3 shadow-(--shadow-cute)">
            <span className="text-[13px] font-bold text-ink-muted">
              {dirty ? t("有未儲存的變更") : t("已與檔案同步")}
              {errorCount > 0 && ` · ${t("{n} 個錯誤", { n: errorCount })}`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                className={`${btnGhost} inline-flex items-center gap-1.5`}
                onClick={() => void launch()}
                disabled={busy || !running}
                title={running ? t("在伺服器上啟動這個活動") : t("伺服器未在運作中")}
              >
                <FiPlay className="size-4" /> {t("啟動活動")}
              </button>
              <button
                className={`${btn} inline-flex items-center gap-1.5`}
                onClick={() => void save()}
                disabled={busy || !dirty}
              >
                <FiSave className="size-4" /> {busy ? t("儲存中…") : t("儲存")}
              </button>
            </div>
          </div>
        </>
      )}

      {showMap && (
        <MapPickModal
          onClose={() => setShowMap(false)}
          onPick={(coords) => {
            const [px, py, pz] = coords.trim().split(/\s+/).map(Number);
            patch({
              X: Number.isFinite(px) ? px : (enc?.X ?? 0),
              Y: Number.isFinite(py) ? py : (enc?.Y ?? 0),
              ...(Number.isFinite(pz) ? { Z: pz } : {}),
            });
            setShowMap(false);
          }}
        />
      )}

      {rawPath && (
        <FileEditor
          client={client}
          instanceId={instanceId}
          path={rawPath}
          onClose={() => setRawPath(null)}
          onSaved={() => {
            setRawPath(null);
            if (selected) void open(selected);
          }}
        />
      )}
    </div>
  );
}
