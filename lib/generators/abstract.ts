import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { GeneratorProblem, type GeneratorProblemSpec } from "./problem";
import { type GeneratorReport, GeneratorReportResult } from "./report";

export interface GenerateInput {
  path: string;
}

export interface ValidateInput {
  path: string;
  found: string;
}

export abstract class Generator<TOptions = unknown> {
  options: TOptions;
  #report: GeneratorReport = {
    result: GeneratorReportResult.Fail,
    problems: [],
    messages: [],
  };

  constructor (options: TOptions) {
    this.options = options;
  }

  note (message: string): void {
    this.#report.messages.push(message);
  }

  report (problem: GeneratorProblemSpec): void {
    this.#report.problems.push(new GeneratorProblem(problem));
  }

  async apply (targetPath: string): Promise<GeneratorReport> {
    const result = await this.generate({
      path: targetPath,
    });
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, result);
    this.#report.result = GeneratorReportResult.Pass;
    return this.#report;
  }

  async verify (targetPath: string): Promise<GeneratorReport> {
    this.#report.problems.length = 0;
    let found: string;

    try {
      found = await readFile(targetPath, {
        encoding: "utf8",
      });
    } catch (_err) {
      const err = _err as Error & { code?: string };
      if (err.code === "ENOENT") {
        this.report({
          message: "file missing",
        });
        this.#report.result = GeneratorReportResult.Fail;
        return this.#report;
      } else {
        this.report({
          code: err.code,
          message: err.message,
        });
        this.#report.result = GeneratorReportResult.Fail;
        return this.#report;
      }
    }

    try {
      this.#report.result = await this.validate({
        path: targetPath,
        found,
      });
    } catch (_err) {
      const err = _err as Error;
      this.report({ message: err.message });
      this.#report.result = GeneratorReportResult.Fail;
    }

    return this.#report;
  }

  async validate (options: ValidateInput): Promise<GeneratorReportResult> {
    const expected = await this.generate({
      path: options.path,
    });

    if (expected !== options.found) {
      this.report({
        expected,
        found: options.found,
      });

      return GeneratorReportResult.Fail;
    }

    return GeneratorReportResult.Pass;
  }

  abstract generate (options: GenerateInput): Promise<string>;
}
