import { SOLANA_NETWORK, solanaRpc } from './solanaNetwork.js';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const SOLANA_WALLET_NETWORK = 'devnet';

export function assertDevnet() {
  if (SOLANA_NETWORK !== SOLANA_WALLET_NETWORK) {
    throw new Error('Solana wallet integration is restricted to Devnet');
  }
}

export function getPhantomProvider(browser = typeof window !== 'undefined' ? window : undefined) {
  const provider = browser?.phantom?.solana;
  return provider?.isPhantom ? provider : null;
}

export async function connectDevnetWallet(provider = getPhantomProvider()) {
  assertDevnet();
  if (!provider?.connect) throw new Error('Install a compatible Phantom Solana wallet');
  const result = await provider.connect();
  const address = result?.publicKey?.toBase58?.();
  if (!address || !BASE58.test(address)) throw new Error('Wallet returned an invalid public key');
  return address;
}

export async function disconnectDevnetWallet(provider = getPhantomProvider()) {
  if (provider?.disconnect) await provider.disconnect();
}

export async function readDevnetSolBalance(address, rpc = solanaRpc) {
  assertDevnet();
  if (!BASE58.test(address)) throw new Error('Invalid wallet address');
  const result = await rpc('getBalance', [address, { commitment: 'confirmed' }]);
  if (!Number.isSafeInteger(result?.value) || result.value < 0) throw new Error('Invalid RPC balance');
  return { lamports: String(result.value), sol: result.value / 1_000_000_000 };
}

export async function readDevnetTokenAccounts(address, mint, rpc = solanaRpc) {
  assertDevnet();
  if (!BASE58.test(address) || !BASE58.test(mint)) throw new Error('Invalid wallet or mint address');
  const result = await rpc('getTokenAccountsByOwner', [
    address, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' },
  ]);
  return (result?.value || []).map(({ pubkey, account }) => ({
    address: pubkey,
    amountBaseUnits: account?.data?.parsed?.info?.tokenAmount?.amount,
    decimals: account?.data?.parsed?.info?.tokenAmount?.decimals,
  }));
}
