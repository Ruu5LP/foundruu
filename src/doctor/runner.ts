import fs from "fs";
import path from "path";
import { checks as defaultChecks } from "./checks";
import { CheckResult, DoctorCheck, DoctorContext, DoctorReport } from "./types";

export function createContext(cwd: string): DoctorContext {
  const exists = (rel: string): boolean => fs.existsSync(path.join(cwd, rel));
  return {
    cwd,
    exists,
    existsAny: (rels) => rels.some(exists),
  };
}

export function runDoctor(cwd: string, checkList: DoctorCheck[] = defaultChecks): DoctorReport {
  const ctx = createContext(cwd);
  const results: CheckResult[] = checkList.map((c) => {
    const ok = c.check(ctx);
    const status = ok ? "pass" : c.severity === "error" ? "fail" : "warn";
    return {
      id: c.id,
      label: c.label,
      category: c.category,
      status,
      ...(ok ? {} : { hint: c.hint }),
    };
  });

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;
  return { results, passed, warned, failed, ok: failed === 0 };
}
