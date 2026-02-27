/**
 * Minimal type declarations for @mariozechner/pi-coding-agent.
 * The real package is provided at runtime by the Pi coding agent host.
 */
declare module "@mariozechner/pi-coding-agent" {
  export interface ExtensionAPI {
    registerTool(tool: unknown): void;
    registerCommand?(...args: unknown[]): void;
    on?(...args: unknown[]): void;
    [key: string]: unknown;
  }

  export interface SpawnHookOptions {
    command: string;
    cwd: string;
    env: Record<string, string | undefined>;
  }

  export function createBashTool(
    cwd: string,
    options?: {
      spawnHook?: (opts: SpawnHookOptions) => SpawnHookOptions;
    }
  ): unknown;
}
