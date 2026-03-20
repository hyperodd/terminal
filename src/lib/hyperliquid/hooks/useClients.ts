import type { ExchangeClient, InfoClient, SubscriptionClient } from "@nktkas/hyperliquid";
import { useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { arbitrum, arbitrumSepolia } from "wagmi/chains";
import { createExchangeClient } from "@/lib/hyperliquid/clients";
import { useHyperliquid } from "@/lib/hyperliquid/provider";
import { useAgentWallet } from "@/lib/hyperliquid/signing/use-agent-wallet";

export interface HyperliquidClients {
	info: InfoClient;
	subscription: SubscriptionClient;
	/** Exchange client using agent wallet - for L1 trading actions (order, cancel, etc.) */
	trading: ExchangeClient | null;
	/** Exchange client using user wallet - for user-signed actions (approveAgent, approveBuilderFee, withdraw, etc.) */
	user: ExchangeClient | null;
}

export function useHyperliquidClients(): HyperliquidClients {
	const { info, subscription, env } = useHyperliquid();
	const { signer, isReady: agentReady } = useAgentWallet();
	const { address } = useConnection();
	const { wallets } = useWallets();

	const trading = useMemo(() => {
		if (!signer || !agentReady) return null;
		return createExchangeClient(signer);
	}, [signer, agentReady]);

	const user = useMemo(() => {
		if (!address) return null;
		const privyWallet = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
		if (!privyWallet) return null;
		const chain = env === "Testnet" ? arbitrumSepolia : arbitrum;
		return createExchangeClient({
			address,
			// Required for SDK to detect this as AbstractViemJsonRpcAccount and call getChainId()
			// for signatureChainId. Without these, SDK falls back to chainId 1 (mainnet), which
			// causes switchChain(1) and Hyperliquid signature validation to fail.
			getAddresses: async () => [address],
			getChainId: async () => chain.id,
			signTypedData: async (params) => {
				const provider = await privyWallet.getEthereumProvider();
				// Switch chain only if needed — avoids redundant popups on subsequent signing steps
				// MetaMask v11+ rejects eth_signTypedData_v4 if domain chainId ≠ active chain
				const currentChainId = parseInt((await provider.request({ method: "eth_chainId" })) as string, 16);
				if (currentChainId !== chain.id) {
					await privyWallet.switchChain(chain.id);
				}
				return provider.request({
					method: "eth_signTypedData_v4",
					params: [address, JSON.stringify(params)],
				}) as Promise<`0x${string}`>;
			},
		});
	}, [address, wallets, env]);

	return {
		info,
		subscription,
		trading,
		user,
	};
}
