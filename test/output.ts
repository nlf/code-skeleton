import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import t from "tap";

import { copy, json, applySkeleton, verifySkeleton } from "../lib";
import type { Config } from "../lib/config";

void t.test("can log", async (t) => {
  const messages: string[] = [];
  const { group, log } = console;
  t.teardown(() => {
    console.group = group;
    console.log = log;
  });
  console.group = (message: string) => messages.push(message);
  console.log = (message: string) => messages.push(message);

  const root = t.testdir({
    "foo.json": JSON.stringify({}),
    "baz.json": JSON.stringify({
      baz: "buzz",
    }),
    source: {
      "beepboop.txt": "random text",
    },
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.json": json({
        set: {
          foo: "bar",
        },
      }),
      "bar.json": json({
        set: {
          bar: "baz",
        },
      }),
      "baz.json": json({
        set: {
          baz: "buzz",
        },
      }),
      "beep.txt": copy(join(root, "source", "beepboop.txt")),
    },
    variables: {},
    flags: {
      verbose: true,
    },
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    exitCode: 1,
    reports: {
      "foo.json": {
        result: "fail",
        problems: [{
          field: "foo",
          expected: "bar",
        }],
      },
      "bar.json": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
      "baz.json": {
        result: "pass",
      },
      "beep.txt": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  t.hasStrict(messages, [
    "verifying skeleton \"irrelevant\"",
    "bar.json FAILED",
    "file missing",
    "baz.json OK",
    "beep.txt FAILED",
    "file missing",
    "foo.json FAILED",
    "field \"foo\" expected value \"bar\" to be present",
  ]);
  messages.length = 0;

  // to make the apply fail we make a directory in place of beep.txt
  await mkdir(join(root, "beep.txt"));

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 1,
    reports: {
      "foo.json": {
        result: "pass",
      },
      "bar.json": {
        result: "pass",
      },
      "baz.json": {
        result: "pass",
      },
      "beep.txt": {
        result: "fail",
        problems: [{
          code: "EISDIR",
        }],
      },
    },
  });

  t.hasStrict(messages, [
    "applying skeleton \"irrelevant\"",
    "bar.json OK",
    "baz.json OK",
    "beep.txt FAILED",
    `[EISDIR]: EISDIR: illegal operation on a directory, open '${join(root, "beep.txt")}'`,
    "foo.json OK",
  ]);
});

void t.test("can silence logs", async (t) => {
  const messages: string[] = [];
  const { group, log } = console;
  t.teardown(() => {
    console.group = group;
    console.log = log;
  });
  console.group = (message: string) => messages.push(message);
  console.log = (message: string) => messages.push(message);

  const root = t.testdir();
  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.json": json({ set: { foo: "bar" } }),
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
      "foo.json": {
        result: "fail",
        problems: [{
          message: "file missing",
        }],
      },
    },
  });

  t.equal(messages.length, 0);

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    exitCode: 0,
    reports: {
      "foo.json": {
        result: "pass",
      },
    },
  });

  t.equal(messages.length, 0);
});
