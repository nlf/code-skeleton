import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import packageJson from "@npmcli/package-json";
import { Indent, Newline } from "json-parse-even-better-errors";
import semver from "semver";

import { Generator, type GenerateInput, type ValidateInput } from "./abstract";
import { type GeneratorProblemSpec } from "./problem";
import { GeneratorReportResult } from "./report";

// eslint ignored here, this needs to be an interface to avoid self references
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
interface R<T> { [key: string]: T }
type ArrayMutation = { append: unknown[]; remove?: unknown[] } | { append?: unknown[]; remove: unknown[] };
type ValueMutation = string | string[] | number | boolean | null | ArrayMutation | R<ValueMutation>;
export type PackageOptions = Record<string, ValueMutation>;

type Content = Record<string, string | number | boolean | null | undefined | Content[] | R<Content>>;

const dependencyProperties = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export class PackageGenerator extends Generator<PackageOptions> {
  async generate (options: GenerateInput): Promise<string> {
    const pkg = await packageJson.load(dirname(options.path), { create: true });
    const content = pkg.content as Content;
    let dependenciesModified = false;

    const updateRequest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.options)) {
      if (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null) {

        updateRequest[key] = value;
        continue;
      }

      const arrayMutation = value as ArrayMutation;
      if (arrayMutation.append || arrayMutation.remove) {
        const {
          append = [],
          remove = [],
        } = arrayMutation;

        const current = content[key] ?? [];
        const replacement: unknown[] = [
          ...current as unknown[],
          ...append,
        ].filter((item) => !remove.includes(item));

        if (key === "bundledDependencies") {
          dependenciesModified = true;
        }

        updateRequest[key] = replacement;
        continue;
      }

      if (dependencyProperties.includes(key)) {
        const current = content[key] ?? {};
        const replacement = {
          ...current as R<unknown>,
        };

        for (const [name, range] of Object.entries(value)) {
          if (name in replacement && semver.subset(replacement[name] as string, range as string)) {
            continue;
          }

          dependenciesModified = true;
          replacement[name] = range;
        }

        if (dependenciesModified) {
          updateRequest[key] = replacement;
        }

        continue;
      }

      if (key !== "removeDependencies") {
        const current = content[key] ?? {};
        const replacement = {
          ...current as Record<string, unknown>,
          ...value,
        };

        if (key === "peerDependenciesMeta") {
          dependenciesModified = true;
        }

        updateRequest[key] = Object.keys(replacement).length > 0 ? replacement : undefined;
      }
    }

    if (Array.isArray(this.options.removeDependencies)) {
      for (const name of this.options.removeDependencies) {
        for (const key of dependencyProperties) {
          // istanbul ignore next - defense in depth
          const current = (key in updateRequest
            ? (updateRequest[key] ?? {})
            : (content[key] ?? {})
          ) as Record<string, unknown>;

          if (name in current) {
            dependenciesModified = true;
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete current[name];
            updateRequest[key] = current;
          }
        }

        const peerDependenciesMeta = ("peerDependenciesMeta" in updateRequest
          ? (updateRequest.peerDependenciesMeta ?? {})
          : (content.peerDependenciesMeta ?? {})
        ) as Record<string, unknown>;

        if (name in peerDependenciesMeta) {
          dependenciesModified = true;
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete peerDependenciesMeta[name];
          // XXX this is here because @npmcli/package-json doesn't remove this field when empty
          updateRequest.peerDependenciesMeta = Object.keys(peerDependenciesMeta).length > 0
            ? peerDependenciesMeta
            : undefined;
        }

        const bundledDependencies = ("bundledDependencies" in updateRequest
          ? updateRequest.bundledDependencies
            ? updateRequest.bundledDependencies
            : []
          : content.bundledDependencies
            ? content.bundledDependencies
            : []) as unknown[];

        if (bundledDependencies.includes(name)) {
          dependenciesModified = true;
          bundledDependencies.splice(bundledDependencies.indexOf(name), 1);
          // XXX this is here because @npmcli/package-json doesn't remove this field when empty
          updateRequest.bundledDependencies = bundledDependencies.length > 0
            ? bundledDependencies
            : undefined;
        }
      }
    }

    pkg.update(updateRequest);

    if (dependenciesModified) {
      this.note("one or more changes were made to your project's dependencies, make sure to run `npm install`");
    }

    // eslint disabled for these two lines because the types indicate the values are required,
    // however in practice they do sometimes have a value of undefined
    // @ts-expect-error the types of pkg.content are very wrong
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,@typescript-eslint/no-unsafe-assignment
    const indentString: string = pkg.content[Indent] ?? "  ";
    // @ts-expect-error the types of pkg.content are very wrong
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,@typescript-eslint/no-unsafe-assignment
    const newlineString: string = pkg.content[Newline] ?? "\n";
    const fileContent = `${JSON.stringify(pkg.content, null, indentString)}\n`.replace(/\n/g, newlineString);
    return fileContent;
  }

  async validate (options: ValidateInput): Promise<GeneratorReportResult> {
    // these are on two lines because i want to figure out if i care about eslint not letting me `let foo: boolean = false`
    let failed: boolean;
    failed = false;
    const pkg = await packageJson.load(dirname(options.path));
    const content = pkg.content as Content;

    const report = (x: GeneratorProblemSpec) => {
      this.report(x);
      failed = true;
    };

    for (const [key, value] of Object.entries(this.options)) {
      if (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null) {

        if (content[key] !== value) {
          report({
            field: key,
            expected: value,
            found: content[key],
          });
        }

        continue;
      }

      const arrayMutation = value as ArrayMutation;
      if (arrayMutation.append || arrayMutation.remove) {
        const {
          append = [],
          remove = [],
        } = arrayMutation;

        const current = (content[key] ?? []) as unknown[];
        for (const name of append) {
          if (!current.includes(name)) {
            report({
              field: key,
              expected: name,
            });
          }
        }

        for (const name of remove) {
          if (current.includes(name)) {
            report({
              field: key,
              found: name,
            });
          }
        }

        continue;
      }

      if (dependencyProperties.includes(key)) {
        const current = (content[key] ?? {}) as Record<string, unknown>;
        for (const [name, range] of Object.entries(value)) {
          if (!(name in current)) {
            report({
              field: `${key}.${name}`,
              expected: range,
            });
          } else if (!semver.subset(current[name] as string, range as string)) {
            report({
              field: `${key}.${name}`,
              message: `expected to be a subset of "${range as string}" but found "${current[name] as string}"`,
            });
          }
        }
        continue;
      }

      if (key !== "removeDependencies") {
        const current = (content[key] ?? {}) as Record<string, unknown>;
        for (const [name, prop] of Object.entries(value)) {
          if (!(name in current)) {
            report({
              field: `${key}.${name}`,
              expected: prop,
            });
          } else if (!isDeepStrictEqual(current[name], prop)) {
            report({
              field: `${key}.${name}`,
              expected: prop,
              found: current[name],
            });
          }
        }
        continue;
      }
    }

    if (Array.isArray(this.options.removeDependencies)) {
      for (const name of this.options.removeDependencies) {
        for (const key of dependencyProperties) {
          const current = (content[key] ?? {}) as Record<string, unknown>;
          if (name in current) {
            report({
              field: key,
              found: name,
            });
          }
        }

        const bundledDeps = (content.bundledDependencies ?? []) as unknown[];
        if (bundledDeps.includes(name)) {
          report({
            field: "bundledDependencies",
            found: name,
          });
        }

        const peerMeta = (content.peerDependenciesMeta ?? {}) as Record<string, unknown>;
        if (name in peerMeta) {
          report({
            field: "peerDependenciesMeta",
            found: name,
          });
        }
      }
    }

    // rule disabled because typescript doesn't like the pattern of wrapping this.report in a function
    // in order to set the failed flag, but i'm lazy and it's how i want to do it so i'll deal with this later
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return failed ? GeneratorReportResult.Fail : GeneratorReportResult.Pass;
  }
}
