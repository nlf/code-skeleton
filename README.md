## code-skeleton

A tool for creating templates that can be versioned and updated alongside your code.

### Usage

In order to use this tool, you must first create a skeleton module:

```typescript
import { copy, pkg, json, type Skeleton } from "code-skeleton";

export default async function (root: string, variables: object) {
    const skeleton: Skeleton = {
        "targetFile": copy(join(__dirname, "content", "sourceFile")),
        "tsconfig.json": json({
            set: {
                "extends": "@tsconfig/node18",
            },
        }),
        "package.json": pkg({
            scripts: {
                test: "tap",
            },
        }),
    };

    return skeleton;
}
```

Make sure to add `code-skeleton` as a peer dependency of your skeleton:

```shell
> npm install --save-peer code-skeleton
```

When applied the above skeleton would copy `sourceFile` to `targetFile`, ensure that the `"extends"` key of `tsconfig.json` is equal to the value `"@tsconfig/node18"`, and ensure that the `test` script in `package.json` is set to `"tap"`.

The skeleton must be published to npm. To consume the skeleton:

```shell
# --save-exact facilitates keeping your template current via dependabot and is highly recommended
> npm i -D --save-exact your-skeleton-module
> npm pkg set skeleton.module=your-skeleton-module
> npx code-skeleton apply
```

### Generators

#### copy

#### json

#### pkg

### Passing configuration to skeletons
