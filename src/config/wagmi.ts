import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { arbitrum, arbitrumSepolia } from "wagmi/chains";

export const config = createConfig({
	chains: [arbitrum, arbitrumSepolia],
	transports: {
		[arbitrum.id]: http(),
		[arbitrumSepolia.id]: http(),
	},
});
