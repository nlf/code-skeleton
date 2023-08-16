import t from "tap";

import {
  type Config,
  type CustomOptions,
  custom,
  applySkeleton,
  verifySkeleton,
  type GenerateInput,
  type ValidateInput,
  type GeneratorProblemSpec,
  GeneratorReportResult,
} from "../lib";

void t.test("can pass custom methods", async (t) => {
  const root = t.testdir({});

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.txt": custom({
        generate: (input: GenerateInput): Promise<string> => {
          const customContent = `generated ${input.path}`;
          return Promise.resolve(customContent);
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {},
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 0,
    reports: {
      "foo.txt": {
        result: "pass",
      },
    },
  });
});

void t.test("can provide custom validate function", async (t) => {
  const root = t.testdir({});

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.txt": custom({
        generate: (input: GenerateInput): Promise<string> => {
          const customContent = `generated ${input.path}`;
          return Promise.resolve(customContent);
        },
        validate: (input: ValidateInput): Promise<GeneratorReportResult> => {
          t.equal(input.found, `generated ${input.path}`);
          return Promise.resolve(GeneratorReportResult.Pass);
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {},
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 0,
    reports: {
      "foo.txt": {
        result: "pass",
      },
    },
  });
});

void t.test("can report errors from custom validate function", async (t) => {
  const root = t.testdir({});

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.txt": custom({
        generate: (input: GenerateInput): Promise<string> => {
          const customContent = `generated ${input.path}`;
          return Promise.resolve(customContent);
        },
        validate: (input: ValidateInput, options: CustomOptions, report: (message: GeneratorProblemSpec) => void): Promise<GeneratorReportResult> => {
          report({
            message: "custom validate says no",
          });
          return Promise.resolve(GeneratorReportResult.Fail);
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {},
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          message: "custom validate says no",
        }],
      },
    },
  });
});

void t.test("thrown errors from custom validate cause failure", async (t) => {
  const root = t.testdir({});

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.txt": custom({
        generate: (input: GenerateInput): Promise<string> => {
          const customContent = `generated ${input.path}`;
          return Promise.resolve(customContent);
        },
        validate: (): Promise<GeneratorReportResult> => {
          throw Object.assign(new Error("kaboom"), { code: "EBOOM" });
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {},
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 1,
    reports: {
      "foo.txt": {
        result: "fail",
        problems: [{
          code: "EBOOM",
          message: "kaboom",
        }],
      },
    },
  });
});

void t.test("throws for missing options", (t) => {
  t.throws(() => custom({}), {
    message: "Must specify a generate function",
  });

  t.end();
});
