import { getReadClient, getWalletClient, prividium } from './config';

export async function sendPrividiumTx({
  account,
  to,
  data
}: {
  account: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
}) {
  const readClient = getReadClient(account);
  const nonce = await readClient.getTransactionCount({ address: account });
  const gas = await readClient.estimateGas({ account, to, data });
  const gasPrice = await readClient.getGasPrice();

  await prividium.authorizeTransaction({
    walletAddress: account,
    toAddress: to,
    nonce,
    calldata: data
  });

  const walletClient = getWalletClient();
  if (!walletClient) {
    throw new Error('No Web3 wallet detected. Install MetaMask and refresh the page.');
  }

  const hash = await walletClient.sendTransaction({
    account,
    to,
    data,
    nonce,
    gas,
    gasPrice
  });
  return hash;
}
