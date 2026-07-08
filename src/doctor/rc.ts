import fs from "fs";
import path from "path";
import { DoctorCheck, Severity } from "./types";

export const RC_FILE = ".foundruurc";

export interface FoundruuRc {
  doctor?: {
    /** 無効化するチェックID */
    disable?: string[];
    /** チェックIDごとの severity 上書き */
    severity?: Record<string, Severity>;
    /** ドキュメント鮮度チェック(docs-freshness)のカスタマイズ */
    freshness?: {
      /** ドキュメントとみなすパス(デフォルト: ["docs"]) */
      docs?: string[];
      /** ソースとみなすパス(デフォルト: ["src", "app", "lib", "packages"]) */
      source?: string[];
      /** docs 未更新のまま許容するソース変更コミット数(デフォルト: 10) */
      maxCommits?: number;
    };
    /** --deep の採点カスタマイズ */
    deep?: {
      /** 無効化する採点観点のルールID（例: "design.api-io"）。未知のIDは無視される */
      disable?: string[];
      /** トレーサビリティ検証の設定 */
      trace?: {
        /** 設計との突き合わせから除外するパターン（glob。デフォルト除外に追加される） */
        exclude?: string[];
      };
    };
  };
}

/** .foundruurc を読み込む。存在しなければ空設定を返す */
export function readRc(cwd: string): FoundruuRc {
  const file = path.join(cwd, RC_FILE);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as FoundruuRc;
  } catch (err) {
    throw new Error(`${RC_FILE} の JSON が不正です: ${(err as Error).message}`);
  }
}

/** .foundruurc の設定をチェックルールへ適用する */
export function applyRc(checks: DoctorCheck[], rc: FoundruuRc): DoctorCheck[] {
  const disabled = new Set(rc.doctor?.disable ?? []);
  const severity = rc.doctor?.severity ?? {};
  return checks
    .filter((c) => !disabled.has(c.id))
    .map((c) => (severity[c.id] ? { ...c, severity: severity[c.id] } : c));
}
