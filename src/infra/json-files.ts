import "./fs-safe-defaults.js";
import {
  readJsonSync as rawReadJsonSync,
  readRootJsonObjectSync as rawReadRootJsonObjectSync,
  readRootJsonSync as rawReadRootJsonSync,
  readRootStructuredFileSync as rawReadRootStructuredFileSync,
  tryReadJsonSync as rawTryReadJsonSync,
} from "@openclaw/fs-safe/json";
import { perfMark } from "./perf-trace.js";
import { replaceFileAtomic } from "./replace-file.js";

// Perf-audit wrappers: synchronous JSON readers are on the hot path during
// TUI startup. perfMark records each call so we can see which files are being
// read sync. Async readers are not wrapped because they don't block the loop.
// Wrappers cast back to the original signature to preserve generics.
function describeReaderPath(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rootDir = typeof obj.rootDir === "string" ? obj.rootDir : "";
    const relativePath = typeof obj.relativePath === "string" ? obj.relativePath : "";
    if (rootDir || relativePath) {
      return `${rootDir}::${relativePath}`;
    }
  }
  return String(value);
}

export const tryReadJsonSync = ((...args: unknown[]) => {
  perfMark("json.tryReadJsonSync", { path: describeReaderPath(args[0]) });
  return (rawTryReadJsonSync as (...a: unknown[]) => unknown)(...args);
}) as typeof rawTryReadJsonSync;
export const readJsonFileSync = tryReadJsonSync;

export const readJsonSync = ((...args: unknown[]) => {
  perfMark("json.readJsonSync", { path: describeReaderPath(args[0]) });
  return (rawReadJsonSync as (...a: unknown[]) => unknown)(...args);
}) as typeof rawReadJsonSync;

export const readRootJsonSync = ((...args: unknown[]) => {
  perfMark("json.readRootJsonSync", { path: describeReaderPath(args[0]) });
  return (rawReadRootJsonSync as (...a: unknown[]) => unknown)(...args);
}) as typeof rawReadRootJsonSync;

export const readRootJsonObjectSync = ((...args: unknown[]) => {
  perfMark("json.readRootJsonObjectSync", { path: describeReaderPath(args[0]) });
  return (rawReadRootJsonObjectSync as (...a: unknown[]) => unknown)(...args);
}) as typeof rawReadRootJsonObjectSync;

export const readRootStructuredFileSync = ((...args: unknown[]) => {
  perfMark("json.readRootStructuredFileSync", { path: describeReaderPath(args[0]) });
  return (rawReadRootStructuredFileSync as (...a: unknown[]) => unknown)(...args);
}) as typeof rawReadRootStructuredFileSync;

export {
  JsonFileReadError,
  readJson,
  readJson as readJsonFileStrict,
  readJsonIfExists,
  readJsonIfExists as readDurableJsonFile,
  tryReadJson,
  tryReadJson as readJsonFile,
  writeJson,
  writeJson as writeJsonAtomic,
  writeJsonSync,
} from "@openclaw/fs-safe/json";
export { createAsyncLock } from "@openclaw/fs-safe/advanced";

export type WriteTextAtomicOptions = {
  mode?: number;
  dirMode?: number;
  trailingNewline?: boolean;
  durable?: boolean;
};

export async function writeTextAtomic(
  filePath: string,
  content: string,
  options?: WriteTextAtomicOptions,
): Promise<void> {
  const payload = options?.trailingNewline && !content.endsWith("\n") ? `${content}\n` : content;
  await replaceFileAtomic({
    filePath,
    content: payload,
    mode: options?.mode ?? 0o600,
    dirMode: options?.dirMode ?? 0o777 & ~process.umask(),
    copyFallbackOnPermissionError: true,
    syncTempFile: options?.durable !== false,
    syncParentDir: options?.durable !== false,
  });
}
