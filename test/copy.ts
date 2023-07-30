import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import t from "tap";

import { copy, applySkeleton, verifySkeleton } from "../lib";
import type { Config } from "../lib/config";

void t.test("can copy a file", async (t) => {
  const CONTENT_README = "this is a copied file";

  const root = t.testdir({
    source: {
      "README.md": CONTENT_README,
    },
    target: {
      "package.json": JSON.stringify({
        name: "my-package",
      }),
    },
  });
  const sourcePath = join(root, "source");
  const targetPath = join(root, "target");
  const readmePath = join(targetPath, "README.md");

  const config: Config = {
    path: targetPath,
    module: "irrelevant",
    skeleton: {
      "README.md": copy(join(sourcePath, "README.md")),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);

  t.hasStrict(initialVerifyResult, {
    "README.md": {
      result: "fail",
      messages: ["file missing"],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    "README.md": {
      result: "pass",
    },
  });

  const actualContent = await readFile(readmePath, { encoding: "utf8" });
  t.equal(actualContent, CONTENT_README);

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    "README.md": {
      result: "pass",
    },
  });

  await writeFile(readmePath, "overwritten garbage content");

  const brokenVerifyResult = await verifySkeleton(config);
  t.hasStrict(brokenVerifyResult, {
    "README.md": {
      result: "fail",
      messages: ["contents do not match"],
    },
  });
});

void t.test("throws when no path is provided", (t) => {
  // @ts-expect-error - we are deliberately passing no input here to assert the failure
  t.throws(() => copy(), { message: /Must specify a source path/ });
  t.end();
});

void t.test("surfaces errors", async (t) => {
  const root = t.testdir({
    source: {
      "README.txt": {}, // the source file is a directory
    },
    target: {
      "README.txt": {}, // and so is the target file
    },
  });
  const sourcePath = join(root, "source");
  const targetPath = join(root, "target");

  const config: Config = {
    path: targetPath,
    module: "irrelevant",
    skeleton: {
      "README.txt": copy(join(sourcePath, "README.txt")),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    "README.txt": {
      result: "fail",
      messages: ["EISDIR"],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    "README.txt": {
      result: "fail",
      messages: ["EISDIR"],
    },
  });
});
