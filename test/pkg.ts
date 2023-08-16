import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import t from "tap";

import { type Config, pkg, applySkeleton, verifySkeleton, type GeneratorProblemSpec, GeneratorProblem } from "../lib";

const has = (problems: GeneratorProblem[], input: GeneratorProblemSpec): boolean => {
  return problems.some((item) => {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in item) || !isDeepStrictEqual(item[key as keyof GeneratorProblemSpec], value)) {
        return false;
      }
    }

    return true;
  });
};

void t.test("can add fields to package.json", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      files: ["/foo"],
      bundledDependencies: ["bar"],
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        engines: {
          node: process.version,
        },
        files: {
          append: ["/lib", "/bin"],
          remove: ["/foo"],
        },
        license: "MIT",
        main: "lib/index.js",
        scripts: {
          test: "tap",
        },
        tap: {
          coverage: true,
        },
        bundledDependencies: {
          append: ["foo"],
          remove: ["bar"],
        },
        dependencies: {
          foo: "^1.0.0",
        },
        devDependencies: {
          tap: "^16.0.0",
        },
        optionalDependencies: {
          debug: "^4.3.4",
        },
        peerDependencies: {
          once: "^1.4.0",
        },
        peerDependenciesMeta: {
          once: {
            optional: true,
          },
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
      "package.json": {
        result: "fail",
        problems: [],
        // problems are asserted individually so that order doesn't matter
      },
    },
  });

  const problems = initialVerifyResult.reports["package.json"].problems;

  t.ok(has(problems, { field: "main", expected: "lib/index.js" }));
  t.ok(has(problems, { field: "license", expected: "MIT" }));
  t.ok(has(problems, { field: "engines.node", expected: process.version }));
  t.ok(has(problems, { field: "files", expected: "/lib" }));
  t.ok(has(problems, { field: "files", expected: "/bin" }));
  t.ok(has(problems, { field: "files", found: "/foo" }));
  t.ok(has(problems, { field: "scripts.test", expected: "tap" }));
  t.ok(has(problems, { field: "dependencies.foo", expected: "^1.0.0" }));
  t.ok(has(problems, { field: "devDependencies.tap", expected: "^16.0.0" }));
  t.ok(has(problems, { field: "optionalDependencies.debug", expected: "^4.3.4" }));
  t.ok(has(problems, { field: "peerDependencies.once", expected: "^1.4.0" }));
  t.ok(has(problems, { field: "peerDependenciesMeta.once", expected: { optional: true } }));
  t.ok(has(problems, { field: "bundledDependencies", expected: "foo" }));
  t.ok(has(problems, { field: "bundledDependencies", found: "bar" }));
  t.ok(has(problems, { field: "tap.coverage", expected: true }));
  t.equal(problems.length, 15);

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
        messages: [
          "one or more changes were made to your project's dependencies, make sure to run `npm install`",
        ],
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const actualPkg: unknown = JSON.parse(rawPkg);
  t.same(actualPkg, {
    name: "foo",
    engines: {
      node: process.version,
    },
    files: ["/lib", "/bin"],
    license: "MIT",
    main: "lib/index.js",
    scripts: {
      test: "tap",
    },
    bundledDependencies: ["foo"],
    dependencies: {
      foo: "^1.0.0",
    },
    devDependencies: {
      tap: "^16.0.0",
    },
    optionalDependencies: {
      debug: "^4.3.4",
    },
    peerDependencies: {
      once: "^1.4.0",
    },
    peerDependenciesMeta: {
      once: {
        optional: true,
      },
    },
    tap: {
      coverage: true,
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });
});

void t.test("can remove dependencies", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      dependencies: {
        dep: "^1.0.0",
        keepDep: "^1.0.0",
      },
      bundledDependencies: ["dep"],
      devDependencies: {
        dev: "^1.0.0",
      },
      optionalDependencies: {
        opt: "^1.0.0",
      },
      peerDependencies: {
        peer: "^1.0.0",
        peerB: "^1.0.0",
      },
      peerDependenciesMeta: {
        peer: {
          optional: true,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        removeDependencies: [
          "dep",
          "dev",
          "opt",
          "peer",
          "peerB",
        ],
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
      "package.json": {
        result: "fail",
        problems: [],
        // the problems are asserted separately
      },
    },
  });

  const problems = initialVerifyResult.reports["package.json"].problems;
  t.ok(has(problems, { field: "bundledDependencies", found: "dep" }));
  t.ok(has(problems, { field: "dependencies", found: "dep" }));
  t.ok(has(problems, { field: "devDependencies", found: "dev" }));
  t.ok(has(problems, { field: "optionalDependencies", found: "opt" }));
  t.ok(has(problems, { field: "peerDependencies", found: "peer" }));
  t.ok(has(problems, { field: "peerDependenciesMeta", found: "peer" }));

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
        messages: [
          "one or more changes were made to your project's dependencies, make sure to run `npm install`",
        ],
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const actualPkg: unknown = JSON.parse(rawPkg);
  t.same(actualPkg, {
    name: "foo",
    dependencies: {
      keepDep: "^1.0.0",
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });
});

void t.test("deps that are not a subset of the requested range are invalid", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      dependencies: {
        debug: "^1.0.0",
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        dependencies: {
          debug: "^2.0.0",
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
      "package.json": {
        result: "fail",
        problems: [{
          field: "dependencies.debug",
          message: "expected to be a subset of \"^2.0.0\" but found \"^1.0.0\"",
        }],
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
        messages: [
          "one or more changes were made to your project's dependencies, make sure to run `npm install`",
        ],
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    dependencies: {
      debug: "^2.0.0",
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });
});

void t.test("can set peerDependenciesMeta to optional", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      peerDependencies: {
        foo: "^1.0.0",
      },
      peerDependenciesMeta: {
        bar: {
          optional: false,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        peerDependenciesMeta: {
          foo: {
            optional: true,
          },
          bar: {
            optional: true,
          },
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
      "package.json": {
        result: "fail",
        problems: [],
      },
    },
  });

  const problems = initialVerifyResult.reports["package.json"].problems;
  t.ok(has(problems, { field: "peerDependenciesMeta.foo", expected: { optional: true } }));
  t.ok(has(problems, { field: "peerDependenciesMeta.bar", expected: { optional: true } }));
});

void t.test("empty object properties are removed", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        scripts: {},
        peerDependenciesMeta: {},
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        // verify passes because the object is empty and should be
        result: "pass",
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: "foo",
  });
});

void t.test("array mutations", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      arrayOne: ["bar"],
      arrayTwo: ["bar"],
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        arrayOne: {
          append: ["foo"],
        },
        arrayTwo: {
          remove: ["bar"],
        },
        arrayThree: {
          append: ["baz"],
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 1,
    reports: {
      "package.json": {
        result: "fail",
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });
});

void t.test("empty array properties get removed", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        bundledDependencies: {},
        files: {},
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        // verify passes because the object is empty and should be
        result: "pass",
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: "foo",
  });
});

void t.test("removeDependencies works when no bundledDeps are present", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        removeDependencies: ["bar"],
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        // verify passes because the object is empty and should be
        result: "pass",
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: "foo",
  });
});

void t.test("removeDependencies prunes peerDependenciesMeta and bundledDependencies", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      dependencies: {
        bap: "^1.0.0",
        bar: "^1.0.0",
      },
      bundledDependencies: ["bap", "bar"],
      peerDependencies: {
        baz: "^1.0.0",
        buzz: "^1.0.0",
      },
      peerDependenciesMeta: {
        baz: {
          optional: true,
        },
        buzz: {
          optional: true,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        removeDependencies: ["bar", "baz"],
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 1,
    reports: {
      "package.json": {
        result: "fail",
        problems: [],
      },
    },
  });

  const problems = verifyResult.reports["package.json"].problems;
  t.ok(has(problems, { field: "bundledDependencies", found: "bar" }));
  t.ok(has(problems, { field: "dependencies", found: "bar" }));
  t.ok(has(problems, { field: "peerDependencies", found: "baz" }));
  t.ok(has(problems, { field: "peerDependenciesMeta", found: "baz" }));

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
        messages: [
          "one or more changes were made to your project's dependencies, make sure to run `npm install`",
        ],
      },
    },
  });

  const rawPkg = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: "foo",
    dependencies: {
      bap: "^1.0.0",
    },
    bundledDependencies: ["bap"],
    peerDependencies: {
      buzz: "^1.0.0",
    },
    peerDependenciesMeta: {
      buzz: {
        optional: true,
      },
    },
  });
});

void t.test("correctly identifies missing files property", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      keywords: ["test", "foo"],
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        files: {
          append: ["foo"],
        },
        keywords: {
          remove: ["test"],
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 1,
    reports: {
      "package.json": {
        result: "fail",
        problems: [],
      },
    },
  });

  const problems = verifyResult.reports["package.json"].problems;
  t.ok(has(problems, { field: "files", expected: "foo" }));
});

void t.test("leaves dependencies that are already a subset of the request alone", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      dependencies: {
        "hereandvalid": "^2.5.0",
        "hereandinvalid": "^1.0.0",
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        dependencies: {
          hereandvalid: "^2.0.0",
          hereandinvalid: "^2.0.0",
          missing: "^1.0.0",
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
      "package.json": {
        result: "fail",
        problems: [],
      },
    },
  });

  const problems = initialVerifyResult.reports["package.json"].problems;
  t.ok(has(problems, { field: "dependencies.hereandinvalid", message: "expected to be a subset of \"^2.0.0\" but found \"^1.0.0\"" }));
  t.ok(has(problems, { field: "dependencies.missing", expected: "^1.0.0" }));

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
        messages: [
          "one or more changes were made to your project's dependencies, make sure to run `npm install`",
        ],
      },
    },
  });

  const actualContents = await readFile(join(root, "package.json"), { encoding: "utf8" });
  const actualPkg: unknown = JSON.parse(actualContents);
  t.same(actualPkg, {
    name: "foo",
    dependencies: {
      "hereandvalid": "^2.5.0",
      "hereandinvalid": "^2.0.0",
      "missing": "^1.0.0",
    },
  });
});

void t.test("does not tell user to run npm install if no deps change", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "foo",
      dependencies: {
        "foo": "^1.5.0",
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "package.json": pkg({
        dependencies: {
          foo: "^1.0.0",
        },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "package.json": {
        result: "pass",
      },
    },
  });
});
