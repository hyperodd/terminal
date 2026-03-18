import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_BUILDER_CONFIG, PROJECT_NAME } from "@/config/hyperliquid";
import { privyConfig } from "@/config/privy";
import { config } from "@/config/wagmi";
import { usePrivyWagmiSync } from "@/hooks/use-privy-wagmi-sync";
import { HyperliquidProvider } from "@/lib/hyperliquid";
import { MarketsProvider } from "@/lib/hyperliquid/markets";
import "@/lib/i18n";

function PrivyWagmiSync() {
	usePrivyWagmiSync();
	return null;
}

export function getRootProviderContext() {
	const queryClient = new QueryClient();
	return {
		queryClient,
	};
}

const env = import.meta.env.VITE_HYPERLIQUID_TESTNET === "true" ? "Testnet" : "Mainnet";

export function RootProvider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
	return (
		<PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID} config={privyConfig}>
			<QueryClientProvider client={queryClient}>
				<WagmiProvider config={config}>
					<PrivyWagmiSync />
					<I18nProvider i18n={i18n}>
						<HyperliquidProvider env={env} builderConfig={DEFAULT_BUILDER_CONFIG} agentName={PROJECT_NAME}>
							<MarketsProvider>{children}</MarketsProvider>
						</HyperliquidProvider>
					</I18nProvider>
				</WagmiProvider>
			</QueryClientProvider>
		</PrivyProvider>
	);
}
