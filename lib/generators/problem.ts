import { inspect } from "node:util";

export interface GeneratorProblemSpec {
  code?: string;
  field?: string;
  found?: unknown;
  expected?: unknown;
  message?: string;
}

export class GeneratorProblem implements GeneratorProblemSpec {
  code?: string;
  field?: string;
  found?: unknown;
  expected?: unknown;
  message?: string;

  constructor (problem: GeneratorProblemSpec) {
    Object.assign(this, problem);
  }

  // [$code]: field "$field" $message || "found ${found} but expected ${expected}"
  toString () {
    let result = "";

    if (this.code) {
      result += `[${this.code}]: `;
    }

    if (this.field) {
      result += `field "${this.field}" `;
    }

    if (this.message) {
      result += this.message;
    } else {
      // istanbul ignore else - these are the only combinations we care about
      if (this.expected && this.found) {
        result += `expected "${stringify(this.expected)}" but found "${stringify(this.found)}"`;
      } else if (this.expected) {
        result += `expected value "${stringify(this.expected)}" to be present`;
      } else if (this.found) {
        result += `found unexpected value "${stringify(this.found)}"`;
      }
    }

    return result;
  }
}

function stringify (input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" ||
      typeof input === "boolean" ||
      typeof input === "bigint" ||
      typeof input === "symbol") {
    return input.toString();
  }

  return inspect(input);
}
