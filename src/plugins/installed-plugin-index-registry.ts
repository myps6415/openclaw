import { perfMark } from "../infra/perf-trace.js";
import { normalizePluginsConfig } from "./config-state.js";
import { discoverOpenClawPlugins, type PluginCandidate } from "./discovery.js";
import { loadInstalledPluginIndexInstallRecordsSync } from "./installed-plugin-index-record-reader.js";
import type { LoadInstalledPluginIndexParams } from "./installed-plugin-index-types.js";
import { loadPluginManifestRegistry, type PluginManifestRegistry } from "./manifest-registry.js";

function captureFrames(skip: number, depth: number): string {
  const stack = new Error().stack;
  if (!stack) return "";
  const out: string[] = [];
  let kept = 0;
  for (const raw of stack.split("\n").slice(skip + 1)) {
    const line = raw.trim();
    if (!line.startsWith("at ")) continue;
    if (line.includes("perf-trace") || line.includes("captureFrames")) continue;
    out.push(line.slice(3, 200));
    kept += 1;
    if (kept >= depth) break;
  }
  return out.join(" | ");
}

export function resolveInstalledPluginIndexRegistry(params: LoadInstalledPluginIndexParams): {
  registry: PluginManifestRegistry;
  candidates: readonly PluginCandidate[];
} {
  const branch = params.candidates
    ? "candidates-provided"
    : params.discovery
      ? "discovery-provided"
      : "rediscover";
  perfMark("plugins.resolveInstalledPluginIndexRegistry", {
    branch,
    callers: captureFrames(2, 5),
  });
  if (params.candidates) {
    return {
      candidates: params.candidates,
      registry: loadPluginManifestRegistry({
        config: params.config,
        workspaceDir: params.workspaceDir,
        env: params.env,
        candidates: params.candidates,
        diagnostics: params.diagnostics,
        installRecords: params.installRecords,
      }),
    };
  }

  const normalized = normalizePluginsConfig(params.config?.plugins);
  const installRecords =
    params.installRecords ?? loadInstalledPluginIndexInstallRecordsSync({ env: params.env });
  const discovery =
    params.discovery ??
    discoverOpenClawPlugins({
      workspaceDir: params.workspaceDir,
      extraPaths: normalized.loadPaths,
      env: params.env,
      installRecords,
    });
  return {
    candidates: discovery.candidates,
    registry: loadPluginManifestRegistry({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      candidates: discovery.candidates,
      diagnostics: discovery.diagnostics,
      installRecords,
    }),
  };
}
