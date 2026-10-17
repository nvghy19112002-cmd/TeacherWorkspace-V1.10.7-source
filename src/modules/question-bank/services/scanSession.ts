let active: AbortController | null = null;
/** A closing dialog must finish its final checkpoint before another dialog starts a job. */
export function beginScanSession() {
  if (active) return null;
  active = new AbortController();
  return active;
}
export function finishScanSession(controller: AbortController) {
  if (active === controller) active = null;
}
