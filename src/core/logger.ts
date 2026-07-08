import pc from "picocolors";

let out: (msg: string) => void = (msg) => console.log(msg);

/** CLI 共通のログ出力(色付き)。ユーザー向けメッセージはすべてここを通す */
export const log = {
  info: (msg: string): void => out(msg),
  step: (msg: string): void => out(pc.cyan(`▸ ${msg}`)),
  success: (msg: string): void => out(pc.green(`✔ ${msg}`)),
  warn: (msg: string): void => out(pc.yellow(`⚠ ${msg}`)),
  error: (msg: string): void => console.error(pc.red(`✖ ${msg}`)),
  /** MCP(stdio) 等、stdout をプロトコルに使うモードでログを stderr へ逃がす */
  useStderr: (): void => {
    out = (msg) => console.error(msg);
  },
};
