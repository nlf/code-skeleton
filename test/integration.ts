import { cp, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import promiseSpawn from '@npmcli/promise-spawn';
import t from 'tap';

const SKELETON = `
const { join } = require('path');
const { copy, json } = require('code-skeleton');

exports.default = () => ({
  'README.md': copy(join(__dirname, 'README.md')),
});
`;

void t.test('apply', async (t) => {
  await t.test('can apply', async (t) => {
    // first we layout our directory structure
    const root = t.testdir({
      // our target project
      project: {
        'package.json': JSON.stringify({
          name: 'single-copy-target',
          scripts: {
            'apply-skeleton': 'code-skeleton apply',
          },
          skeleton: {
            module: 'skeleton-integration',
          },
        }),
      },
      // the skeleton module that will be applied
      skeleton: {
        'package.json': JSON.stringify({
          name: 'skeleton-integration',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': SKELETON,
        'README.md': 'this is the skeleton readme',
      },
      // a copy of this project will be stored here, this is to avoid cluttering the top level dir
      'code-skeleton': {},
    });
    const project = join(root, 'project');
    const skeleton = join(root, 'skeleton');
    const codeSkeleton = join(root, 'code-skeleton');

    // copy the relevant content to the temp dir
    for (const source of ['bin', 'lib', 'package.json', 'tsconfig.json', 'tsconfig.build.json']) {
      await cp(join(dirname(__dirname), source), join(codeSkeleton, source), { recursive: true });
    }

    // pack this project
    const packResult = await promiseSpawn('npm', ['pack', '--json'], {
      shell: true,
      cwd: codeSkeleton,
    });
    t.equal(packResult.code, 0);
    const packMeta = JSON.parse(packResult.stdout) as { filename: string }[];
    const codeSkeletonTarball = join(codeSkeleton, packMeta[0].filename);

    // now we pack our skeleton module
    const skelPackResult = await promiseSpawn('npm', ['pack', '--json'], {
      shell: true,
      cwd: skeleton,
    });
    t.equal(skelPackResult.code, 0);
    const skelPackMeta = JSON.parse(skelPackResult.stdout) as { filename: string }[];
    const skeletonTarball = join(skeleton, skelPackMeta[0].filename);

    // next, we install code-skeleton itself
    const csInstallResult = await promiseSpawn('npm', ['install', codeSkeletonTarball], {
      shell: true,
      cwd: project,
    });
    t.equal(csInstallResult.code, 0);

    // then we install that
    const skelInstallResult = await promiseSpawn('npm', ['install', skeletonTarball], {
      shell: true,
      cwd: project,
    });
    t.equal(skelInstallResult.code, 0);

    const spawnResult = await promiseSpawn('npm', ['run', 'apply-skeleton'], {
      shell: true,
      cwd: project,
    });
    t.equal(spawnResult.code, 0);

    const readmeContent = await readFile(join(project, 'README.md'), { encoding: 'utf8' });
    t.equal(readmeContent, 'this is the skeleton readme');
  });
});
