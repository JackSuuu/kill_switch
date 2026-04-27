/**
 * Safe wrapper around Tauri invoke.
 * Falls back silently when running in a browser (non-Tauri) context.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvokeArgs = Record<string, any>;

export async function tauriInvoke(cmd: string, args?: InvokeArgs): Promise<void> {
  try {
    // Check if running inside Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/tauri');
      await invoke(cmd, args);
    }
  } catch (e) {
    // Silently ignore — browser preview, dev mode without Tauri wrapper, etc.
    console.warn(`[tauri] invoke '${cmd}' skipped:`, e);
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
