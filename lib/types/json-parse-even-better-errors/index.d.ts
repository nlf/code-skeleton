module "json-parse-even-better-errors" {
  export const Indent = Symbol.for("indent");
  export const Newline = Symbol.for("newline");

  interface JsonResult {
    [Indent]: string;
    [Newline]: string;

    [key: string]: unknown;
  }

  export default function (string): JsonResult;
}
