import { cloneDeep, keyBy } from 'lodash';

const version = 56;

/**
 * replace 'incomingTxLastFetchedBlocksByNetwork' with 'incomingTxLastFetchedBlockByChainId'
 */
export default {
  version,
  async migrate(originalVersionedData) {
    const versionedData = cloneDeep(originalVersionedData);
    versionedData.meta.version = version;
    const state = versionedData.data;
    versionedData.data = transformState(state);
    return versionedData;
  },
};

function transformState(state) {
  if (state?.TransactionController?.transactions) {
    state.TransactionController.transactions = keyBy(
      state.TransactionController.transactions,
      'id',
    );
  }
  return state;
}
