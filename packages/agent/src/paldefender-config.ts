import fs from "node:fs";
import path from "node:path";
import {
  PALDEFENDER_OPTIONS,
  PD_MOTD_MAX_LINES,
  type PalDefenderConfig,
  type PalDefenderConfigPatch,
  type PalDefenderConfigStatus,
  type PdOptionKey,
  type PdOptionMeta,
} from "@palserver/shared";
import type { DriverContext } from "./driver.js";
import type { InstanceRecord } from "./store.js";
import { serverPlatform } from "./platform.js";
import { serverRoot } from "./native.js";
import * as dockerOps from "./docker.js";
import { execInPod } from "./k8s-files.js";
import { getPdDir } from "./paldefender-rest.js";

/** 取巢狀設定的子物件(PalDefender 1.9 的 `PalWebhooks`);不存在或型別不符時當空物件。 */
function subObject(raw: Record<string, unknown>, group: string): Record<string, unknown> {
  const v = raw[group];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** MOTD 可能寫成 "MOTD"(官方)或 "motd";讀取兩者,只取字串成員。 */
function readMotd(raw: Record<string, unknown>): string[] {
  const v = raw["MOTD"] ?? raw["motd"];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function readConfigJson(rec: InstanceRecord, file: string): Promise<string | null> {
  if (rec.backend === "native") {
    try { return fs.readFileSync(file, "utf8"); } catch { return null; }
  }
  if (rec.backend === "docker") {
    try { return await dockerOps.execInContainer(rec, ["cat", file]); } catch { return null; }
  }
  try { return await execInPod(rec, ["cat", file]); } catch { return null; }
}

async function writeConfigJson(rec: InstanceRecord, file: string, content: string): Promise<void> {
  if (rec.backend === "native") {
    fs.writeFileSync(file, content);
    return;
  }
  if (rec.backend === "docker") {
    const b64 = Buffer.from(content, "utf8").toString("base64");
    await dockerOps.execInContainer(rec, ["sh", "-c", `echo '${b64}' | base64 -d > '${file}'`]);
    return;
  }
  const b64 = Buffer.from(content, "utf8").toString("base64");
  await execInPod(rec, ["sh", "-c", `echo '${b64}' | base64 -d > '${file}'`]);
}

export async function getPalDefenderConfig(rec: InstanceRecord, ctx: DriverContext): Promise<PalDefenderConfigStatus> {
  if (serverPlatform(rec) !== "windows") {
    return { supported: false, reason: "PalDefender 設定僅支援 Windows 伺服器", exists: false, values: {}, motd: [] };
  }
  const dir = await getPdDir(rec, ctx);
  if (!dir) {
    return { supported: false, reason: "尚未安裝 PalDefender,或伺服器尚未啟動過以生成設定檔", exists: false, values: {}, motd: [] };
  }
  const file = `${dir}/Config.json`;
  const raw_str = await readConfigJson(rec, file);
  if (!raw_str) {
    return { supported: true, exists: false, reason: "Config.json 尚未生成 — 啟動一次伺服器即會產生", values: {}, motd: [] };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(raw_str);
  } catch {
    return { supported: true, exists: true, reason: "Config.json 無法解析(格式損壞)", values: {}, motd: [] };
  }

  const values: PalDefenderConfig = {};
  for (const key of Object.keys(PALDEFENDER_OPTIONS) as PdOptionKey[]) {
    const meta: PdOptionMeta = PALDEFENDER_OPTIONS[key];
    const v = (meta.group ? subObject(raw, meta.group) : raw)[key];
    if (meta.type === "bool" && typeof v === "boolean") values[key] = v;
    else if ((meta.type === "int" || meta.type === "float") && typeof v === "number") values[key] = v;
    else if (meta.type === "string" && typeof v === "string") values[key] = v;
  }
  return { supported: true, exists: true, values, motd: readMotd(raw) };
}

export async function writePalDefenderConfig(
  rec: InstanceRecord,
  ctx: DriverContext,
  patch: PalDefenderConfigPatch,
): Promise<PalDefenderConfigStatus> {
  const dir = await getPdDir(rec, ctx);
  if (!dir) throw Object.assign(new Error("找不到 PalDefender 目錄"), { statusCode: 409 });
  const file = `${dir}/Config.json`;

  let raw: Record<string, unknown> = {};
  const existing = await readConfigJson(rec, file);
  if (existing) {
    try {
      raw = JSON.parse(existing);
    } catch {
      throw Object.assign(new Error("Config.json 格式損壞,無法安全寫入"), { statusCode: 409 });
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    const meta: PdOptionMeta | undefined = PALDEFENDER_OPTIONS[key as PdOptionKey];
    if (!meta) continue;
    let target = raw;
    if (meta.group) {
      const existingGroup = raw[meta.group];
      target =
        existingGroup && typeof existingGroup === "object" && !Array.isArray(existingGroup)
          ? (existingGroup as Record<string, unknown>)
          : {};
      raw[meta.group] = target;
    }
    target[key] =
      meta.type === "int" ? Math.trunc(Number(value))
      : meta.type === "string" ? String(value ?? "")
      : value;
  }
  if (Array.isArray(patch.motd)) {
    const motdKey = "motd" in raw && !("MOTD" in raw) ? "motd" : "MOTD";
    raw[motdKey] = patch.motd.map((l) => String(l)).slice(0, PD_MOTD_MAX_LINES);
  }
  await writeConfigJson(rec, file, JSON.stringify(raw, null, 4));
  return await getPalDefenderConfig(rec, ctx);
}
