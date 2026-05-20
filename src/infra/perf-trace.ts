// Temporary perf-tracing helper for the dallin-performance-audit branch.
// Writes timestamped lines to /tmp/openclaw-perf.log so TUI/Gateway timings can
// be tailed without corrupting the TUI screen. Remove with the audit.
import { appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const PERF_LOG_PATH = process.env.OPENCLAW_PERF_LOG ?? "/tmp/openclaw-perf.log";

// Anchor for the per-process running total. Captured the first time this module
// is loaded, so totalMs reflects wall time since process startup (close enough).
const MODULE_T0 = performance.now();

function write(label: string, extra?: Record<string, unknown>): void {
  const totalMs = +(performance.now() - MODULE_T0).toFixed(2);
  const tail = extra && Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  try {
    appendFileSync(
      PERF_LOG_PATH,
      `${new Date().toISOString()} pid=${process.pid} total=${totalMs}ms ${label}${tail}\n`,
    );
  } catch {
    // never block on perf logging failures
  }
}

export function perfMark(label: string, extra?: Record<string, unknown>): void {
  write(label, extra);
}

export function perfSpan(
  label: string,
  startExtra?: Record<string, unknown>,
): (endExtra?: Record<string, unknown>) => void {
  const t0 = performance.now();
  write(`${label} start`, startExtra);
  return (endExtra?: Record<string, unknown>) => {
    const ms = +(performance.now() - t0).toFixed(2);
    write(`${label} done`, { ms, ...endExtra });
  };
}

// Event-loop heartbeat. Fires every HEARTBEAT_INTERVAL_MS; if the next tick is
// late by more than HEARTBEAT_LAG_THRESHOLD_MS, we log the gap so blocked-loop
// windows show up explicitly. Disabled via OPENCLAW_PERF_HEARTBEAT=0.
//
// Guarded via globalThis so chunk-split bundles don't end up with multiple
// heartbeat instances writing the same data with different MODULE_T0 anchors.
const HEARTBEAT_INTERVAL_MS = 500;
const HEARTBEAT_LAG_THRESHOLD_MS = 100;
const HEARTBEAT_GUARD = "__openclaw_perfTraceHeartbeat__";
type HeartbeatGuard = { installed?: boolean };
const heartbeatGuard = (globalThis as Record<string, unknown>)[HEARTBEAT_GUARD] as
  | HeartbeatGuard
  | undefined;
if (!heartbeatGuard?.installed && process.env.OPENCLAW_PERF_HEARTBEAT !== "0") {
  (globalThis as Record<string, unknown>)[HEARTBEAT_GUARD] = { installed: true };
  let lastTick = performance.now();
  let seq = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const gapMs = +(now - lastTick).toFixed(2);
    const lateBy = +(gapMs - HEARTBEAT_INTERVAL_MS).toFixed(2);
    lastTick = now;
    seq += 1;
    if (lateBy >= HEARTBEAT_LAG_THRESHOLD_MS) {
      write("heartbeat lag", { seq, gapMs, lateBy });
    }
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
}
