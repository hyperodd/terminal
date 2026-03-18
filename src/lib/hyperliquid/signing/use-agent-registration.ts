import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useConnection } from "wagmi";
import { useExchangeApproveAgent } from "@/lib/hyperliquid/hooks/exchange/useExchangeApproveAgent";
import { useExchangeApproveBuilderFee } from "@/lib/hyperliquid/hooks/exchange/useExchangeApproveBuilderFee";
import { useExchangeUserSetAbstraction } from "@/lib/hyperliquid/hooks/exchange/useExchangeUserSetAbstraction";
import { fetchUserAbstraction } from "@/lib/hyperliquid/hooks/info/useInfoUserAbstraction";
import { useHyperliquid } from "@/lib/hyperliquid/provider";
import { useAgentWalletActions } from "./agent-storage";
import { convertFeeToPercentageString } from "./agent-utils";
import type { RegistrationStatus } from "./types";
import { useAgentStatus } from "./use-agent-status";

export type RegistrationStep = "abstraction" | "fee" | "agent" | null;

export interface UseAgentRegistrationResult {
	register: () => Promise<Address>;
	status: RegistrationStatus;
	currentStep: RegistrationStep;
	error: Error | null;
	reset: () => void;
}

function deriveRegistrationStatus(
	isPending: boolean,
	isError: boolean,
	currentStep: RegistrationStep,
): RegistrationStatus {
	if (!isPending) return isError ? "error" : "idle";
	if (currentStep === "abstraction") return "switching_account_mode";
	if (currentStep === "fee") return "approving_fee";
	if (currentStep === "agent") return "approving_agent";
	return "verifying";
}

export function useAgentRegistration(): UseAgentRegistrationResult {
	const { env, agentName, builderConfig } = useHyperliquid();
	const { address } = useConnection();

	const [currentStep, setCurrentStep] = useState<RegistrationStep>(null);
	const { setAgent, clearAgent } = useAgentWalletActions();

	const agentStatus = useAgentStatus();
	const approveBuilderFee = useExchangeApproveBuilderFee();
	const approveAgent = useExchangeApproveAgent();
	const setAbstraction = useExchangeUserSetAbstraction();

	const registration = useMutation({
		mutationKey: ["hl", "registration", address],
		mutationFn: async (): Promise<Address> => {
			if (!address) throw new Error("No wallet connected");

			// Switch to unified account if user is in default/DEX abstraction mode.
			// Unified account allows spot USDH/USDC balances to be used as perp collateral.
			const abstractionMode = await fetchUserAbstraction(env, address);
			if (abstractionMode === "default" || abstractionMode === "dexAbstraction") {
				setCurrentStep("abstraction");
				await setAbstraction.mutateAsync({ user: address, abstraction: "unifiedAccount" });
			}

			let requirements = await agentStatus.refetch();

			if (requirements.needsBuilderFee && builderConfig?.b && builderConfig?.f !== undefined) {
				setCurrentStep("fee");
				await approveBuilderFee.mutateAsync({
					builder: builderConfig.b,
					maxFeeRate: convertFeeToPercentageString(builderConfig.f),
				});
				requirements = await agentStatus.refetch();
			}

			if (requirements.needsAgent) {
				setCurrentStep("agent");
				clearAgent(env, address);

				const privateKey = generatePrivateKey();
				const account = privateKeyToAccount(privateKey);
				const publicKey = account.address;

				setAgent(env, address, privateKey, publicKey);
				await approveAgent.mutateAsync({ agentAddress: publicKey, agentName });
				await agentStatus.refetch();

				setCurrentStep(null);
				return publicKey;
			}

			setCurrentStep(null);
			return agentStatus.agentAddress ?? zeroAddress;
		},
	});

	const status = deriveRegistrationStatus(registration.isPending, registration.isError, currentStep);

	const reset = useCallback(() => {
		if (address) clearAgent(env, address);
		registration.reset();
		setCurrentStep(null);
	}, [address, env, clearAgent, registration]);

	return {
		register: registration.mutateAsync,
		status,
		currentStep,
		error: registration.error,
		reset,
	};
}
