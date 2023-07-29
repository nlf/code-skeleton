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

export async function applySkeleton (config: Config) {
  const result = {
    exitCode: 0,
  } as SkeletonResults;

  if (config.flags.verbose) {
    console.group("applying skeleton...");
  }

  for (const [targetPath, generator] of Object.entries(config.skeleton)) {
    result[targetPath] = await generator.apply(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      result.exitCode = 1;
      // istanbul ignore else - no need to cover not logging
      if (config.flags.verbose) {
        console.group(`${targetPath}: ${ansiColors.red("FAILED")}`);
        // coverage disabled, field is optional
        for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
          console.log(message);
        }
        console.groupEnd();
      }
    } else {
      // istanbul ignore else - no need to cover not logging
      if (config.flags.verbose) {
        console.log(`${targetPath}: ${ansiColors.green("OK")}`);
      }
    }
  }

  console.groupEnd();

  return result;
}

export async function verifySkeleton (config: Config) {
  const result = {
    exitCode: 0,
  } as SkeletonResults;

  if (config.flags.verbose) {
    console.group("verifying skeleton...");
  }

  for (const [targetPath, generator] of Object.entries(config.skeleton)) {
    result[targetPath] = await generator.verify(join(config.path, targetPath), config);
    if (result[targetPath].result !== "pass") {
      result.exitCode = 1;
      // istanbul ignore else - no need to cover not logging
      if (config.flags.verbose) {
        console.group(`${targetPath}: ${ansiColors.red("FAILED")}`);
        // coverage disabled, field is optional
        for (const message of result[targetPath].messages ?? /* istanbul ignore next */ []) {
          console.log(message);
        }
        console.groupEnd();
      }
    } else {
      // istanbul ignore else - no need to cover not logging
      if (config.flags.verbose) {
        console.log(`${targetPath}: ${ansiColors.green("OK")}`);
      }
    }
  }

  console.groupEnd();

  return result;
}
