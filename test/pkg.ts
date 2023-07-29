import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import t from 'tap';

import { pkg, applySkeleton, verifySkeleton } from '../lib';
import type { Config } from '../lib/config';

void t.test('can add fields to package.json', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
      files: ['/foo'],
      bundledDependencies: ['bar'],
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        engines: {
          node: process.version,
        },
        files: {
          append: ['/lib', '/bin'],
          remove: ['/foo'],
        },
        license: 'MIT',
        main: 'lib/index.js',
        scripts: {
          test: 'tap',
        },
        bundledDependencies: {
          append: ['foo'],
          remove: ['bar'],
        },
        dependencies: {
          foo: '^1.0.0',
        },
        devDependencies: {
          tap: '^16.0.0',
        },
        optionalDependencies: {
          debug: '^4.3.4',
        },
        peerDependencies: {
          once: '^1.4.0',
        },
        peerDependenciesMeta: {
          once: {
            optional: true,
          },
        },
      }),
    },
    variables: {},
    flags: {},
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"main" expected to be "lib/index.js" but found "undefined"',
        '"license" expected to be "MIT" but found "undefined"',
        `"engines.node" expected to be "${process.version}" but found "undefined"`,
        '"files" is missing expected entry "/lib"',
        '"files" is missing expected entry "/bin"',
        '"files" found unexpected entry "/foo"',
        '"scripts.test" expected to be "tap" but found "undefined"',
        '"dependencies" is missing expected entry "foo"',
        '"devDependencies" is missing expected entry "tap"',
        '"optionalDependencies" is missing expected entry "debug"',
        '"peerDependencies" is missing expected entry "once"',
        '"bundledDependencies" is missing expected entry "foo"',
        '"files" found unexpected entry "bar"',
        '"peerDependenciesMeta" is missing expected entry "once"',
      ],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const actualPkg: unknown = JSON.parse(rawPkg);
  t.same(actualPkg, {
    name: 'foo',
    engines: {
      node: process.version,
    },
    files: ['/lib', '/bin'],
    license: 'MIT',
    main: 'lib/index.js',
    scripts: {
      test: 'tap',
    },
    bundledDependencies: ['foo'],
    dependencies: {
      foo: '^1.0.0',
    },
    devDependencies: {
      tap: '^16.0.0',
    },
    optionalDependencies: {
      debug: '^4.3.4',
    },
    peerDependencies: {
      once: '^1.4.0',
    },
    peerDependenciesMeta: {
      once: {
        optional: true,
      },
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    'package.json': {
      result: 'pass',
    },
  });
});

void t.test('can remove dependencies', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
      dependencies: {
        dep: '^1.0.0',
        keepDep: '^1.0.0',
      },
      bundledDependencies: ['dep'],
      devDependencies: {
        dev: '^1.0.0',
      },
      optionalDependencies: {
        opt: '^1.0.0',
      },
      peerDependencies: {
        peer: '^1.0.0',
      },
      peerDependenciesMeta: {
        peer: {
          optional: true,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        removeDependencies: [
          'dep',
          'dev',
          'opt',
          'peer',
        ],
      }),
    },
    variables: {},
    flags: {},
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"bundledDependencies" includes unwanted entry "dep"',
        '"dependencies" includes unwanted entry "dep"',
        '"devDependencies" includes unwanted entry "dev"',
        '"optionalDependencies" includes unwanted entry "opt"',
        '"peerDependencies" includes unwanted entry "peer"',
        '"peerDependenciesMeta" includes unwanted entry "peer"',
      ],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const actualPkg: unknown = JSON.parse(rawPkg);
  t.same(actualPkg, {
    name: 'foo',
    dependencies: {
      keepDep: '^1.0.0',
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    'package.json': {
      result: 'pass',
    },
  });
});

void t.test('deps that are not a subset of the requested range are invalid', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      dependencies: {
        debug: '^1.0.0',
      },
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        dependencies: {
          debug: '^2.0.0',
        },
      }),
    },
    variables: {},
    flags: {},
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"dependencies.debug" expected to be a subset of "^2.0.0" but found "^1.0.0"',
      ],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    dependencies: {
      debug: '^2.0.0',
    },
  });

  const secondVerifyResult = await verifySkeleton(config);
  t.hasStrict(secondVerifyResult, {
    'package.json': {
      result: 'pass',
    },
  });
});

void t.test('can set peerDependenciesMeta to optional', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      peerDependencies: {
        foo: '^1.0.0',
      },
      peerDependenciesMeta: {
        bar: {
          optional: false,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        peerDependenciesMeta: {
          foo: {
            optional: true,
          },
          bar: {
            optional: true,
          },
        },
      }),
    },
    variables: {},
    flags: {},
  };

  const initialVerifyResult = await verifySkeleton(config);
  t.hasStrict(initialVerifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"peerDependenciesMeta" is missing expected entry "foo"',
        '"peerDependenciesMeta.bar.optional" expected to be "true" but found "false"',
      ],
    },
  });
});

void t.test('empty object properties are removed', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        scripts: {},
        peerDependenciesMeta: {},
      }),
    },
    variables: {},
    flags: {},
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    'package.json': {
      // verify passes because the object is empty and should be
      result: 'pass',
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: 'foo',
  });
});

void t.test('empty array properties get removed', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        bundledDependencies: {},
        files: {},
      }),
    },
    variables: {},
    flags: {},
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    'package.json': {
      // verify passes because the object is empty and should be
      result: 'pass',
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: 'foo',
  });
});

void t.test('removeDependencies works when no bundledDeps are present', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        removeDependencies: ['bar'],
      }),
    },
    variables: {},
    flags: {},
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    'package.json': {
      // verify passes because the object is empty and should be
      result: 'pass',
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: 'foo',
  });
});

void t.test('removeDependencies prunes peerDependenciesMeta and bundledDependencies', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
      dependencies: {
        bap: '^1.0.0',
        bar: '^1.0.0',
      },
      bundledDependencies: ['bap', 'bar'],
      peerDependencies: {
        baz: '^1.0.0',
        buzz: '^1.0.0',
      },
      peerDependenciesMeta: {
        baz: {
          optional: true,
        },
        buzz: {
          optional: true,
        },
      },
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        removeDependencies: ['bar', 'baz'],
      }),
    },
    variables: {},
    flags: {},
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"bundledDependencies" includes unwanted entry "bar"',
        '"dependencies" includes unwanted entry "bar"',
        '"peerDependencies" includes unwanted entry "baz"',
        '"peerDependenciesMeta" includes unwanted entry "baz"',
      ],
    },
  });

  const applyResult = await applySkeleton(config);
  t.hasStrict(applyResult, {
    'package.json': {
      result: 'pass',
    },
  });

  const rawPkg = await readFile(join(root, 'package.json'), { encoding: 'utf8' });
  const pkgJson: unknown = JSON.parse(rawPkg);
  t.same(pkgJson, {
    name: 'foo',
    dependencies: {
      bap: '^1.0.0',
    },
    bundledDependencies: ['bap'],
    peerDependencies: {
      buzz: '^1.0.0',
    },
    peerDependenciesMeta: {
      buzz: {
        optional: true,
      },
    },
  });
});

void t.test('correctly identifies missing files property', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'foo',
    }),
  });

  const config: Config = {
    path: root,
    module: 'irrelevant',
    skeleton: {
      'package.json': pkg({
        files: {
          append: ['foo'],
        },
      }),
    },
    variables: {},
    flags: {},
  };

  const verifyResult = await verifySkeleton(config);
  t.hasStrict(verifyResult, {
    'package.json': {
      result: 'fail',
      messages: [
        '"files" is missing expected entry "foo"',
      ],
    },
  });
});
