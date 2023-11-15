import type { GeneratorProblem } from "./problem";

export enum GeneratorReportResult {
  Pass = "pass",
  Fail = "fail",
}

export interface GeneratorReport {
  result: GeneratorReportResult;
  problems: GeneratorProblem[];
  messages: string[];
}
