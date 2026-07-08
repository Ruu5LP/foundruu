import fs from "fs";
import path from "path";

/**
 * セッション成果物(requirements / summary)から CHANGELOG エントリの下書きを生成する。
 * リリース時に「何をやったか」をセッションから掘り返す手間をなくすため、
 * session end の時点で材料をまとめておく。
 */

/** 見出し・空行を除いた最初の本文行を返す(テンプレート未記入なら undefined) */
function firstBodyLine(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("<!--") || t.startsWith(">")) continue;
    return t.replace(/^[-*]\s+/, "");
  }
  return undefined;
}

function readIfExists(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

/** セッションディレクトリから CHANGELOG 下書き(Markdown)を生成する */
export function renderChangelogDraft(name: string, sessionDir: string): string {
  const requirements = readIfExists(path.join(sessionDir, "requirements.md"));
  const summary = readIfExists(path.join(sessionDir, "summary.md"));

  // 要約は summary.md を優先し、無ければ要件の冒頭を使う
  const headline = firstBodyLine(summary) ?? firstBodyLine(requirements) ?? "（要約を記入）";

  // 達成した受け入れ条件(AC-n)を列挙し、リリースノートの粒度の材料にする
  const acLines = requirements
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\bAC-\d+\b/.test(l))
    .map((l) => l.replace(/^[-*]\s+(\[[ x]\]\s+)?/, ""));

  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    "<!-- foundruu session end が生成した CHANGELOG 下書きです。",
    "     分類(Added/Changed/Fixed)と文面を整えて CHANGELOG.md の Unreleased へ転記してください。 -->",
    "",
    `### Added <!-- または Changed / Fixed -->`,
    "",
    `- **${name}**: ${headline}（${date}）`,
  ];
  if (acLines.length > 0) {
    lines.push(...acLines.map((l) => `  - ${l}`));
  }
  lines.push("");
  return lines.join("\n");
}
