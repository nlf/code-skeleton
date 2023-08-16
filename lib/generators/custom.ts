import { Generator, type GenerateInput, type ValidateInput } from "./abstract";
import { type GeneratorProblemSpec } from "./problem";
import { GeneratorReportResult } from "./report";

export interface CustomOptions {
  validate?: (input: ValidateInput, options: CustomOptions, report: (message: GeneratorProblemSpec) => void) => Promise<GeneratorReportResult>;
  generate?: (input: GenerateInput, options: CustomOptions) => Promise<string>;
}

export class CustomGenerator extends Generator<CustomOptions> {
  constructor (options: CustomOptions) {
    super(options);

    if (!this.options.generate || typeof this.options.generate !== "function") {
      throw new Error("Must specify a generate function");
    }
  }

  async generate (input: GenerateInput) {
    // non-null assertion safe due to check in the constructor
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return await this.options.generate!(input, this.options);
  }

  async validate (input: ValidateInput): Promise<GeneratorReportResult> {
    if (!this.options.validate) {
      return super.validate(input);
    }

    let result: GeneratorReportResult;
    try {
      // rule disabled, constructor verifies presence of the function
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result = await this.options.validate(input, this.options, this.report.bind(this));
    } catch (_err) {
      const err = _err as Error & { code?: string };
      this.report({
        code: err.code,
        message: err.message,
      });
      result = GeneratorReportResult.Fail;
    }

    return result;
  }
}
