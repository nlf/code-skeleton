import { readFile, writeFile } from "node:fs/promises";
import parseJson, { Indent, Newline } from "json-parse-even-better-errors";

import { Generator, type GeneratorOptions, type GeneratorResults } from "./abstract";

export interface JsonOptions extends GeneratorOptions {
  set?: Record<string, unknown>;
  delete?: string[];
  append?: Record<string, unknown[]>;
  remove?: Record<string, unknown[]>;
}

type JsonObject = Record<string, unknown>;

function deepSet (obj: JsonObject, key: string, value: unknown) {
  const segments: string[] = key.split(".");
  // non-null assertion allowed here because we know the result of splitting a string is an array of strings
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const final = segments.pop()!;

  let current = obj;
  for (const segment of segments) {
    if (!(segment in obj)) {
      obj[segment] = {};
    }
    current = obj[segment] as JsonObject;
  }

  current[final] = value;
}

function deepGet (obj: JsonObject, key: string) {
  const segments: string[] = key.split(".");
  // non-null assertion allowed here because we know the result of splitting a string is an array of strings
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const final = segments.pop()!;

  let current = obj;
  for (const segment of segments) {
    if (!(segment in obj)) {
      obj[segment] = {};
    }
    current = obj[segment] as JsonObject;
  }

  return current[final];
}

export class JsonGenerator extends Generator {
  async apply (targetPath: string): Promise<GeneratorResults> {
    let fileContents;
    try {
      fileContents = await readFile(targetPath, { encoding: "utf8" });
    } catch (err) {
      fileContents = "{}";
    }

    const parsedContents = parseJson(fileContents);
    const options = this.options as JsonOptions;

    // istanbul ignore else - don't care
    if (options.set) {
      for (const [key, value] of Object.entries(options.set)) {
        deepSet(parsedContents, key, value);
      }
    }

    // istanbul ignore else - don't care
    if (options.delete) {
      for (const key of options.delete) {
        // setting the key to undefined means it will be stripped when we stringify it later
        deepSet(parsedContents, key, undefined);
      }
    }

    // istanbul ignore else - don't care
    if (options.append) {
      for (const [key, values] of Object.entries(options.append)) {
        const arrayContents = (deepGet(parsedContents, key) ?? []) as unknown[];
        for (const value of values) {
          if (!arrayContents.includes(value)) {
            arrayContents.push(value);
          }
        }
        deepSet(parsedContents, key, arrayContents);
      }
    }

    // istanbul ignore else - don't care
    if (options.remove) {
      for (const [key, values] of Object.entries(options.remove)) {
        const arrayContents = (deepGet(parsedContents, key) ?? []) as unknown[];
        for (const value of values) {
          if (arrayContents.includes(value)) {
            arrayContents.splice(arrayContents.indexOf(value), 1);
          }
        }
        deepSet(parsedContents, key, arrayContents);
      }
    }

    // eslint disabled for these two lines because the types indicate the values are required,
    // however in practice they do sometimes have a value of undefined
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const indentString = parsedContents[Indent] ?? "  ";
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const newlineString = parsedContents[Newline] ?? "\n";
    const stringContents = JSON.stringify(parsedContents, null, indentString)
      .replace(/\n/g, newlineString) + newlineString;

    await writeFile(targetPath, stringContents);

    return this.pass();
  }

  async verify (targetPath: string): Promise<GeneratorResults> {
    const failures: string[] = [];

    let fileContents;
    try {
      fileContents = await readFile(targetPath, { encoding: "utf8" });
    } catch (err) {
      const { code } = err as { code: string };
      // istanbul ignore next - no need to test passthrough errors
      if (code !== "ENOENT") {
        return this.fail(code);
      }

      return this.fail("missing");
    }

    let parsedContents;
    try {
      parsedContents = parseJson(fileContents);
    } catch (err) {
      return this.fail("invalid json");
    }

    const options = this.options as JsonOptions;
    if (options.set) {
      for (const [key, value] of Object.entries(options.set)) {
        const deepValue = deepGet(parsedContents, key);
        if (deepValue === undefined) {
          failures.push(`"${key}" missing`);
        } else if (deepValue !== value) {
          failures.push(`"${key}" set to ${JSON.stringify(deepValue)} but expected ${JSON.stringify(value)}`);
        }
      }
    }

    if (options.delete) {
      for (const key of options.delete) {
        if (deepGet(parsedContents, key)) {
          failures.push(`"${key}" is present and should be deleted`);
        }
      }
    }
    
    if (options.append) {
      for (const [key, values] of Object.entries(options.append)) {
        const arrayContents = (deepGet(parsedContents, key) ?? []) as string[];
        for (const value of values) {
          if (!arrayContents.includes(value as string)) {
            failures.push(`"${key}" is missing expected value "${value as string}"`);
          }
        }
      }
    }

    if (options.remove) {
      for (const [key, values] of Object.entries(options.remove)) {
        const arrayContents = (deepGet(parsedContents, key) ?? []) as string[];
        for (const value of values) {
          if (arrayContents.includes(value as string)) {
            failures.push(`"${key}" contains unexpected value "${value as string}"`);
          }
        }
      }
    }

    return failures.length
      ? this.fail(...failures)
      : this.pass();
  }
}

