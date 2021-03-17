import { cloneDeep } from 'lodash';

const version = 54;

function isValidDecimals(decimals) {
  return !isNaN(Number(decimals));
}

/**
 * Migrates preference tokens with 0 decimals typed as 'string' to 'number'
 */
export default {
  version,
  async migrate(originalVersionedData) {
    const versionedData = cloneDeep(originalVersionedData);
    versionedData.meta.version = version;
    const state = versionedData.data;
    const newState = transformState(state);
    versionedData.data = newState;
    return versionedData;
  },
};

function transformState(state) {
  const newState = state;

  if (!newState.PreferencesController) {
    return newState;
  }

  const tokens = newState.PreferencesController.tokens || [];
  // Filter out any tokens with corrupted decimal values
  const validTokens = tokens.filter(({ decimals }) =>
    isValidDecimals(decimals),
  );
  for (const token of validTokens) {
    // In the case of a decimal value type string, set to 0.
    if (typeof token.decimals === 'string') {
      token.decimals = 0;
    }
  }
  newState.PreferencesController.tokens = validTokens;

  const { accountTokens } = newState.PreferencesController;
  if (accountTokens && typeof accountTokens === 'object') {
    for (const address of Object.keys(accountTokens)) {
      const networkTokens = accountTokens[address];
      if (networkTokens && typeof networkTokens === 'object') {
        for (const network of Object.keys(networkTokens)) {
          const tokensOnNetwork = networkTokens[network] || [];
          // Filter out any tokens with corrupted decimal values
          const validTokensOnNetwork = tokensOnNetwork.filter(({ decimals }) =>
            isValidDecimals(decimals),
          );
          // In the case of a decimal value type string, set to 0.
          for (const token of validTokensOnNetwork) {
            if (typeof token.decimals === 'string') {
              token.decimals = 0;
            }
          }
          networkTokens[network] = validTokensOnNetwork;
        }
      }
    }
  }
  newState.PreferencesController.accountTokens = accountTokens;

  return newState;
}
