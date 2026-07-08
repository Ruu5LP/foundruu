import fs from "fs";
import path from "path";
import { checks as defaultChecks } from "./checks";
import { applyRc, readRc } from "./rc";
import { CheckResult, DoctorCheck, DoctorContext, DoctorReport, FixReport } from "./types";

/** チェック関数へ渡す実行コンテキスト(存在確認ヘルパー付き)を作る */
export function createContext(cwd: string): DoctorContext {
  const exists = (rel: string): boolean => fs.existsSync(path.join(cwd, rel));
  return {
    cwd,
    exists,
    existsAny: (rels) => rels.some(exists),
  };
}

/** 全チェックを実行して集計する。.foundruurc の無効化・severity 上書きを適用済み */
export function runDoctor(cwd: string, checkList: DoctorCheck[] = defaultChecks): DoctorReport {
  const ctx = createContext(cwd);
  const effective = applyRc(checkList, readRc(cwd));
  const results: CheckResult[] = effective.map((check) => {
    const passed = check.check(ctx);
    const status = passed ? "pass" : check.severity === "error" ? "fail" : "warn";
    return {
      id: check.id,
      label: check.label,
      category: check.category,
      status,
      ...(passed ? {} : { hint: check.hint }),
    };
  });

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;
  return { results, passed, warned, failed, ok: failed === 0 };
}

/**
 * 失敗しているチェックのうち fix を持つものを自動生成する(--fix)。
 * .foundruurc で無効化されたチェックは対象外(applyRc が除外する)。
 */
export function runDoctorFix(cwd: string, checkList: DoctorCheck[] = defaultChecks): FixReport {
  const ctx = createContext(cwd);
  const effective = applyRc(checkList, readRc(cwd));
  const fixed: FixReport["fixed"] = [];
  const unfixable: FixReport["unfixable"] = [];
  for (const check of effective) {
    if (check.check(ctx)) continue; // pass しているものは触らない
    if (check.fix) {
      fixed.push({ label: check.label, message: check.fix(ctx) });
    } else {
      unfixable.push({ label: check.label, hint: check.hint });
    }
  }
  return { fixed, unfixable };
}
