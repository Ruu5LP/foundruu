export interface TemplateDefinition {
  id: string;
  label: string;
  status: "available" | "planned";
  /** assets/templates/languages/<language> を使用する */
  language: string;
  languageLabel: string;
  /** assets/templates/features/<id> を合成する */
  features: string[];
  aiProviders: string[];
}

/**
 * テンプレートレジストリ。
 * 新テンプレートの追加 = assets/templates/languages/<id> を用意して、ここに1エントリ追加する。
 */
export const templates: TemplateDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript",
    status: "available",
    language: "typescript",
    languageLabel: "TypeScript",
    features: ["eslint", "prettier", "vitest", "docker", "github-actions"],
    aiProviders: ["claude", "codex"],
  },
  { id: "laravel-react", label: "Laravel + React", status: "planned", language: "laravel", languageLabel: "Laravel", features: [], aiProviders: ["claude", "codex"] },
  { id: "laravel-vue", label: "Laravel + Vue", status: "planned", language: "laravel", languageLabel: "Laravel", features: [], aiProviders: ["claude", "codex"] },
  { id: "node-react", label: "Node.js + React", status: "planned", language: "typescript", languageLabel: "TypeScript", features: [], aiProviders: ["claude", "codex"] },
  { id: "nextjs", label: "Next.js", status: "planned", language: "typescript", languageLabel: "TypeScript", features: [], aiProviders: ["claude", "codex"] },
  { id: "nuxt", label: "Nuxt", status: "planned", language: "typescript", languageLabel: "TypeScript", features: [], aiProviders: ["claude", "codex"] },
];

export const DEFAULT_TEMPLATE = "typescript";

export function findTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((t) => t.id === id);
}
