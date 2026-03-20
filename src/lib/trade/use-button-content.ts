import { t } from "@lingui/core/macro";
import { useMemo } from "react";
import type { RegistrationStatus } from "@/lib/hyperliquid/signing/types";
import type { ButtonContent, Side, ValidationResult } from "@/lib/trade/types";

interface ButtonContentInput {
	isConnected: boolean;
	availableBalance: number;
	validation: ValidationResult;
	isAgentLoading: boolean;
	registerStatus: RegistrationStatus;
	canApprove: boolean;
	side: Side;
	isSubmitting: boolean;
	onConnectWallet: () => void;
	onDeposit: () => void;
	onRegister: () => void;
	onSubmit: () => void;
}

function getRegisterText(isLoading: boolean, registerStatus: RegistrationStatus, canApprove: boolean): string {
	if (isLoading) return t`Loading...`;
	if (!canApprove) return t`Loading...`;
	if (registerStatus === "switching_account_mode") return t`Sign in wallet...`;
	if (registerStatus === "approving_fee" || registerStatus === "approving_agent") return t`Sign in wallet...`;
	if (registerStatus === "verifying") return t`Verifying...`;
	return t`Enable Trading`;
}

export function useButtonContent(input: ButtonContentInput): ButtonContent {
	const isRegistering =
		input.registerStatus === "switching_account_mode" ||
		input.registerStatus === "approving_fee" ||
		input.registerStatus === "approving_agent" ||
		input.registerStatus === "verifying";

	const registerText = useMemo(
		() => getRegisterText(input.isAgentLoading, input.registerStatus, input.canApprove),
		[input.isAgentLoading, input.registerStatus, input.canApprove],
	);

	return useMemo<ButtonContent>(() => {
		if (!input.isConnected) {
			return {
				text: t`Connect Wallet`,
				action: input.onConnectWallet,
				disabled: false,
				variant: "cyan",
			};
		}
		if (input.validation.needsApproval) {
			return {
				text: registerText,
				action: input.onRegister,
				disabled: isRegistering || !input.canApprove || input.isAgentLoading,
				variant: "cyan",
			};
		}
		if (input.availableBalance <= 0) {
			return {
				text: t`Deposit`,
				action: input.onDeposit,
				disabled: false,
				variant: "cyan",
			};
		}
		return {
			text: input.side === "buy" ? t`Buy` : t`Sell`,
			action: input.onSubmit,
			disabled: !input.validation.canSubmit || input.isSubmitting,
			variant: input.side as "buy" | "sell",
		};
	}, [
		input.isConnected,
		input.availableBalance,
		input.validation.needsApproval,
		input.validation.canSubmit,
		registerText,
		isRegistering,
		input.canApprove,
		input.isAgentLoading,
		input.onConnectWallet,
		input.onDeposit,
		input.onRegister,
		input.onSubmit,
		input.side,
		input.isSubmitting,
	]);
}

export type { ButtonContentInput };
