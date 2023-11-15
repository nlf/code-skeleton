import { CopyGenerator, type CopyOptions } from "./copy";
import { CustomGenerator, type CustomOptions } from "./custom";
import { JsonGenerator, type JsonOptions } from "./json";
import { PackageGenerator, type PackageOptions } from "./package";

export * from "./abstract";
export * from "./problem";
export * from "./report";

export { CopyOptions };
export function copy (path: string, options?: CopyOptions): CopyGenerator {
  return new CopyGenerator(options ?? { path });
}

export { CustomOptions };
export function custom (options: CustomOptions) {
  return new CustomGenerator(options);
}

export { JsonOptions };
export function json (options: JsonOptions) {
  return new JsonGenerator(options);
}

export { PackageOptions };
export function pkg (options: PackageOptions) {
  return new PackageGenerator(options);
}
