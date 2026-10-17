/**
 * Read-only Solana RPC gateway for the frontend.
 * No private keys, signing, deposits, withdrawals or token transfers.
 * Defaults to Devnet. Never trust client RPC responses to credit Supabase wallets.
 */
export const SOLANA_NETWORK = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
const DEFAULT_RPC = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};
export const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || DEFAULT_RPC[SOLANA_NETWORK];

export function validateSolanaConfig(network = SOLANA_NETWORK, url = SOLANA_RPC_URL) {
  if (!Object.hasOwn(DEFAULT_RPC, network)) throw new Error('Unsupported Solana network');
  if (!url || !/^https:\/\//.test(url)) throw new Error('Solana RPC requires HTTPS');
  return { network, url };
}

export async function solanaRpc(method, params = [], fetcher = fetch) {
  const { url } = validateSolanaConfig();
  const allowed = new Set(['getHealth', 'getVersion', 'getSlot', 'getBalance', 'getTokenAccountsByOwner']);
  if (!allowed.has(method)) throw new Error('RPC method is not enabled for frontend use');
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error('Solana RPC request failed');
  const payload = await response.json();
  if (payload.error) throw new Error('Solana RPC returned an error');
  return payload.result;
}

export async function getSolanaNetworkStatus(fetcher = fetch) {
  const { network } = validateSolanaConfig();
  const version = await solanaRpc('getVersion', [], fetcher);
  const slot = await solanaRpc('getSlot', [{ commitment: 'confirmed' }], fetcher);
  return { network, version: version['solana-core'], slot };
}
