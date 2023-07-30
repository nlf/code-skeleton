import { readFile } from "node:fs/promises";
import { join } from "node:path";
import t from "tap";

import { json, applySkeleton, verifySkeleton } from "../lib";
import type { Config } from "../lib/config";

void t.test("can modify json", async (t) => {
  const root = t.testdir({
    "foo.json": JSON.stringify({
      name: "my-package",
      keywords: ["test", "banana"],
      bloop: ["one"],
      foo: "bar",
      bar: "baz",
      dupes: ["bacon"],
      notanarray: "test",
    }),
  });
  const jsonPath = join(root, "foo.json");

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.json": json({
        set: {
          foo: "baz",
        },
        delete: ["bar"],
        append: {
          dupes: ["bacon"],
          bloop: ["two"],
          files: ["lib", "bin"],
        },
        remove: {
          notanarray: ["wat"],
          nothinghere: ["foo"],
          bloop: ["three"],
          keywords: ["test"],
        },
      }),
      "extra.json": json({
        set: { bar: "baz" },
      }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const initialVerifyResult = await verifySkeleton(config);

  t.hasStrict(initialVerifyResult, {
    "foo.json": {
      result: "fail",
      messages: ['"foo" set to "bar" but expected "baz"'],
    },
    "extra.json": {
      result: "fail",
      messages: ["file missing"],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    "foo.json": {
      result: "pass",
    },
    "extra.json": {
      result: "pass",
    },
  });

  const rawFoo = await readFile(jsonPath, { encoding: "utf8" });
  const actualFoo: unknown = JSON.parse(rawFoo);
  t.same(actualFoo, {
    name: "my-package",
    foo: "baz",
    notanarray: "test",
    nothinghere: [],
    dupes: ["bacon"],
    bloop: ["one", "two"],
    keywords: ["banana"],
    files: ["lib", "bin"],
  });

  const rawExtra = await readFile(join(root, "extra.json"), { encoding: "utf8" });
  const actualExtra: unknown = JSON.parse(rawExtra);
  t.same(actualExtra, {
    bar: "baz",
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    "foo.json": {
      result: "pass",
    },
    "extra.json": {
      result: "pass",
    },
  });
});

void t.test("unparseable json shows as invalid", async (t) => {
  const root = t.testdir({
    "foo.json": "{ lol nope }",
  });

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

  const result = await verifySkeleton(config);
  t.hasStrict(result, {
    "foo.json": {
      result: "fail",
      messages: ["invalid json"],
    },
  });
});

void t.test("missing property shows as invalid", async (t) => {
  const root = t.testdir({
    "foo.json": JSON.stringify({}),
  });

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

  const result = await verifySkeleton(config);
  t.hasStrict(result, {
    "foo.json": {
      result: "fail",
      messages: ['"foo" missing'],
    },
  });
});

void t.test("a deleted key being present is invalid", async (t) => {
  const root = t.testdir({
    "foo.json": JSON.stringify({ foo: "bar" }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.json": json({ delete: ["foo"] }),
    },
    variables: {},
    flags: {
      silent: true,
    },
  };

  const result = await verifySkeleton(config);
  t.hasStrict(result, {
    "foo.json": {
      result: "fail",
      messages: ['"foo" is present and should be deleted'],
    },
  });
});

void t.test("can set a deep key", async (t) => {
  const root = t.testdir({
    "foo.json": JSON.stringify({
      present: {
        field: "toast",
        goaway: "has a value",
      },
      here: {
        array: [],
        needsprune: ["one", "two"],
      },
    }),
  });

  const config: Config = {
    path: root,
    module: "irrelevant",
    skeleton: {
      "foo.json": json({
        set: {
          "present.field": "test",
          "missing.field": "test",
        },
        delete: ["present.goaway"],
        append: {
          "here.array": ["test"],
          "nothere.array": ["test"],
        },
        remove: {
          "here.needsprune": ["one"],
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
    "foo.json": {
      result: "fail",
      messages: ['"present.field" set to "toast" but expected "test"'],
    },
  });

  const result = await applySkeleton(config);
  t.hasStrict(result, {
    "foo.json": {
      result: "pass",
    },
  });

  const fileContents = await readFile(join(root, "foo.json"), { encoding: "utf8" });
  const jsonFile = JSON.parse(fileContents) as Record<string, Record<string, unknown>>;

  t.hasStrict(jsonFile, {
    present: {
      field: "test",
    },
    missing: {
      field: "test",
    },
    here: {
      array: ["test"],
      needsprune: ["two"],
    },
    nothere: {
      array: ["test"],
    },
  });
});
