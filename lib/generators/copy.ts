import { readFile } from "node:fs/promises";

import { Generator } from "./abstract";

export interface CopyOptions {
  path?: string;
}

export class CopyGenerator extends Generator<CopyOptions> {
  constructor (options: CopyOptions) {
    super(options);

    if (!this.options.path) {
      throw new Error("Must specify a path");
    }
  }

  async generate () {
    // non-null assertion is safe due to check in constructor
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return await readFile(this.options.path!, {
      encoding: "utf8",
    });
  }
}
