import type { GeneratorProblem } from "./problem";

export enum GeneratorReportResult {
  Pass = "pass",
  Fail = "fail",
}

export class GeneratorReport {
  problems: GeneratorProblem[] = [];
  messages: string[] = [];

  get result () {
    return this.problems.length > 0
      ? GeneratorReportResult.Fail
      : GeneratorReportResult.Pass;
  }

  reset () {
    this.problems.length = 0;
    this.messages.length = 0;
  }
}
