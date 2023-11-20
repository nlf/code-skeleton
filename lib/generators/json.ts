import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import parseJson, { Indent, Newline } from "json-parse-even-better-errors";

import { Generator, type GenerateInput, type ValidateInput } from "./abstract";

export interface JsonOptions {
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

export class JsonGenerator extends Generator<JsonOptions> {
  async generate (options: GenerateInput): Promise<string> {
    let existingContent: string;
    try {
      existingContent = await readFile(options.path, { encoding: "utf8" });
    } catch (_err) {
      const err = _err as Error & { code?: string };
      /* c8 ignore next 3 - no need to cover re-throwing */
      if (err.code !== "ENOENT") {
        throw err;
      }

      existingContent = "{}";
    }

    const existingObject = parseJson(existingContent);

    // istanbul ignore else - don't care
    if (this.options.set) {
      for (const [key, value] of Object.entries(this.options.set)) {
        deepSet(existingObject, key, value);
      }
    }

    // istanbul ignore else - don't care
    if (this.options.delete) {
      for (const key of this.options.delete) {
        // setting the key to undefined means it will be stripped when we stringify it later
        deepSet(existingObject, key, undefined);
      }
    }

    // istanbul ignore else - don't care
    if (this.options.append) {
      for (const [key, values] of Object.entries(this.options.append)) {
        const existingField = deepGet(existingObject, key);
        const arrayContents: unknown[] = existingField && Array.isArray(existingField)
          ? existingField
          : [];

        for (const value of values) {
          const existingMatch = arrayContents.find((item) => isDeepStrictEqual(value, item));
          if (!existingMatch) {
            arrayContents.push(value);
          }
        }
        deepSet(existingObject, key, arrayContents);
      }
    }

    // istanbul ignore else - don't care
    if (this.options.remove) {
      for (const [key, values] of Object.entries(this.options.remove)) {
        const existingField = deepGet(existingObject, key);
        const arrayContents: unknown[] = existingField && Array.isArray(existingField)
          ? existingField
          : [];

        for (const value of values) {
          const existingMatch = arrayContents.find((item) => isDeepStrictEqual(value, item));
          if (existingMatch) {
            arrayContents.splice(arrayContents.indexOf(existingMatch), 1);
          }
        }
        deepSet(existingObject, key, arrayContents);
      }
    }

    // eslint disabled for these two lines because the types indicate the values are required,
    // however in practice they do sometimes have a value of undefined
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const indentString = existingObject[Indent] ?? "  ";
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const newlineString = existingObject[Newline] ?? "\n";
    const stringContents = JSON.stringify(existingObject, null, indentString)
      .replace(/\n/g, newlineString) + newlineString;

    return stringContents;
  }

  validate (options: ValidateInput): Promise<void> {
    const existingObject = parseJson(options.found);

    if (this.options.set) {
      for (const [key, value] of Object.entries(this.options.set)) {
        const deepValue = deepGet(existingObject, key);
        if (deepValue === undefined) {
          this.report({
            field: key,
            expected: value,
          });
        } else if (deepValue !== value) {
          this.report({
            field: key,
            expected: value,
            found: deepValue,
          });
        }
      }
    }

    if (this.options.delete) {
      for (const key of this.options.delete) {
        const deepValue = deepGet(existingObject, key);
        if (deepValue) {
          this.report({
            field: key,
            found: deepValue,
          });
        }
      }
    }

    if (this.options.append) {
      for (const [key, values] of Object.entries(this.options.append)) {
        const existingField = deepGet(existingObject, key);
        if (!existingField || !Array.isArray(existingField)) {
          this.report({
            field: key,
            message: "should be an array",
          });
          continue;
        }

        const arrayContents: unknown[] = existingField;
        for (const value of values) {
          const existingMatch = arrayContents.find((item) => isDeepStrictEqual(value, item));
          if (!existingMatch) {
            this.report({
              field: key,
              expected: value,
            });
          }
        }
      }
    }

    if (this.options.remove) {
      for (const [key, values] of Object.entries(this.options.remove)) {
        const existingField = deepGet(existingObject, key);
        if (!existingField || !Array.isArray(existingField)) {
          this.report({
            field: key,
            message: "should be an array",
          });
          continue;
        }

        const arrayContents: unknown[] = existingField;
        for (const value of values) {
          const existingMatch = arrayContents.find((item) => isDeepStrictEqual(value, item));
          if (existingMatch) {
            this.report({
              field: key,
              found: value,
            });
          }
        }
      }
    }

    return Promise.resolve();
  }
}

