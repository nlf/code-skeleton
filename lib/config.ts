import { join } from "node:path";

import promiseSpawn from "@npmcli/promise-spawn";
import readPackageJson from "read-package-json-fast";

import type { Generator } from "./generators/abstract";

// this is used as a type for the readPackageJson result so that we can inspect and validate
interface MaybePackageConfig {
  skeleton?: {
    factory?: string;
    module?: string;
    variables?: object;
  };
}

export interface Config {
  module: string;
  path: string;
  skeleton: Skeleton;
  variables: object;
  flags: Flags;
}

export type Skeleton = Record<string, Generator>;
export type SkeletonFactory = Record<string, (root: string, variables: object) => Promise<Skeleton>>;

export interface Flags {
  verbose?: boolean;
  silent?: boolean;
}

export async function getPackageConfig (from: string, flags: Flags = {}): Promise<Config> {
  const path = await findPackageRoot(from);
  const rawPackage: MaybePackageConfig = await readPackageJson(join(path, "package.json"));

  const module = rawPackage.skeleton?.module;
  if (typeof module !== "string") {
    throw new Error("Missing or invalid skeleton module specified");
  }

  const factoryKey = rawPackage.skeleton?.factory ?? "default";
  const variables = rawPackage.skeleton?.variables ?? {};

  const skeletonPath = require.resolve(module, { paths: [path] });
  let skeleton;
  try {
    // disabling no-var-requires here because that is literally how this app functions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const skeletonFactory = require(skeletonPath) as SkeletonFactory;
    skeleton = await skeletonFactory[factoryKey](path, variables);
  } catch (err) {
    throw new Error(`Unable to load skeleton '${module}': ${(err as Error).message}`);
  }

  return {
    module,
    path,
    skeleton,
    variables,
    flags,
  };
}

async function findPackageRoot (from: string): Promise<string> {
  // ask npm what its prefix is. note that if there is no package.json in the filesystem
  // at the given directory or in its ancestry, this command will simply return the cwd
  const npmResult = await promiseSpawn("npm", ["prefix"], { cwd: from });
  return npmResult.stdout.trim();
}
