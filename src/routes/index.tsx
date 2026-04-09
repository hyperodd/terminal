import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { TradeTerminalPage } from "@/components/trade/trade-terminal-page";
import { buildPageHead } from "@/lib/seo";
import { useMarketActions } from "@/stores/use-market-store";

export const Route = createFileRoute("/")({
	ssr: false,
	head: () =>
		buildPageHead({
			title: "Trade",
			description:
				"Trade perpetuals and spot markets on Hyperliquid DEX with real-time charts, orderbook, and one-click order execution.",
			path: "/",
			keywords: ["trade", "orderbook", "chart", "perpetuals", "spot"],
		}),
	component: IndexPage,
});

function IndexPage() {
	const { setSelectedMarket } = useMarketActions();

	useEffect(() => {
		setSelectedMarket("all", "VOLX-USDH");
	}, [setSelectedMarket]);

	return <TradeTerminalPage />;
}
