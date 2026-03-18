import type { PrivyClientConfig } from "@privy-io/react-auth";
import { arbitrum } from "wagmi/chains";

export const privyConfig: PrivyClientConfig = {
	loginMethods: ["email", "google", "wallet"],
	embeddedWallets: {
		ethereum: {
			createOnLogin: "users-without-wallets",
		},
	},
	appearance: {
		showWalletLoginFirst: false,
	},
	supportedChains: [arbitrum],
};
