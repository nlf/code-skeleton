import { dirname } from "node:path";
import packageJson from "@npmcli/package-json";
import semver from "semver";

import { Generator, type GeneratorOptions, type GeneratorResults } from "./abstract";

// user inputs
export interface PackageOptions extends GeneratorOptions {
  engines?: Record<string, string>;
  files?: {
    append?: string[];
    remove?: string[];
  };
  license?: string;
  main?: string;
  scripts?: Record<string, string>;

  bundledDependencies?: {
    append?: string[];
    remove?: string[];
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: true }>;
  removeDependencies?: string[];

  [key: string]: unknown;
}

// base of object passed to packageJson.update()
// these fields are grouped so that we can loop over them more easily
interface MutationObjects {
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const dependencyProperties = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const objectProperties = [
  "engines",
  "scripts",
];

// rest of the object passed to packageJson.update()
interface MutationRequest extends MutationObjects {
  files?: string[];
  license?: string;
  main?: string;
  bundledDependencies?: string[];
  peerDependenciesMeta?: Record<string, { optional: true }>;
}

export class PackageGenerator extends Generator {
  async apply (targetPath: string): Promise<GeneratorResults> {
    const options = this.options as PackageOptions;
    const pkg = await packageJson.load(dirname(targetPath));

    const updateRequest: MutationRequest = {};

    if (options.main) {
      updateRequest.main = options.main;
    }

    if (options.license) {
      updateRequest.license = options.license;
    }

    let dependenciesModified = false;
    for (const _field of objectProperties) {
      const field = _field as keyof MutationObjects;
      if (options[field]) {
        const value = {
          ...pkg.content[field],
          ...options[field],
        };

        if (Object.keys(value).length > 0) {
          updateRequest[field] = value;
        }
      }
    }

    for (const _field of dependencyProperties) {
      const field = _field as keyof MutationObjects;
      if (options[field]) {
        const deps: Record<string, string> = {
          ...pkg.content[field],
        };

        for (const [name, range] of Object.entries(options[field] as object)) {
          // if the dependency is already present in the package.json, and the
          // semver range that is set is a subset of the one requested by the
          // skeleton, then we leave it alone
          if (name in deps && semver.subset(deps[name], range as string)) {
            continue;
          }

          dependenciesModified = true;
          deps[name] = range as string;
        }

        if (dependenciesModified) {
          updateRequest[field] = deps;
        }
      }
    }

    if (options.peerDependenciesMeta) {
      dependenciesModified = true;
      const peerMeta = {
        ...pkg.content.peerDependenciesMeta,
        ...options.peerDependenciesMeta,
      };

      if (Object.keys(peerMeta).length > 0) {
        updateRequest.peerDependenciesMeta = peerMeta;
      }
    }

    if (options.bundledDependencies) {
      dependenciesModified = true;
      const {
        append = [],
        remove = [],
      } = options.bundledDependencies;

      const bundledDeps = [
        ...pkg.content.bundledDependencies ?? [],
        ...append,
      ].filter((bundle) => !remove.includes(bundle));
      updateRequest.bundledDependencies = bundledDeps.length > 0
        ? bundledDeps
        : undefined;
    }

    if (options.removeDependencies) {
      for (const _field of dependencyProperties) {
        const field = _field as keyof MutationObjects;

        const value = {
          ...pkg.content[field],
          ...options[field],
        } as Record<string, string>;

        const peerMeta = {
          ...pkg.content.peerDependenciesMeta,
          ...options.peerDependenciesMeta,
        };

        const bundledDependencies = Array.from(new Set([
          ...pkg.content.bundledDependencies ?? [],
          ...updateRequest.bundledDependencies ?? [],
        ]));

        const toRemove: string[] = options.removeDependencies;
        for (const name of toRemove) {
          if (name in value) {
            dependenciesModified = true;
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete value[name];
          }

          if (name in peerMeta) {
            dependenciesModified = true;
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete peerMeta[name];
          }

          if (bundledDependencies.includes(name)) {
            dependenciesModified = true;
            bundledDependencies.splice(bundledDependencies.indexOf(name), 1);
          }
        }

        updateRequest[field] = value;
        updateRequest.peerDependenciesMeta = Object.keys(peerMeta).length > 0
          ? peerMeta
          : undefined;

        updateRequest.bundledDependencies = bundledDependencies.length > 0
          ? bundledDependencies
          : undefined;
      }
    }

    if (options.files) {
      const {
        append = [],
        remove = [],
      } = options.files;

      const files = Array.from(new Set([
        ...pkg.content.files ?? [],
        ...append,
      ].filter((file) => !remove.includes(file))));
      updateRequest.files = files.length > 0
        ? files
        : undefined;
    }

    pkg.update(updateRequest);

    try {
      await pkg.save();
      if (dependenciesModified) {
        return this.pass("one or more changes were made to your project's dependencies, make sure to run `npm install`");
      }
      return this.pass();
    } catch (err) /* istanbul ignore next */ {
      // coverage disabled due to complexity in testing
      const { code, message } = err as { code?: string; message: string };
      return this.fail(code ?? message);
    }
  }

  async verify (targetPath: string): Promise<GeneratorResults> {
    const options = this.options as PackageOptions;
    const pkg = await packageJson.load(dirname(targetPath));

    const errors = [];

    if (options.main) {
      if (pkg.content.main !== options.main) {
        errors.push(`"main" expected to be "${options.main}" but found "${pkg.content.main ?? "undefined"}"`);
      }
    }

    if (options.license) {
      if (pkg.content.license !== options.license) {
        errors.push(`"license" expected to be "${options.license}" but found "${pkg.content.license ?? "undefined"}"`);
      }
    }

    if (options.engines) {
      for (const [key, value] of Object.entries(options.engines)) {
        if (pkg.content.engines?.[key] !== value) {
          errors.push(`"engines.${key}" expected to be "${value}" but found "${pkg.content.engines?.[key] ?? "undefined"}"`);
        }
      }
    }

    if (options.files) {
      for (const file of options.files.append ?? []) {
        if (!(pkg.content.files?.includes(file))) {
          errors.push(`"files" is missing expected entry "${file}"`);
        }
      }

      for (const file of options.files.remove ?? []) {
        if (pkg.content.files?.includes(file)) {
          errors.push(`"files" found unexpected entry "${file}"`);
        }
      }
    }

    if (options.scripts) {
      for (const [key, value] of Object.entries(options.scripts)) {
        if (pkg.content.scripts?.[key] !== value) {
          errors.push(`"scripts.${key}" expected to be "${value}" but found "${pkg.content.scripts?.[key] ?? "undefined"}"`);
        }
      }
    }

    for (const _field of dependencyProperties) {
      const field = _field as keyof MutationObjects;
      if (options[field]) {
        // non-null assertion is safe because we check for truthiness above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        for (const [key, value] of Object.entries(options[field]!)) {
          const deps = {
            ...pkg.content[field],
          };

          if (!(key in deps)) {
            errors.push(`"${field}" is missing expected entry "${key}"`);
          } else {
            // non-null assertion is safe because the previous condition handles the cases
            // where the dependency key or the dependency name properties are unset
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const currentRange = pkg.content[field]![key];
            if (!semver.subset(currentRange, value)) {
              errors.push(`"${field}.${key}" expected to be a subset of "${value}" but found "${currentRange}"`);
            }
          }
        }
      }
    }

    if (options.bundledDependencies) {
      for (const bundle of options.bundledDependencies.append ?? []) {
        if (!(pkg.content.bundledDependencies?.includes(bundle))) {
          errors.push(`"bundledDependencies" is missing expected entry "${bundle}"`);
        }
      }

      for (const bundle of options.bundledDependencies.remove ?? []) {
        if (pkg.content.bundledDependencies?.includes(bundle)) {
          errors.push(`"files" found unexpected entry "${bundle}"`);
        }
      }
    }

    if (options.peerDependenciesMeta) {
      for (const [key, value] of Object.entries(options.peerDependenciesMeta)) {
        if (!(key in (pkg.content.peerDependenciesMeta ?? {}))) {
          errors.push(`"peerDependenciesMeta" is missing expected entry "${key}"`);
        } else {
          // non-null assertion is safe because the condition above covers the case
          // where the peerDependenciesMeta key itself or the package key are missing
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const currentMeta: { optional?: boolean } = pkg.content.peerDependenciesMeta![key];
          const currentOptional = currentMeta.optional === true;
          const proposedMeta: { optional?: boolean } = value;
          const proposedOptional = proposedMeta.optional === true;
          if (currentOptional !== proposedOptional) {
            errors.push(`"peerDependenciesMeta.${key}.optional" expected to be "${proposedOptional.toString()}" but found "${currentOptional.toString()}"`);
          }
        }
      }
    }

    if (options.removeDependencies) {
      for (const name of options.removeDependencies) {
        if (pkg.content.bundledDependencies?.includes(name)) {
          errors.push(`"bundledDependencies" includes unwanted entry "${name}"`);
        }

        if (name in (pkg.content.dependencies ?? {})) {
          errors.push(`"dependencies" includes unwanted entry "${name}"`);
        }

        if (name in (pkg.content.devDependencies ?? {})) {
          errors.push(`"devDependencies" includes unwanted entry "${name}"`);
        }

        if (name in (pkg.content.optionalDependencies ?? {})) {
          errors.push(`"optionalDependencies" includes unwanted entry "${name}"`);
        }

        if (name in (pkg.content.peerDependencies ?? {})) {
          errors.push(`"peerDependencies" includes unwanted entry "${name}"`);
        }

        if (name in (pkg.content.peerDependenciesMeta ?? {})) {
          errors.push(`"peerDependenciesMeta" includes unwanted entry "${name}"`);
        }
      }
    }

    return errors.length
      ? this.fail(...errors)
      : this.pass();
  }
}
