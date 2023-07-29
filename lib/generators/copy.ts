import { dirname } from 'node:path';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

import { Generator, type GeneratorOptions, type GeneratorResults } from './abstract';

export class CopyGenerator extends Generator {
  constructor (options: GeneratorOptions) {
    super(options);

    if (!this.options.sourcePath) {
      throw new Error('Must specify a source path');
    }
  }

  async apply (targetPath: string): Promise<GeneratorResults> {
    await mkdir(dirname(targetPath), { recursive: true });
    try {
      // non-null assertion is safe as the constructor will throw if sourcePath is unset
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await copyFile(this.options.sourcePath!, targetPath);
      return this.pass();
    } catch (err) {
      const { code, message } = err as { code?: string; message: string };
      // istanbul ignore next - no need to test message fallback
      return this.fail(code ?? message);
    }
  }

  async verify (targetPath: string): Promise<GeneratorResults> {
    let actual;
    try {
      actual = await readFile(targetPath);
    } catch (err) {
      const { code, message } = err as { code?: string; message: string };
      // istanbul ignore next - no need to test passthrough throws
      if (code !== 'ENOENT') {
        return this.fail(code ?? message);
      }

      return this.fail('missing');
    }

    // non-null assertion is safe as constructor will throw if sourcePath is unset
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const expected = await readFile(this.options.sourcePath!);
    if (actual.compare(expected) === 0) {
      return this.pass();
    }

    return this.fail('contents do not match');
  }
}
