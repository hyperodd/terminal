import type { ExchangeClient } from "@nktkas/hyperliquid";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useHyperliquidClients } from "@/lib/hyperliquid/hooks/useClients";
import {
	createMutationKey,
	guardedMutationFn,
	type MutationOptions,
	mergeMutationOptions,
} from "@/lib/hyperliquid/query/mutation-options";
import type { HyperliquidQueryError, MutationParameter } from "@/lib/hyperliquid/types";

type UserSetAbstractionData = Awaited<ReturnType<ExchangeClient["userSetAbstraction"]>>;
type UserSetAbstractionParams = Parameters<ExchangeClient["userSetAbstraction"]>[0];

export type UseExchangeUserSetAbstractionOptions = MutationParameter<UserSetAbstractionData, UserSetAbstractionParams>;
export type UseExchangeUserSetAbstractionReturnType = UseMutationResult<
	UserSetAbstractionData,
	HyperliquidQueryError,
	UserSetAbstractionParams
>;

export function getUserSetAbstractionMutationOptions(
	exchange: ExchangeClient | null,
): MutationOptions<UserSetAbstractionData, UserSetAbstractionParams> {
	return {
		mutationKey: createMutationKey("userSetAbstraction"),
		mutationFn: guardedMutationFn(exchange, (ex, params) => ex.userSetAbstraction(params)),
	};
}

export function useExchangeUserSetAbstraction(
	options: UseExchangeUserSetAbstractionOptions = {},
): UseExchangeUserSetAbstractionReturnType {
	const { user } = useHyperliquidClients();

	return useMutation(mergeMutationOptions(options, getUserSetAbstractionMutationOptions(user)));
}
