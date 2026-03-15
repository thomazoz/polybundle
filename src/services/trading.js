import { ClobClient } from "@polymarket/clob-client";

const CHAIN_ID = 137; // Polygon Mainnet
const HOST = "https://clob.polymarket.com";

/**
 * Ensures MetaMask is on Polygon Mainnet (chain 137).
 * Switches automatically; adds the chain if it's not yet configured.
 */
export async function ensurePolygonNetwork() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(chainId, 16) === 137) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x89" }],
    });
  } catch (err) {
    // 4902 = chain not added to MetaMask yet
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x89",
            chainName: "Polygon Mainnet",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: ["https://polygon-rpc.com"],
            blockExplorerUrls: ["https://polygonscan.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Initializes the Polymarket CLOB client for the given signer.
 * Creates or derives API keys (signing happens once per session).
 */
export async function initClobClient(signer) {
  const tempClient = new ClobClient(HOST, CHAIN_ID, signer);
  const creds = await tempClient.createOrDeriveApiKey();
  return new ClobClient(HOST, CHAIN_ID, signer, creds);
}

/**
 * Initializes the CLOB client directly from Polymarket API credentials.
 * No browser wallet needed — just paste key/secret/passphrase from Polymarket settings.
 * @param {ethers.Wallet} wallet - ethers Wallet created from private key
 * @param {{ key: string, secret: string, passphrase: string }} creds
 */
export function initClobClientFromCreds(wallet, creds) {
  return new ClobClient(HOST, CHAIN_ID, wallet, creds);
}

/**
 * Executes a market buy order via the Polymarket CLOB.
 * @param {ClobClient} clobClient - authenticated CLOB client
 * @param {string} tokenId       - YES or NO token ID for the market
 * @param {number} usdcAmount    - USDC to spend (for BUY orders)
 * @returns {Promise<any>}       - CLOB order response
 */
export async function executeMarketOrder(clobClient, tokenId, usdcAmount) {
  return await clobClient.createAndPostMarketOrder({
    tokenID: tokenId,
    side: "BUY",
    amount: usdcAmount,
  });
}
