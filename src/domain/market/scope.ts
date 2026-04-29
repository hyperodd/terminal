export type ExchangeScope = "all" | "perp" | "spot" | "builders-perp";

export const EXCHANGE_SCOPES: ExchangeScope[] = ["all", "perp", "spot", "builders-perp"];

const isTestnet = typeof import.meta !== "undefined" && import.meta.env?.VITE_HYPERLIQUID_TESTNET === "true";

export const DEFAULT_SELECTED_MARKETS: Record<ExchangeScope, string> = {
	all: isTestnet ? "VOLX-USDH" : "CL-USDC",
	perp: "BTC",
	spot: "@107", // ETH/USDC
	"builders-perp": "xyz:SILVER",
};
