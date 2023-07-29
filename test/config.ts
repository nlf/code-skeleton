import t from "tap";
import spawk from "spawk";

import { getPackageConfig } from "../lib/config";

void t.test("can read a simple config", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "my-project",
      skeleton: {
        module: "my-skeleton",
      },
    }),
    node_modules: {
      "my-skeleton": {
        "package.json": JSON.stringify({
          name: "my-skeleton",
          main: "index.js",
        }),
        "index.js": "exports.default = async () => ({})",
      },
    },
  });

  const config = await getPackageConfig(root, { verbose: true });
  t.hasStrict(config, {
    module: "my-skeleton",
    path: root,
    skeleton: {},
    variables: {},
    flags: {
      verbose: true,
    },
  });
});

void t.test("errors when module is unset", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "my-project",
    }),
  });

  await t.rejects(() => getPackageConfig(root), { message: /Missing or invalid skeleton module/ });
});

void t.test("errors when module cant be required", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "my-project",
      skeleton: {
        module: "my-skeleton",
      },
    }),
    node_modules: {
      "my-skeleton": {
        "package.json": JSON.stringify({
          name: "my-skeleton",
          main: "index.js",
        }),
        // deliberate typo here to cause require to break
        "index.js": "module.exports = () => {",
      },
    },
  });

  await t.rejects(() => getPackageConfig(root), { message: /Unable to load skeleton/ });
});

void t.test("errors when npm prefix fails", async (t) => {
  const root = t.testdir({
    "package.json": JSON.stringify({
      name: "my-project",
    }),
  });

  spawk.spawn("npm", ["prefix"]).exit(1);
  await t.rejects(() => getPackageConfig(root), { message: /command failed/ });
  spawk.done();
});
