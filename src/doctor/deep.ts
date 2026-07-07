import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * DevDoctor (Ruu5LP/DevDoctor) のスコアリングルールを移植した diff ベース品質診断。
 * docs/ と .ai/sessions/ のドキュメントを分析し、AI開発プロセスの品質をスコア化する。
 */

export type DocCategory = "requirements" | "design" | "plan" | "test" | "aiInstructions";

export interface DeepRule {
  category: DocCategory;
  label: string;
  pattern: RegExp;
  improvement: string;
}

export interface CategoryScore {
  category: DocCategory;
  label: string;
  docPath?: string;
  score: number;
  failed: { label: string; improvement: string }[];
}

export interface DeepReport {
  since: string;
  diff: { files: number; insertions: number; deletions: number };
  scores: CategoryScore[];
  overall: number;
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  requirements: "要件品質",
  design: "設計品質",
  plan: "計画品質",
  test: "テスト品質",
  aiInstructions: "AI指示品質",
};

// カテゴリ判定はファイル名(basename)に対して行う。よくある別名も拾えるよう広めに取る。
// 上から順にマッチを試すため、より具体的なもの(aiInstructions)を先に置く。
const CATEGORY_PATTERNS: { category: DocCategory; pattern: RegExp }[] = [
  {
    category: "aiInstructions",
    pattern: /ai[-_]?instructions?|claude|codex|agents?|copilot|cursor|prompt|指示/i,
  },
  {
    category: "requirements",
    pattern: /requirement|spec|specification|prd|user[-_ ]?stor|要件|仕様/i,
  },
  { category: "design", pattern: /design|architecture|adr|設計|アーキ/i },
  { category: "test", pattern: /test|testing|qa|テスト|検証/i },
  { category: "plan", pattern: /tasks?|plan|todo|タスク|計画/i },
];

/** DevDoctor rules.ts 由来のキーワードルール */
export const deepRules: DeepRule[] = [
  {
    category: "requirements",
    label: "何を作るかが明確",
    pattern: /目的|概要|ゴール|goal|purpose|やること/i,
    improvement: "目的・概要・ゴールのセクションを追加する",
  },
  {
    category: "requirements",
    label: "何を作らないかが明確",
    pattern: /やらないこと|対象外|スコープ外|非対象|out of scope|non-goals?/i,
    improvement: "対象外・非ゴールを明記し、AIの作業範囲が膨らまないようにする",
  },
  {
    category: "requirements",
    label: "正常系がある",
    pattern: /正常系|happy path|基本フロー/i,
    improvement: "代表的な正常系シナリオを箇条書きで追記する",
  },
  {
    category: "requirements",
    label: "異常系がある",
    pattern: /異常系|エラー|exception|error case/i,
    improvement: "エラー時のレスポンスと画面表示を定義する",
  },
  {
    category: "requirements",
    label: "権限条件がある",
    pattern: /権限|ロール|role|permission|アクセス制御/i,
    improvement: "誰がこの機能を使えるか(ロール・権限)を明記する",
  },
  {
    category: "requirements",
    label: "完了条件が検証可能",
    pattern: /完了条件|done条件|完了基準|definition of done|受け入れ条件|acceptance criteria/i,
    improvement: "誰が見ても判定できる完了条件を箇条書きで定義する",
  },
  {
    category: "design",
    label: "変更対象が書かれている",
    pattern: /変更対象|対象ファイル|変更点|変更内容/i,
    improvement: "変更対象のファイル・モジュールを列挙する",
  },
  {
    category: "design",
    label: "既存仕様への影響がある",
    pattern: /既存|影響|impact|互換性/i,
    improvement: "既存機能への影響と互換性を明記する",
  },
  {
    category: "design",
    label: "API入出力がある",
    pattern: /api|エンドポイント|リクエスト|レスポンス|入出力/i,
    improvement: "エンドポイントの入出力仕様を書く",
  },
  {
    category: "design",
    label: "エラーケースがある",
    pattern: /エラー|失敗|error|failure/i,
    improvement: "失敗時の挙動・エラーハンドリング方針を書く",
  },
  {
    category: "design",
    label: "ロールバック方針がある",
    pattern: /ロールバック|rollback|切り戻し/i,
    improvement: "問題発生時の切り戻し手順を書く",
  },
  {
    category: "design",
    label: "処理フローが説明されている",
    pattern: /フロー|流れ|シーケンス|flow|sequence/i,
    improvement: "主要な処理の流れを図または箇条書きで書く",
  },
  {
    category: "plan",
    label: "タスクが分解されている",
    pattern: /- \[[ x]\]|実装タスク|タスク一覧|task list/i,
    improvement: "実行可能な単位のタスクへチェックリスト形式で分解する",
  },
  {
    category: "plan",
    label: "依存関係・順序がある",
    pattern: /依存|順序|ブロッカー|並行|depends?|order|blocker/i,
    improvement: "タスク同士の依存関係と着手順序を明記する",
  },
  {
    category: "plan",
    label: "リスク・懸念がある",
    pattern: /リスク|懸念|不確実|risk|concern/i,
    improvement: "不確実な点・うまくいかない可能性がある箇所を書き出す",
  },
  {
    category: "plan",
    label: "完了条件がある",
    pattern: /完了条件|done条件|完了基準|definition of done|受け入れ条件|acceptance criteria/i,
    improvement: "何をもって完了とみなすかを検証可能な形で書く",
  },
  {
    category: "test",
    label: "正常系",
    pattern: /正常系|happy path/i,
    improvement: "正常系のテスト観点を追記する",
  },
  {
    category: "test",
    label: "異常系",
    pattern: /異常系|エラー|error case/i,
    improvement: "異常系のテスト観点を追記する",
  },
  {
    category: "test",
    label: "境界値",
    pattern: /境界値|boundary/i,
    improvement: "境界値のテスト観点を追記する",
  },
  {
    category: "test",
    label: "既存機能への影響",
    pattern: /既存機能|regression|デグレ|回帰/i,
    improvement: "リグレッション確認の観点を追記する",
  },
  {
    category: "test",
    label: "手動確認項目",
    pattern: /手動確認|manual check|手動テスト/i,
    improvement: "手動で確認すべき項目を列挙する",
  },
  {
    category: "test",
    label: "実行したテストコマンド",
    pattern: /npm test|vitest|pytest|phpunit|artisan test|実行コマンド/i,
    improvement: "テストの実行コマンドを明記する",
  },
  {
    category: "aiInstructions",
    label: "目的が明確",
    pattern: /目的|purpose|goal/i,
    improvement: "AI指示に目的を明記する",
  },
  {
    category: "aiInstructions",
    label: "変更範囲が限定されている",
    pattern: /変更範囲|対象範囲|scope|対象ファイル/i,
    improvement: "AIが触ってよい範囲を限定する",
  },
  {
    category: "aiInstructions",
    label: "禁止事項がある",
    pattern: /禁止|しない|never|don'?t|やらない/i,
    improvement: "やってはいけないことを明記する",
  },
  {
    category: "aiInstructions",
    label: "参照ファイルが指定されている",
    pattern: /参照|reference|該当ファイル|ファイルパス/i,
    improvement: "参照すべきファイル・ドキュメントを指定する",
  },
  {
    category: "aiInstructions",
    label: "完了条件がある",
    pattern: /完了条件|done|完了基準/i,
    improvement: "AIタスクの完了条件を定義する",
  },
];

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" }).toString();
}

function collectDiff(cwd: string, since: string): DeepReport["diff"] {
  const base = git(cwd, ["merge-base", since, "HEAD"]).trim();
  const numstat = git(cwd, ["diff", "--numstat", base]);
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of numstat.split("\n")) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (!m) continue;
    files += 1;
    if (m[1] !== "-") insertions += Number(m[1]);
    if (m[2] !== "-") deletions += Number(m[2]);
  }
  return { files, insertions, deletions };
}

/** docs/ ・リポジトリ直下・最新の .ai/sessions/ からカテゴリ別ドキュメントを収集する */
export function scanDocs(cwd: string): Map<DocCategory, { path: string; content: string }> {
  const candidates: string[] = [];
  for (const dir of ["docs", "doc", "."]) {
    const abs = path.join(cwd, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
        candidates.push(path.join(dir === "." ? "" : dir, entry.name));
      }
    }
  }
  // 最新セッション(mtime 順)のドキュメントも対象にする
  const sessionsDir = path.join(cwd, ".ai", "sessions");
  if (fs.existsSync(sessionsDir)) {
    const sessions = fs
      .readdirSync(sessionsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(sessionsDir, e.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (sessions.length > 0) {
      const latest = path.join(".ai", "sessions", sessions[0].name);
      for (const f of fs.readdirSync(path.join(cwd, latest))) {
        if (/\.md$/i.test(f)) candidates.push(path.join(latest, f));
      }
    }
  }

  const found = new Map<DocCategory, { path: string; content: string }>();
  for (const relPath of candidates) {
    const category = CATEGORY_PATTERNS.find((p) =>
      p.pattern.test(path.basename(relPath))
    )?.category;
    if (!category || found.has(category)) continue;
    const content = fs.readFileSync(path.join(cwd, relPath), "utf8");
    if (content.trim().length > 0) found.set(category, { path: relPath, content });
  }
  return found;
}

export function runDeepDoctor(cwd: string, since: string): DeepReport {
  const diff = collectDiff(cwd, since);
  const docs = scanDocs(cwd);

  const scores: CategoryScore[] = (Object.keys(CATEGORY_LABELS) as DocCategory[]).map(
    (category) => {
      const doc = docs.get(category);
      const rules = deepRules.filter((r) => r.category === category);
      if (!doc) {
        return {
          category,
          label: CATEGORY_LABELS[category],
          score: 0,
          failed: [
            {
              label: `${category} ドキュメントが見つからない`,
              improvement: `docs/ または .ai/sessions/<session>/ に ${category}.md を作成する`,
            },
          ],
        };
      }
      const failed = rules
        .filter((r) => !r.pattern.test(doc.content))
        .map((r) => ({ label: r.label, improvement: r.improvement }));
      return {
        category,
        label: CATEGORY_LABELS[category],
        docPath: doc.path,
        score: Math.round(((rules.length - failed.length) / rules.length) * 100),
        failed,
      };
    }
  );

  // 該当ドキュメントが存在しないカテゴリ(docPath なし)は「未計測」とし、総合スコアに算入しない。
  // 「ドキュメントの有無」は基本の doctor が見る領域で、--deep は「ある文書の中身の質」を測るため、
  // 文書が無いことを 0 点として二重に減点しない(well-documented でも 0 点になる問題の対策)。
  const measured = scores.filter((s) => s.docPath !== undefined);
  const overall = measured.length
    ? Math.round(measured.reduce((sum, s) => sum + s.score, 0) / measured.length)
    : 0;
  return { since, diff, scores, overall };
}
