import { join } from "node:path";
import ansiColors from "ansi-colors";
import colorSupport from "color-support";
const colorSupported = colorSupport();
/* c8 ignore next 3 - no need to test this */
ansiColors.enabled = typeof colorSupported === "boolean"
  ? colorSupported
  : colorSupported.hasBasic;

import { GeneratorProblem, type GeneratorReport, GeneratorReportResult } from "./generators";
import type { Config } from "./config";

export interface SkeletonResults {
  exitCode: number;
  reports: Record<string, GeneratorReport>;
}

export * from "./generators";
export * from "./config";

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
  const result: SkeletonResults = {
    exitCode: 0,
    reports: {},
  };

  const desiredLength = Math.max(...Object.keys(config.skeleton).map((key) => key.length)) + 1;
  const sortedKeys = Object.keys(config.skeleton).sort((a, b) => a.localeCompare(b, "en"));
  const applyEnd = logGroup(`applying skeleton "${config.module}"`, config);
  for (const targetPath of sortedKeys) {
    const generator = config.skeleton[targetPath];
    const padding = " ".repeat(desiredLength - targetPath.length);
    let fileEnd;

    try {
      const report = await generator.apply(join(config.path, targetPath));
      fileEnd = logGroup(`${targetPath}${padding}${ansiColors.green("OK")}`, config);
      for (const message of report.messages) {
        log(message, config);
      }
      result.reports[targetPath] = report;
    } catch (_err) {
      const err = _err as Error & { code?: string };
      result.exitCode = 1;
      result.reports[targetPath] = {
        result: GeneratorReportResult.Fail,
        problems: [
          new GeneratorProblem({
            code: err.code,
            message: err.message,
          }),
        ],
        messages: [],
      };
      fileEnd = logGroup(`${targetPath}${padding}${ansiColors.red("FAILED")}`, config);
      for (const problem of result.reports[targetPath].problems) {
        logVerbose(problem.toString(), config);
      }
    }

    fileEnd();
  }
  applyEnd();

  return result;
}

export async function verifySkeleton (config: Config) {
  const result: SkeletonResults = {
    exitCode: 0,
    reports: {},
  };

  const desiredLength = Math.max(...Object.keys(config.skeleton).map((key) => key.length)) + 1;
  const sortedKeys = Object.keys(config.skeleton).sort((a, b) => a.localeCompare(b, "en"));
  const verifyEnd = logGroup(`verifying skeleton "${config.module}"`, config);
  for (const targetPath of sortedKeys) {
    const generator = config.skeleton[targetPath];
    const padding = " ".repeat(desiredLength - targetPath.length);
    const report: GeneratorReport = await generator.verify(join(config.path, targetPath));
    result.reports[targetPath] = report;
    if (report.result !== GeneratorReportResult.Pass) {
      const fileEnd = logGroup(`${targetPath}${padding}${ansiColors.red("FAILED")}`, config);
      result.exitCode = 1;
      for (const problem of report.problems) {
        logVerbose(problem.toString(), config);
      }
      fileEnd();
    } else {
      log(`${targetPath}${padding}${ansiColors.green("OK")}`, config);
    }
  }
  verifyEnd();

  return result;
}
