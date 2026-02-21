import { createPrividiumChain, createPrividiumClient } from 'prividium';
import { createWalletClient, custom, defineChain } from 'viem';

export const chain = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID ?? 7777),
  name: 'Prividium PoC',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_RPC_URL ?? ''] } }
});

export const prividium = createPrividiumChain({
  clientId: import.meta.env.VITE_PRIVIDIUM_CLIENT_ID,
  chain,
  rpcUrl: import.meta.env.VITE_RPC_URL,
  authBaseUrl: import.meta.env.VITE_AUTH_BASE_URL,
  prividiumApiBaseUrl: import.meta.env.VITE_PRIVIDIUM_API_BASE_URL,
  redirectUrl: `${window.location.origin}/auth/callback`
});

export function getReadClient(account: `0x${string}`) {
  return createPrividiumClient({
    chain,
    transport: prividium.transport,
    account
  });
}

export const walletClient = createWalletClient({
  chain,
  transport: custom(window.ethereum)
});

export const GAME_ADDRESS = import.meta.env.VITE_GAME_ADDRESS as `0x${string}`;
