import { stripHexPrefix } from 'ethereumjs-util';
import { createSelector } from 'reselect';
import { addHexPrefix } from '../../../app/scripts/lib/util';
import {
  MAINNET_CHAIN_ID,
  TEST_CHAINS,
  NETWORK_TYPE_RPC,
} from '../../../shared/constants/network';
import {
  shortenAddress,
  checksumAddress,
  getAccountByAddress,
} from '../helpers/utils/util';
import {
  getValueFromWeiHex,
  hexToDecimal,
} from '../helpers/utils/conversions.util';
import { ETH_SWAPS_TOKEN_OBJECT } from '../../../shared/constants/swaps';

/**
 * One of the only remaining valid uses of selecting the network subkey of the
 * metamask state tree is to determine if the network is currently 'loading'.
 *
 * This will be used for all cases where this state key is accessed only for that
 * purpose.
 * @param {Object} state - redux state object
 */
export function isNetworkLoading(state) {
  return state.metamask.network === 'loading';
}

export function getNetworkIdentifier(state) {
  const {
    metamask: {
      provider: { type, nickname, rpcUrl },
    },
  } = state;

  return nickname || rpcUrl || type;
}

export function getMetricsNetworkIdentifier(state) {
  const { provider } = state.metamask;
  return provider.type === NETWORK_TYPE_RPC ? provider.rpcUrl : provider.type;
}

export function getCurrentChainId(state) {
  const { chainId } = state.metamask.provider;
  return chainId;
}

export function getCurrentKeyring(state) {
  const identity = getSelectedIdentity(state);

  if (!identity) {
    return null;
  }

  const simpleAddress = stripHexPrefix(identity.address).toLowerCase();

  const keyring = state.metamask.keyrings.find((kr) => {
    return (
      kr.accounts.includes(simpleAddress) ||
      kr.accounts.includes(identity.address)
    );
  });

  return keyring;
}

export function getAccountType(state) {
  const currentKeyring = getCurrentKeyring(state);
  const type = currentKeyring && currentKeyring.type;

  switch (type) {
    case 'Trezor Hardware':
    case 'Ledger Hardware':
      return 'hardware';
    case 'Simple Key Pair':
      return 'imported';
    default:
      return 'default';
  }
}

/**
 * get the currently selected networkId which will be 'loading' when the
 * network changes. The network id should not be used in most cases,
 * instead use chainId in most situations. There are a limited number of
 * use cases to use this method still, such as when comparing transaction
 * metadata that predates the switch to using chainId.
 * @deprecated - use getCurrentChainId instead
 * @param {Object} state - redux state object
 */
export function deprecatedGetCurrentNetworkId(state) {
  return state.metamask.network;
}

export const getMetaMaskAccounts = createSelector(
  getMetaMaskAccountsRaw,
  getMetaMaskCachedBalances,
  (currentAccounts, cachedBalances) =>
    Object.entries(currentAccounts).reduce(
      (selectedAccounts, [accountID, account]) => {
        if (account.balance === null || account.balance === undefined) {
          return {
            ...selectedAccounts,
            [accountID]: {
              ...account,
              balance: cachedBalances && cachedBalances[accountID],
            },
          };
        }
        return {
          ...selectedAccounts,
          [accountID]: account,
        };
      },
      {},
    ),
);

export function getSelectedAddress(state) {
  return state.metamask.selectedAddress;
}

export function getSelectedIdentity(state) {
  const selectedAddress = getSelectedAddress(state);
  const { identities } = state.metamask;

  return identities[selectedAddress];
}

export function getNumberOfAccounts(state) {
  return Object.keys(state.metamask.accounts).length;
}

export function getNumberOfTokens(state) {
  const { tokens } = state.metamask;
  return tokens ? tokens.length : 0;
}

export function getMetaMaskKeyrings(state) {
  return state.metamask.keyrings;
}

export function getMetaMaskIdentities(state) {
  return state.metamask.identities;
}

export function getMetaMaskAccountsRaw(state) {
  return state.metamask.accounts;
}

export function getMetaMaskCachedBalances(state) {
  const chainId = getCurrentChainId(state);

  // Fallback to fetching cached balances from network id
  // this can eventually be removed
  const network = deprecatedGetCurrentNetworkId(state);

  return (
    state.metamask.cachedBalances[chainId] ??
    state.metamask.cachedBalances[network]
  );
}

/**
 * Get ordered (by keyrings) accounts with identity and balance
 */
export const getMetaMaskAccountsOrdered = createSelector(
  getMetaMaskKeyrings,
  getMetaMaskIdentities,
  getMetaMaskAccounts,
  (keyrings, identities, accounts) =>
    keyrings
      .reduce((list, keyring) => list.concat(keyring.accounts), [])
      .filter((address) => Boolean(identities[address]))
      .map((address) => ({ ...identities[address], ...accounts[address] })),
);

export const getMetaMaskAccountsConnected = createSelector(
  getMetaMaskAccountsOrdered,
  (connectedAccounts) =>
    connectedAccounts.map(({ address }) => address.toLowerCase()),
);

export function isBalanceCached(state) {
  const selectedAccountBalance =
    state.metamask.accounts[getSelectedAddress(state)].balance;
  const cachedBalance = getSelectedAccountCachedBalance(state);

  return Boolean(!selectedAccountBalance && cachedBalance);
}

export function getSelectedAccountCachedBalance(state) {
  const cachedBalances = getMetaMaskCachedBalances(state);
  const selectedAddress = getSelectedAddress(state);

  return cachedBalances && cachedBalances[selectedAddress];
}

export function getSelectedAccount(state) {
  const accounts = getMetaMaskAccounts(state);
  const selectedAddress = getSelectedAddress(state);

  return accounts[selectedAddress];
}

export function getTargetAccount(state, targetAddress) {
  const accounts = getMetaMaskAccounts(state);
  return accounts[targetAddress];
}

export const getTokenExchangeRates = (state) =>
  state.metamask.contractExchangeRates;

export function getAssetImages(state) {
  const assetImages = state.metamask.assetImages || {};
  return assetImages;
}

export function getAddressBook(state) {
  const chainId = getCurrentChainId(state);
  if (!state.metamask.addressBook[chainId]) {
    return [];
  }
  return Object.values(state.metamask.addressBook[chainId]);
}

export function getAddressBookEntry(state, address) {
  const addressBook = getAddressBook(state);
  const entry = addressBook.find(
    (contact) => contact.address === checksumAddress(address),
  );
  return entry;
}

export function getAddressBookEntryName(state, address) {
  const entry =
    getAddressBookEntry(state, address) || state.metamask.identities[address];
  return entry && entry.name !== '' ? entry.name : shortenAddress(address);
}

export function accountsWithSendEtherInfoSelector(state) {
  const accounts = getMetaMaskAccounts(state);
  const identities = getMetaMaskIdentities(state);

  const accountsWithSendEtherInfo = Object.entries(identities).map(
    ([key, identity]) => {
      return { ...identity, ...accounts[key] };
    },
  );

  return accountsWithSendEtherInfo;
}

export function getAccountsWithLabels(state) {
  return getMetaMaskAccountsOrdered(state).map(
    ({ address, name, balance }) => ({
      address,
      addressLabel: `${name} (...${address.slice(address.length - 4)})`,
      label: name,
      balance,
    }),
  );
}

export function getCurrentAccountWithSendEtherInfo(state) {
  const currentAddress = getSelectedAddress(state);
  const accounts = accountsWithSendEtherInfoSelector(state);

  return getAccountByAddress(accounts, currentAddress);
}

export function getTargetAccountWithSendEtherInfo(state, targetAddress) {
  const accounts = accountsWithSendEtherInfoSelector(state);
  return getAccountByAddress(accounts, targetAddress);
}

export function getCurrentEthBalance(state) {
  return getCurrentAccountWithSendEtherInfo(state).balance;
}

export function getGasIsLoading(state) {
  return state.appState.gasIsLoading;
}

export function getCurrentCurrency(state) {
  return state.metamask.currentCurrency;
}

export function getTotalUnapprovedCount(state) {
  const {
    unapprovedMsgCount = 0,
    unapprovedPersonalMsgCount = 0,
    unapprovedDecryptMsgCount = 0,
    unapprovedEncryptionPublicKeyMsgCount = 0,
    unapprovedTypedMessagesCount = 0,
    pendingApprovalCount = 0,
  } = state.metamask;

  return (
    unapprovedMsgCount +
    unapprovedPersonalMsgCount +
    unapprovedDecryptMsgCount +
    unapprovedEncryptionPublicKeyMsgCount +
    unapprovedTypedMessagesCount +
    getUnapprovedTxCount(state) +
    pendingApprovalCount +
    getSuggestedTokenCount(state)
  );
}

function getUnapprovedTxCount(state) {
  const { unapprovedTxs = {} } = state.metamask;
  return Object.keys(unapprovedTxs).length;
}

export function getUnapprovedConfirmations(state) {
  const { pendingApprovals } = state.metamask;
  return Object.values(pendingApprovals);
}

function getSuggestedTokenCount(state) {
  const { suggestedTokens = {} } = state.metamask;
  return Object.keys(suggestedTokens).length;
}

export function getIsMainnet(state) {
  const chainId = getCurrentChainId(state);
  return chainId === MAINNET_CHAIN_ID;
}

export function getIsTestnet(state) {
  const chainId = getCurrentChainId(state);
  return TEST_CHAINS.includes(chainId);
}

export function getPreferences({ metamask }) {
  return metamask.preferences;
}

export function getShouldShowFiat(state) {
  const isMainNet = getIsMainnet(state);
  const { showFiatInTestnets } = getPreferences(state);
  return Boolean(isMainNet || showFiatInTestnets);
}

export function getShouldHideZeroBalanceTokens(state) {
  const { hideZeroBalanceTokens } = getPreferences(state);
  return hideZeroBalanceTokens;
}

export function getAdvancedInlineGasShown(state) {
  return Boolean(state.metamask.featureFlags.advancedInlineGas);
}

export function getUseNonceField(state) {
  return Boolean(state.metamask.useNonceField);
}

export function getCustomNonceValue(state) {
  return String(state.metamask.customNonceValue);
}

export function getDomainMetadata(state) {
  return state.metamask.domainMetadata;
}

export function getRpcPrefsForCurrentProvider(state) {
  const { frequentRpcListDetail, provider } = state.metamask;
  const selectRpcInfo = frequentRpcListDetail.find(
    (rpcInfo) => rpcInfo.rpcUrl === provider.rpcUrl,
  );
  const { rpcPrefs = {} } = selectRpcInfo || {};
  return rpcPrefs;
}

export function getKnownMethodData(state, data) {
  if (!data) {
    return null;
  }
  const prefixedData = addHexPrefix(data);
  const fourBytePrefix = prefixedData.slice(0, 10);
  const { knownMethodData } = state.metamask;

  return knownMethodData && knownMethodData[fourBytePrefix];
}

export function getFeatureFlags(state) {
  return state.metamask.featureFlags;
}

export function getOriginOfCurrentTab(state) {
  return state.activeTab.origin;
}

export function getIpfsGateway(state) {
  return state.metamask.ipfsGateway;
}

export function getUSDConversionRate(state) {
  return state.metamask.usdConversionRate;
}

export function getWeb3ShimUsageStateForOrigin(state, origin) {
  return state.metamask.web3ShimUsageOrigins[origin];
}

/**
 * @typedef {Object} SwapsEthToken
 * @property {string} symbol - The symbol for ETH, namely "ETH"
 * @property {string} name - The name of the ETH currency, "Ether"
 * @property {string} address - A substitute address for the metaswap-api to
 * recognize the ETH token
 * @property {string} decimals - The number of ETH decimals, i.e. 18
 * @property {string} balance - The user's ETH balance in decimal wei, with a
 * precision of 4 decimal places
 * @property {string} string - The user's ETH balance in decimal ETH
 */

/**
 * Swaps related code uses token objects for various purposes. These objects
 * always have the following properties: `symbol`, `name`, `address`, and
 * `decimals`.
 *
 * When available for the current account, the objects can have `balance` and
 * `string` properties.
 * `balance` is the users token balance in decimal values, denominated in the
 * minimal token units (according to its decimals).
 * `string` is the token balance in a readable format, ready for rendering.
 *
 * Swaps treats ETH as a token, and we use the ETH_SWAPS_TOKEN_OBJECT constant
 * to set the standard properties for the token. The getSwapsEthToken selector
 * extends that object with `balance` and `balance` values of the same type as
 * in regular ERC-20 token objects, per the above description.
 *
 * @param {object} state - the redux state object
 * @returns {SwapsEthToken} The token object representation of the currently
 * selected account's ETH balance, as expected by the Swaps API.
 */

export function getSwapsEthToken(state) {
  const selectedAccount = getSelectedAccount(state);
  const { balance } = selectedAccount;

  return {
    ...ETH_SWAPS_TOKEN_OBJECT,
    balance: hexToDecimal(balance),
    string: getValueFromWeiHex({
      value: balance,
      numberOfDecimals: 4,
      toDenomination: 'ETH',
    }),
  };
}

export function getNextSuggestedNonce(state) {
  return Number(state.metamask.nextNonce);
}
