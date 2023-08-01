import { join } from "node:path";
import ansiColors from "ansi-colors";
import colorSupport from "color-support";
const colorSupported = colorSupport();
// istanbul ignore next - no need to test this
ansiColors.enabled = typeof colorSupported === "boolean"
  ? colorSupported
  : colorSupported.hasBasic;

import { PackageGenerator } from "./generators/package";
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

  const desiredLength = Math.max(...Object.keys(config.skeleton).map((key) => key.length)) + 1;
  const sortedKeys = Object.keys(config.skeleton).sort((a, b) => a.localeCompare(b, "en"));
  const applyEnd = logGroup(`applying skeleton "${config.module}"`, config);
  for (const targetPath of sortedKeys) {
    const generator = config.skeleton[targetPath];
    const padding = " ".repeat(desiredLength - targetPath.length);
    result[targetPath] = await generator.apply(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      const fileEnd = logGroup(`${targetPath}${padding}${ansiColors.red("FAILED")}`, config);
      result.exitCode = 1;
      // coverage disabled, messages field is optional
      for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
        logVerbose(message, config);
      }
      fileEnd();
    } else {
      const fileEnd = logGroup(`${targetPath}${padding}${ansiColors.green("OK")}`, config);
      if (generator instanceof PackageGenerator) {
        // coverage disabled, messages field is optional
        for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
          log(message, config);
        }
      }
      fileEnd();
    }
  }
  applyEnd();

  return result;
}

export async function verifySkeleton (config: Config) {
  const result = {
    exitCode: 0,
  } as SkeletonResults;

  const desiredLength = Math.max(...Object.keys(config.skeleton).map((key) => key.length)) + 1;
  const sortedKeys = Object.keys(config.skeleton).sort((a, b) => a.localeCompare(b, "en"));
  const verifyEnd = logGroup(`verifying skeleton "${config.module}"`, config);
  for (const targetPath of sortedKeys) {
    const generator = config.skeleton[targetPath];
    const padding = " ".repeat(desiredLength - targetPath.length);
    result[targetPath] = await generator.verify(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      const fileEnd = logGroup(`${targetPath}${padding}${ansiColors.red("FAILED")}`, config);
      result.exitCode = 1;
      // coverage disabled, messages field is optional
      for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
        logVerbose(message, config);
      }
      fileEnd();
    } else {
      log(`${targetPath}${padding}${ansiColors.green("OK")}`, config);
    }
  }
  verifyEnd();

  return result;
}
