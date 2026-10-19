/**
 * Imperial Games deposit-network capability registry (staging/plan only).
 *
 * Listing a chain or asset here NEVER enables deposits. An asset cannot be
 * accepted until issuer contracts, custody/processor support, addresses,
 * confirmations, compliance controls, reconciliation and payouts are verified.
 * Network IDs are canonical internal keys; do not substitute display names
 * or trust chain names supplied by clients in any future credit handler.
 */
export const DEPOSITS_ENABLED = false;

const entry = (id, label, family, nativeAsset, options = {}) => Object.freeze({
  id, label, family, nativeAsset,
  chainId: options.chainId ?? null,
  tokenStandard: options.tokenStandard ?? null,
  // Token availability is provisional; no contract/mint identifiers are approved.
  proposedStablecoins: Object.freeze(options.proposedStablecoins ?? []),
  enabled: false,
  addressConfigured: false,
  monitorVerified: false,
  reconciliationVerified: false,
  custodyVerified: false,
});

export const DEPOSIT_NETWORKS = Object.freeze([
  entry('solana', 'Solana Mainnet', 'solana', 'SOL', {
    tokenStandard: 'SPL', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('ethereum', 'Ethereum Mainnet', 'evm', 'ETH', {
    chainId: 1, tokenStandard: 'ERC-20', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('bsc', 'BNB Smart Chain', 'evm', 'BNB', {
    chainId: 56, tokenStandard: 'BEP-20', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('arbitrum-one', 'Arbitrum One', 'evm', 'ETH', {
    chainId: 42161, tokenStandard: 'ERC-20', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('op-mainnet', 'OP Mainnet', 'evm', 'ETH', {
    chainId: 10, tokenStandard: 'ERC-20', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('polygon-pos', 'Polygon PoS', 'evm', 'POL', {
    chainId: 137, tokenStandard: 'ERC-20', proposedStablecoins: ['USDT', 'USDC'],
  }),
  entry('bitcoin', 'Bitcoin', 'utxo', 'BTC'),
  entry('litecoin', 'Litecoin', 'utxo', 'LTC'),
  entry('xrpl', 'XRP Ledger', 'xrpl', 'XRP'),
  entry('cardano', 'Cardano', 'cardano', 'ADA'),
  entry('monero', 'Monero', 'cryptonote', 'XMR'),
  entry('zephyr', 'Zephyr Protocol', 'cryptonote', 'ZEPH'),
]);

export const getDepositNetwork = (id) =>
  DEPOSIT_NETWORKS.find(network => network.id === id) ?? null;

export function isDepositEnabled(networkId, asset) {
  const network = getDepositNetwork(networkId);
  if (!network || !asset) return false;
  // This must remain false throughout the staging-only migration.
  return DEPOSITS_ENABLED && network.enabled && network.addressConfigured &&
    network.monitorVerified && network.reconciliationVerified &&
    network.custodyVerified &&
    (network.nativeAsset === asset || network.proposedStablecoins.includes(asset));
}

export function depositNetworkDisplay() {
  return DEPOSIT_NETWORKS.map(network => ({
    id: network.id,
    name: network.label,
    family: network.family,
    nativeAsset: network.nativeAsset,
    // These are candidates, not verified token contracts.
    proposedStablecoins: [...network.proposedStablecoins],
    available: false,
  }));
}
