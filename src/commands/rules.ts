import fs from "fs";
import path from "path";
import { log } from "../core/logger";
import { requireAiRoot } from "../core/session-store";

/**
 * レビュー指摘の規約化。
 * 「同じ指摘を繰り返さない」ため、レビューで出た指摘を .ai/rules/ のルールファイルへ
 * 1コマンドで追記し、人とAIの両方が次回から参照できるようにする。
 */

const DEFAULT_RULES_FILE = "review-feedback.md";

const FILE_HEADER = `# レビュー指摘から昇格した規約

レビューで指摘された内容を再発防止のため規約化したものです。
\`foundruu rules add "<指摘内容>"\` で追記されます。実装・レビュー前に必ず読んでください。
`;

function rulesFile(cwd: string, file?: string): string {
  const root = requireAiRoot(cwd);
  const name = file ?? DEFAULT_RULES_FILE;
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`ルールファイル名にパス区切りは使えません: ${name}`);
  }
  return path.join(root, ".ai", "rules", name.endsWith(".md") ? name : `${name}.md`);
}

/** レビュー指摘等を規約として .ai/rules へ追記する。初回はヘッダー付きで作成 */
export function addRule(cwd: string, text: string, options: { file?: string } = {}): void {
  if (!text.trim()) {
    throw new Error("追加する規約の内容を指定してください。");
  }
  const file = rulesFile(cwd, options.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const exists = fs.existsSync(file);
  const date = new Date().toISOString().slice(0, 10);
  const entry = `- ${text.trim()}（${date} 追加）\n`;
  fs.appendFileSync(file, (exists ? "" : FILE_HEADER + "\n") + entry);
  const rel = path.relative(cwd, file);
  log.success(`規約を追加しました: ${rel}`);
  log.info(`  ${entry.trim()}`);
}

/** .ai/rules 配下のルールファイルと規約件数を表示する */
export function listRules(cwd: string): void {
  const root = requireAiRoot(cwd);
  const dir = path.join(root, ".ai", "rules");
  if (!fs.existsSync(dir)) {
    log.info(".ai/rules はまだありません。foundruu rules add で作成できます。");
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) {
    log.info(".ai/rules にルールファイルはありません。");
    return;
  }
  log.info("ルールファイル (.ai/rules/):");
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), "utf8");
    const rules = content.split("\n").filter((l) => l.startsWith("- ")).length;
    log.info(`  - ${f}（${rules} 件）`);
  }
}
