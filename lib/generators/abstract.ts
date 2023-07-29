import type { Config } from '../config';

export interface GeneratorOptions {
  sourcePath?: string;
}

export interface GeneratorResults {
  result: 'pass' | 'fail';
  messages?: string[];
}

interface BaseResults {
  exitCode: number;
}
export type SkeletonResults = BaseResults & Record<string, GeneratorResults>;

export abstract class Generator {
  options: GeneratorOptions;

  errors: string[] = [];

  constructor (options: GeneratorOptions) {
    this.options = options;
  }

  pass (...messages: string[]): GeneratorResults {
    return {
      result: 'pass',
      messages,
    };
  }

  fail (...messages: string[]): GeneratorResults {
    return {
      result: 'fail',
      messages,
    };
  }

  abstract apply (targetPath: string, config: Config): Promise<GeneratorResults>;
  abstract verify (targetPath: string, config: Config): Promise<GeneratorResults>;
}

