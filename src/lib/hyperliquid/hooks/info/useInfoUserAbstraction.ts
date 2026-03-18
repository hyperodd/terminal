import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useHyperliquid } from "@/lib/hyperliquid/provider";
import { infoKeys } from "@/lib/hyperliquid/query/keys";
import { computeEnabled, type QueryOptions } from "@/lib/hyperliquid/query/options";
import type { HyperliquidEnv } from "@/lib/hyperliquid/signing/types";
import type { HyperliquidQueryError, QueryParameter } from "@/lib/hyperliquid/types";

export type AccountAbstractionMode = "default" | "dexAbstraction" | "unifiedAccount" | "portfolioMargin";

export type UseInfoUserAbstractionOptions<TData = AccountAbstractionMode> = QueryParameter<
	AccountAbstractionMode,
	TData
>;
export type UseInfoUserAbstractionReturnType<TData = AccountAbstractionMode> = UseQueryResult<
	TData,
	HyperliquidQueryError
>;

function getInfoUrl(env: HyperliquidEnv): string {
	return env === "Testnet" ? "https://api.hyperliquid-testnet.xyz/info" : "https://api.hyperliquid.xyz/info";
}

export async function fetchUserAbstraction(
	env: HyperliquidEnv,
	user: Address,
	signal?: AbortSignal,
): Promise<AccountAbstractionMode> {
	const url = getInfoUrl(env);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ type: "userAbstraction", user }),
		signal,
	});
	if (!res.ok) throw new Error(`userAbstraction HTTP error: ${res.status}`);
	return res.json() as Promise<AccountAbstractionMode>;
}

export function getUserAbstractionQueryOptions(
	env: HyperliquidEnv,
	user: Address,
): QueryOptions<AccountAbstractionMode> {
	return {
		queryKey: infoKeys.method("userAbstraction", { user }),
		queryFn: ({ signal }) => fetchUserAbstraction(env, user, signal),
	};
}

export function useInfoUserAbstraction<TData = AccountAbstractionMode>(
	user: Address | undefined,
	options: UseInfoUserAbstractionOptions<TData> = {},
): UseInfoUserAbstractionReturnType<TData> {
	const { env } = useHyperliquid();
	const enabled = computeEnabled(Boolean(user), options);

	return useQuery({
		...options,
		...getUserAbstractionQueryOptions(env, user as Address),
		enabled,
	});
}
