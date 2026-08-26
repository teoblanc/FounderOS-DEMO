/**
 * True only under the OpenNext/Cloudflare Workers build — never during
 * `next dev`, `next start` (Railway), or tests. A Workers isolate can never
 * spawn a process or read a local filesystem (that's not a compatibility
 * gap, it's fundamental to the sandbox), so connectors that shell out to a
 * local CLI or read local app data (WhatsApp/Obsidian/Wispr Flow, gbrain,
 * the local-stack tmux/Homebrew checks, `pdftotext` for bank statements)
 * check this first and short-circuit to an honest "not available" status
 * instead of attempting the call.
 */
export async function isWorkersRuntime(): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    getCloudflareContext();
    return true;
  } catch {
    return false;
  }
}
