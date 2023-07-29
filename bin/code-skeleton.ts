#!/usr/bin/env ts-node

import { dirname } from 'node:path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import {
  getPackageConfig,
  type Flags,
} from '../lib/config';
import {
  applySkeleton,
  verifySkeleton,
} from '../lib/index';

void yargs(hideBin(process.argv))
  .option('verbose', {
    alias: 'V',
    default: false,
    type: 'boolean',
    describe: 'enable verbose logging',
  })
  .command({
    command: 'apply',
    describe: 'apply a code skeleton',
    handler: async (argv: unknown) => {
      const from = process.env.npm_package_json
        ? dirname(process.env.npm_package_json)
        : process.cwd();

      const config = await getPackageConfig(from, argv as Flags);
      const result = await applySkeleton(config);
      process.exitCode = result.exitCode;
    },
  })
  .command({
    command: 'verify',
    describe: 'verify a code skeleton',
    handler: async (argv: unknown) => {
      const from = process.env.npm_package_json
        ? dirname(process.env.npm_package_json)
        : process.cwd();

      const config = await getPackageConfig(from, argv as Flags);
      const result = await verifySkeleton(config);
      process.exitCode = result.exitCode;
    },
  })
  .demandCommand()
  .help()
  .version()
  .argv;
