import { join } from "node:path";
import ansiColors from "ansi-colors";
import colorSupport from "color-support";
const colorSupported = colorSupport();
// istanbul ignore next - no need to test this
ansiColors.enabled = typeof colorSupported === "boolean"
  ? colorSupported
  : colorSupported.hasBasic;

import type { SkeletonResults } from "./generators/abstract";
import type { Config } from "./config";

export {
  copy,
  json,
  pkg,
} from "./generators";

export {
  Skeleton,
} from "./config";

function log (message: string, config: Config) {
  if (config.flags.silent !== true) {
    console.log(message);
  }
}

function logVerbose (message: string, config: Config) {
  if (config.flags.verbose) {
    log(message, config);
  }
}

function logGroup (message: string, config: Config) {
  if (config.flags.silent !== true) {
    console.group(message);
    return console.groupEnd;
  }

  // rule disabled, we want an empty function here
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return () => {};
}

export async function applySkeleton (config: Config) {
  const result = {
    exitCode: 0,
  } as SkeletonResults;

  const applyEnd = logGroup(`applying skeleton "${config.module}"`, config);
  for (const [targetPath, generator] of Object.entries(config.skeleton)) {
    result[targetPath] = await generator.apply(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      const fileEnd = logGroup(`${targetPath}: ${ansiColors.red("FAILED")}`, config);
      result.exitCode = 1;
      // coverage disabled, messages field is optional
      for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
        logVerbose(message, config);
      }
      fileEnd();
    } else {
      log(`${targetPath}: ${ansiColors.green("OK")}`, config);
    }
  }
  applyEnd();

  return result;
}

export async function verifySkeleton (config: Config) {
  const result = {
    exitCode: 0,
  } as SkeletonResults;

  const verifyEnd = logGroup(`verifying skeleton "${config.module}"`, config);
  for (const [targetPath, generator] of Object.entries(config.skeleton)) {
    result[targetPath] = await generator.verify(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      const fileEnd = logGroup(`${targetPath}: ${ansiColors.red("FAILED")}`, config);
      result.exitCode = 1;
      // coverage disabled, messages field is optional
      for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
        logVerbose(message, config);
      }
      fileEnd();
    } else {
      log(`${targetPath}: ${ansiColors.green("OK")}`, config);
    }
  }
  verifyEnd();

  return result;
}
