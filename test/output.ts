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
    "foo.json": {
      result: "fail",
      messages: [
        "\"foo\" missing",
      ],
    },
    "bar.json": {
      result: "fail",
      messages: [
        "missing",
      ],
    },
    "baz.json": {
      result: "pass",
    },
    "beep.txt": {
      result: "fail",
      messages: [
        "missing",
      ],
    },
  });

  t.hasStrict(messages, [
    "verifying skeleton...",
    "foo.json: FAILED",
    "\"foo\" missing",
    "bar.json: FAILED",
    "missing",
    "baz.json: OK",
    "beep.txt: FAILED",
    "missing",
  ]);

  // to make the apply fail we make a directory in place of beep.txt
  await mkdir(join(root, "beep.txt"));

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
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
      messages: [
        "EISDIR",
      ],
    },
  });
});
