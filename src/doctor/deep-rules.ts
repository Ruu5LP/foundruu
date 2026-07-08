/**
 * DevDoctor (Ruu5LP/DevDoctor) のスコアリングルールを移植したルール定義。
 * カテゴリ分類・採点キーワードのみを持ち、診断ロジックは deep.ts 側にある。
 */

export type DocCategory = "requirements" | "design" | "plan" | "test" | "aiInstructions";

export interface DeepRule {
  category: DocCategory;
  /** .foundruurc の doctor.deep.disable で指定する安定 ID（カテゴリ.スラッグ） */
  id: string;
  label: string;
  pattern: RegExp;
  improvement: string;
}

/** 採点カテゴリの表示名 */
export const CATEGORY_LABELS: Record<DocCategory, string> = {
  requirements: "要件品質",
  design: "設計品質",
  plan: "計画品質",
  test: "テスト品質",
  aiInstructions: "AI指示品質",
};

// カテゴリ判定はファイル名(basename)に対して行う。よくある別名も拾えるよう広めに取る。
// 上から順にマッチを試すため、より具体的なもの(aiInstructions)を先に置く。
export const CATEGORY_PATTERNS: { category: DocCategory; pattern: RegExp }[] = [
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
    id: "requirements.goal",
    label: "何を作るかが明確",
    pattern: /目的|概要|ゴール|goal|purpose|やること/i,
    improvement: "目的・概要・ゴールのセクションを追加する",
  },
  {
    category: "requirements",
    id: "requirements.non-goals",
    label: "何を作らないかが明確",
    pattern: /やらないこと|対象外|スコープ外|非対象|out of scope|non-goals?/i,
    improvement: "対象外・非ゴールを明記し、AIの作業範囲が膨らまないようにする",
  },
  {
    category: "requirements",
    id: "requirements.happy-path",
    label: "正常系がある",
    pattern: /正常系|happy path|基本フロー/i,
    improvement: "代表的な正常系シナリオを箇条書きで追記する",
  },
  {
    category: "requirements",
    id: "requirements.error-cases",
    label: "異常系がある",
    pattern: /異常系|エラー|exception|error case/i,
    improvement: "エラー時のレスポンスと画面表示を定義する",
  },
  {
    category: "requirements",
    id: "requirements.permissions",
    label: "権限条件がある",
    pattern: /権限|ロール|role|permission|アクセス制御/i,
    improvement: "誰がこの機能を使えるか(ロール・権限)を明記する",
  },
  {
    category: "requirements",
    id: "requirements.acceptance-criteria",
    label: "完了条件が検証可能",
    pattern: /完了条件|done条件|完了基準|definition of done|受け入れ条件|acceptance criteria/i,
    improvement: "誰が見ても判定できる完了条件を箇条書きで定義する",
  },
  {
    category: "design",
    id: "design.change-targets",
    label: "変更対象が書かれている",
    pattern: /変更対象|対象ファイル|変更点|変更内容/i,
    improvement: "変更対象のファイル・モジュールを列挙する",
  },
  {
    category: "design",
    id: "design.existing-impact",
    label: "既存仕様への影響がある",
    pattern: /既存|影響|impact|互換性/i,
    improvement: "既存機能への影響と互換性を明記する",
  },
  {
    category: "design",
    id: "design.api-io",
    label: "API入出力がある",
    pattern: /api|エンドポイント|リクエスト|レスポンス|入出力/i,
    improvement: "エンドポイントの入出力仕様を書く",
  },
  {
    category: "design",
    id: "design.error-handling",
    label: "エラーケースがある",
    pattern: /エラー|失敗|error|failure/i,
    improvement: "失敗時の挙動・エラーハンドリング方針を書く",
  },
  {
    category: "design",
    id: "design.rollback",
    label: "ロールバック方針がある",
    pattern: /ロールバック|rollback|切り戻し/i,
    improvement: "問題発生時の切り戻し手順を書く",
  },
  {
    category: "design",
    id: "design.flow",
    label: "処理フローが説明されている",
    pattern: /フロー|流れ|シーケンス|flow|sequence/i,
    improvement: "主要な処理の流れを図または箇条書きで書く",
  },
  {
    category: "plan",
    id: "plan.task-breakdown",
    label: "タスクが分解されている",
    pattern: /- \[[ x]\]|実装タスク|タスク一覧|task list/i,
    improvement: "実行可能な単位のタスクへチェックリスト形式で分解する",
  },
  {
    category: "plan",
    id: "plan.dependencies",
    label: "依存関係・順序がある",
    pattern: /依存|順序|ブロッカー|並行|depends?|order|blocker/i,
    improvement: "タスク同士の依存関係と着手順序を明記する",
  },
  {
    category: "plan",
    id: "plan.risks",
    label: "リスク・懸念がある",
    pattern: /リスク|懸念|不確実|risk|concern/i,
    improvement: "不確実な点・うまくいかない可能性がある箇所を書き出す",
  },
  {
    category: "plan",
    id: "plan.done-criteria",
    label: "完了条件がある",
    pattern: /完了条件|done条件|完了基準|definition of done|受け入れ条件|acceptance criteria/i,
    improvement: "何をもって完了とみなすかを検証可能な形で書く",
  },
  {
    category: "test",
    id: "test.happy-path",
    label: "正常系",
    pattern: /正常系|happy path/i,
    improvement: "正常系のテスト観点を追記する",
  },
  {
    category: "test",
    id: "test.error-cases",
    label: "異常系",
    pattern: /異常系|エラー|error case/i,
    improvement: "異常系のテスト観点を追記する",
  },
  {
    category: "test",
    id: "test.boundary",
    label: "境界値",
    pattern: /境界値|boundary/i,
    improvement: "境界値のテスト観点を追記する",
  },
  {
    category: "test",
    id: "test.regression",
    label: "既存機能への影響",
    pattern: /既存機能|regression|デグレ|回帰/i,
    improvement: "リグレッション確認の観点を追記する",
  },
  {
    category: "test",
    id: "test.manual-checks",
    label: "手動確認項目",
    pattern: /手動確認|manual check|手動テスト/i,
    improvement: "手動で確認すべき項目を列挙する",
  },
  {
    category: "test",
    id: "test.test-commands",
    label: "実行したテストコマンド",
    pattern: /npm test|vitest|pytest|phpunit|artisan test|実行コマンド/i,
    improvement: "テストの実行コマンドを明記する",
  },
  {
    category: "aiInstructions",
    id: "ai-instructions.goal",
    label: "目的が明確",
    pattern: /目的|purpose|goal/i,
    improvement: "AI指示に目的を明記する",
  },
  {
    category: "aiInstructions",
    id: "ai-instructions.scope",
    label: "変更範囲が限定されている",
    pattern: /変更範囲|対象範囲|scope|対象ファイル/i,
    improvement: "AIが触ってよい範囲を限定する",
  },
  {
    category: "aiInstructions",
    id: "ai-instructions.prohibitions",
    label: "禁止事項がある",
    pattern: /禁止|しない|never|don'?t|やらない/i,
    improvement: "やってはいけないことを明記する",
  },
  {
    category: "aiInstructions",
    id: "ai-instructions.references",
    label: "参照ファイルが指定されている",
    pattern: /参照|reference|該当ファイル|ファイルパス/i,
    improvement: "参照すべきファイル・ドキュメントを指定する",
  },
  {
    category: "aiInstructions",
    id: "ai-instructions.done-criteria",
    label: "完了条件がある",
    pattern: /完了条件|done|完了基準/i,
    improvement: "AIタスクの完了条件を定義する",
  },
];
