import { useEffect, useState } from "react";
import { FiStar, FiLock, FiX, FiSearch, FiTrash2, FiNavigation, FiSkipForward } from "react-icons/fi";
import { hasFeature, PD_MIN_VERSION } from "@palserver/shared";
import type { AgentClient } from "./api";
import { t, useI18n } from "./i18n";
import { Overlay, btn, btnDanger, btnGhost, card, errorCls, inputCls, Select } from "./ui";

/**
 * 閒置據點清理(贊助者先行版 pd-findbases)。轉送 PalDefender 的 `/findbases`
 * (需 1.9.0 以上)—— 它是有狀態的佇列:先用過濾條件建立,再 visit / next / kill。
 *
 * PalDefender 的輸出格式沒有官方文件也沒有真機樣本,所以這裡「不解析」,
 * 原樣顯示回傳文字。等有真機輸出再考慮做成清單。
 */

type Filter = "empty" | "inactive" | "unused" | "all";

const FILTER_LABELS: Record<Filter, string> = {
  empty: "空的據點(empty)",
  inactive: "閒置太久(inactive)",
  unused: "建築數過少(unused)",
  all: "全部(all)",
};

interface Entry {
  command: string;
  output: string;
}

export function FindBasesModal({
  client,
  instanceId,
  onClose,
}: {
  client: AgentClient;
  instanceId: string;
  onClose: () => void;
}) {
  useI18n();
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<Filter>("inactive");
  const [days, setDays] = useState("");
  const [builds, setBuilds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<Entry[]>([]);

  useEffect(() => {
    client
      .license()
      .then((l) => setEntitled(hasFeature("pd-findbases", l)))
      .catch(() => setEntitled(false));
  }, [client]);

  const locked = entitled === false;

  const run = async (argv: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await client.findBases(instanceId, argv);
      setLog((prev) => [{ command: `findbases ${argv}`.trim(), output: res.output || t("(沒有輸出)") }, ...prev].slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const buildQueue = () => {
    const parts: string[] = [filter];
    const d = days.trim();
    const b = builds.trim();
    if (d !== "") parts.push(`days=${Number(d)}`);
    if (b !== "") parts.push(`builds<=${Number(b)}`);
    void run(parts.join(" "));
  };

  const kill = (thenNext: boolean) => {
    const argv = thenNext ? "kill next" : "kill";
    if (
      !confirm(
        t("摧毀據點無法復原。\n\n確定要執行 findbases {argv} 嗎?", { argv }),
      )
    ) {
      return;
    }
    void run(argv);
  };

  return (
    <Overlay onClose={onClose}>
      <div
        className={`${card} flex max-h-[86vh] w-180 max-w-full flex-col gap-3 overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-extrabold">
            <FiSearch className="size-5 text-pal" /> {t("閒置據點清理")}
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
          {t(
            "找出沒人管的據點並清掉,減輕伺服器負擔。這是 PalDefender {min} 的佇列式指令:先建立佇列,再逐個前往或摧毀 —— 傳送與摧毀依 PalDefender 的行為對執行 RCON 的管理員生效。",
            { min: PD_MIN_VERSION.findBases },
          )}
        </p>

        <div className={locked ? "pointer-events-none flex flex-col gap-3 opacity-55" : "flex flex-col gap-3"}>
          <div className="flex flex-col gap-2 rounded-cute border-2 border-line p-3">
            <span className="text-xs font-bold text-ink-muted">{t("一、建立佇列")}</span>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                {t("條件")}
                <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                    <option key={f} value={f}>
                      {t(FILTER_LABELS[f])}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                {t("閒置天數(選填)")}
                <input
                  className={`${inputCls} w-28`}
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
                {t("建築數上限(選填)")}
                <input
                  className={`${inputCls} w-28`}
                  type="number"
                  min="0"
                  value={builds}
                  onChange={(e) => setBuilds(e.target.value)}
                  placeholder="5"
                />
              </label>
              <button className={`${btn} inline-flex items-center gap-1.5`} onClick={buildQueue} disabled={busy}>
                <FiSearch className="size-4" /> {busy ? t("執行中…") : t("尋找")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-cute border-2 border-line p-3">
            <span className="text-xs font-bold text-ink-muted">{t("二、逐個處理")}</span>
            <div className="flex flex-wrap gap-2">
              <button
                className={`${btnGhost} inline-flex items-center gap-1.5`}
                onClick={() => void run("visit")}
                disabled={busy}
              >
                <FiNavigation className="size-4" /> {t("前往目前這個")}
              </button>
              <button
                className={`${btnGhost} inline-flex items-center gap-1.5`}
                onClick={() => void run("next")}
                disabled={busy}
              >
                <FiSkipForward className="size-4" /> {t("下一個")}
              </button>
              <button
                className={`${btnDanger} inline-flex items-center gap-1.5`}
                onClick={() => kill(false)}
                disabled={busy}
              >
                <FiTrash2 className="size-4" /> {t("摧毀")}
              </button>
              <button
                className={`${btnDanger} inline-flex items-center gap-1.5`}
                onClick={() => kill(true)}
                disabled={busy}
              >
                <FiTrash2 className="size-4" /> {t("摧毀並前往下一個")}
              </button>
            </div>
          </div>
        </div>

        {error && <p className={errorCls}>{error}</p>}

        {log.length > 0 && (
          <div className="flex min-h-0 flex-col gap-1.5">
            <span className="text-xs font-bold text-ink-muted">{t("PalDefender 的回應(原文)")}</span>
            {log.map((entry, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="font-mono text-xs text-pal">&gt; {entry.command}</span>
                <pre className="max-h-64 overflow-auto rounded-xl bg-[#1c1927] p-3 font-mono text-xs whitespace-pre-wrap break-all text-[#cfd6df]">
                  {entry.output}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
