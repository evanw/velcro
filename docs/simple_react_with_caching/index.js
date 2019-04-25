// @ts-check
/** @type {import('../../packages/runtime')} */
// @ts-ignore
const Velcro = window.Velcro;

async function main() {
  const cacheStats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Create a indexeddb cache with a predicate that skips in-memory files
   */
  const idbCache = Velcro.createCache('@velcro/runtime:cache', (_segment, key) => !key.startsWith('file:///'));

  /**
   * A wrapper around the indexeddb cache to keep some stats
   * @type {import('../../packages/runtime').Runtime.Cache}
   * */
  const cache = {
    delete(segment, id) {
      return idbCache.delete(segment, id);
    },
    async get(segment, id) {
      const result = await idbCache.get(segment, id);

      if (result) {
        cacheStats.hits++;
        return result;
      }
      cacheStats.misses++;
    },
    set(segment, id, value) {
      return idbCache.set(segment, id, value);
    },
  };

  const runtime = Velcro.createRuntime({
    cache,
    injectGlobal: Velcro.injectGlobalFromUnpkg,
    resolveBareModule: Velcro.resolveBareModuleToUnpkg,
  });

  const importStart = Date.now();
  /** @type {[import('react'), import('react-dom')]} */
  const [React, ReactDom] = await Promise.all([runtime.import('react'), runtime.import('react-dom')]);
  const importEnd = Date.now();

  return new Promise(resolve =>
    ReactDom.render(
      React.createElement(
        'span',
        null,
        `Imported in ${importEnd - importStart}ms with ${(100 * cacheStats.hits) /
          (cacheStats.hits + cacheStats.misses)}% cache hit rate (${cacheStats.hits} hits, ${cacheStats.misses} misses)`
      ),
      document.getElementById('root'),
      () => {
        resolve(runtime);
      }
    )
  );
}

main().catch(console.error);
