export type Severity = "error" | "warn";
export type CheckStatus = "pass" | "warn" | "fail";

export interface DoctorContext {
  cwd: string;
  /** cwd からの相対パスで存在確認する */
  exists(relPath: string): boolean;
  /** glob 的な簡易マッチ: ディレクトリ内にパターンに合うファイルがあるか */
  existsAny(relPaths: string[]): boolean;
}

export interface DoctorCheck {
  id: string;
  label: string;
  category: string;
  severity: Severity;
  /** 見つからなかったときの修正ガイド */
  hint: string;
  check(ctx: DoctorContext): boolean;
}

export interface CheckResult {
  id: string;
  label: string;
  category: string;
  status: CheckStatus;
  hint?: string;
}

export interface DoctorReport {
  results: CheckResult[];
  passed: number;
  warned: number;
  failed: number;
  ok: boolean;
}
