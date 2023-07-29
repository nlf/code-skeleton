import type { GeneratorOptions } from './abstract';
import { CopyGenerator } from './copy';
import { JsonGenerator, type JsonOptions } from './json';
import { PackageGenerator, type PackageOptions } from './package';

export function copy (sourcePath: string, options: GeneratorOptions = {}) {
  return new CopyGenerator({ ...options, sourcePath });
}

export function json (options: JsonOptions) {
  return new JsonGenerator(options);
}

export function pkg (options: PackageOptions) {
  return new PackageGenerator(options);
}
