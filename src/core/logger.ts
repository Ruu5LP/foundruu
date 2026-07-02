import pc from "picocolors";

export const log = {
  info: (msg: string): void => console.log(msg),
  step: (msg: string): void => console.log(pc.cyan(`▸ ${msg}`)),
  success: (msg: string): void => console.log(pc.green(`✔ ${msg}`)),
  warn: (msg: string): void => console.log(pc.yellow(`⚠ ${msg}`)),
  error: (msg: string): void => console.error(pc.red(`✖ ${msg}`)),
};
