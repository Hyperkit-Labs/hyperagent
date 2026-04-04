/**
 * CJS mirror of until-async (ESM-only). Jest loads MSW in CommonJS; mapping
 * `until-async` avoids parsing `export` in node_modules.
 */
async function until(callback) {
  try {
    return [
      null,
      await callback().catch((error) => {
        throw error;
      }),
    ];
  } catch (error) {
    return [error, null];
  }
}

module.exports = { until };
