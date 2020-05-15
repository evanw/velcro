const RollupPluginAlias = require('@rollup/plugin-alias');
const RollupPluginCommonJs = require('@rollup/plugin-commonjs');
const RollupPluginJson = require('@rollup/plugin-json');
const RollupPluginNodeResolve = require('@rollup/plugin-node-resolve');
const RollupPluginTs = require('@wessberg/rollup-plugin-ts');
const { createRequire } = require('module');
const { resolve } = require('path');
const RollupPluginInjectProcessEnv = require('rollup-plugin-inject-process-env');
const { terser } = require('rollup-plugin-terser');

function toUmdName(name) {
  let umdName = 'Velcro.';

  for (const segment of name.split(/[^a-z]/)) {
    umdName += segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  return umdName;
}

/**
 * Create a generic rollup config for a given directory
 *
 * @param {string} dirname
 * @param {string} filename
 * @return {import('rollup').RollupOptions[]}
 */
function rollupConfigFactory(dirname, filename) {
  const relativeRequire = createRequire(resolve(dirname, filename));
  const PackageJson = relativeRequire('./package.json');

  const velcroTypescriptModules = [
    'bundler',
    'common',
    'resolver',
    'runner',
    'strategy-cdn',
    'strategy-compound',
    'strategy-fs',
    'strategy-memory',
  ];

  const typescriptPlugin = RollupPluginTs({
    cwd: resolve(dirname, '../'),
    tsconfig: resolve(dirname, './tsconfig.json'),
    exclude: ['**/node_modules/**/*', '**/dist-module/**/*'],
  });

  return [
    {
      input: resolve(dirname, './src/index.ts'),
      output: [
        {
          file: resolve(dirname, PackageJson.main),
          format: 'commonjs',
          sourcemap: true,
        },
        {
          file: resolve(dirname, PackageJson.module),
          format: 'esm',
          sourcemap: true,
        },
      ],
      external(id) {
        return PackageJson.dependencies && Object.hasOwnProperty.call(PackageJson.dependencies, id);
      },
      plugins: [
        RollupPluginJson(),
        RollupPluginNodeResolve(),
        typescriptPlugin,
        RollupPluginInjectProcessEnv({ NODE_ENV: 'production' }),
      ],
    },
    {
      input: resolve(dirname, './src/index.ts'),
      output: {
        file: resolve(dirname, PackageJson.browser),
        format: 'commonjs',
        sourcemap: true,
      },
      external(id) {
        return PackageJson.dependencies && Object.hasOwnProperty.call(PackageJson.dependencies, id);
      },
      plugins: [
        RollupPluginJson(),
        RollupPluginNodeResolve({ browser: true, mainFields: ['browser', 'module', 'main'] }),
        typescriptPlugin,
        RollupPluginInjectProcessEnv({ NODE_ENV: 'production' }),
      ],
    },
    {
      input: resolve(dirname, './src/index.ts'),
      output: {
        file: resolve(dirname, PackageJson.unpkg),
        format: 'umd',
        name: PackageJson.name.replace(/^@velcro\/(.*)$/, (_match, name) => toUmdName(name)),
        sourcemap: true,
      },
      plugins: [
        RollupPluginAlias({
          entries: velcroTypescriptModules.map((name) => ({
            find: `@velcro/${name}`,
            replacement: resolve(__dirname, `./packages/@velcro/${name}/src/index.ts`),
          })),
        }),
        RollupPluginJson(),
        RollupPluginNodeResolve({
          mainFields: ['module', 'main'],
        }),
        RollupPluginCommonJs(),
        typescriptPlugin,
        RollupPluginInjectProcessEnv({ NODE_ENV: 'production' }),
        terser({
          mangle: {
            reserved: ['createRuntime', 'Module', 'Runtime'],
          },
        }),
      ],
    },
  ];
}

exports.rollupConfigFactory = rollupConfigFactory;
