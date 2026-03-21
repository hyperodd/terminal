import { useState } from "react";

type FaucetStatus = "idle" | "verifying-captcha" | "verifying-balance" | "claiming" | "success" | "error";

interface FaucetResult {
	amount: string;
	txHash?: string;
}

interface UseFaucetClaimReturn {
	status: FaucetStatus;
	error: string | null;
	result: FaucetResult | null;
	claim: (turnstileToken: string, address: string) => Promise<void>;
	reset: () => void;
}

async function postFaucet<T>(path: string, body: Record<string, string>): Promise<T> {
	const res = await fetch(`/api/faucet/${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return res.json();
}

export function useFaucetClaim(): UseFaucetClaimReturn {
	const [status, setStatus] = useState<FaucetStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<FaucetResult | null>(null);

	async function claim(turnstileToken: string, address: string) {
		setStatus("verifying-captcha");
		setError(null);
		setResult(null);

		try {
			const turnstileData = await postFaucet<{ success: boolean; sessionToken?: string; error?: string }>(
				"verify-turnstile",
				{ token: turnstileToken },
			);
			if (!turnstileData.success || !turnstileData.sessionToken)
				throw new Error(turnstileData.error || "Captcha verification failed");
			const sessionToken = turnstileData.sessionToken;

			setStatus("verifying-balance");
			const balanceData = await postFaucet<{
				success: boolean;
				hasMinimumBalance?: boolean;
				totalBalance?: string;
				required?: string;
				error?: string;
			}>("verify-balance", { address, sessionToken });
			if (!balanceData.success) throw new Error(balanceData.error || "Balance check failed");
			if (!balanceData.hasMinimumBalance)
				throw new Error(`Insufficient balance: $${balanceData.totalBalance} (need $${balanceData.required})`);

			setStatus("claiming");
			const claimData = await postFaucet<{
				success: boolean;
				amount?: string;
				txHash?: string;
				error?: string;
				nextClaimTime?: number;
			}>("claim", {
				recipientAddress: address,
				sessionToken,
				authMethod: "wallet",
				walletAddress: address,
			});
			if (!claimData.success) {
				if (claimData.nextClaimTime) {
					const hours = Math.max(1, Math.ceil((claimData.nextClaimTime * 1000 - Date.now()) / (1000 * 60 * 60)));
					throw new Error(`Cooldown active. Try again in ~${hours}h`);
				}
				throw new Error(claimData.error || "Claim failed");
			}

			setResult({ amount: claimData.amount || "1,000", txHash: claimData.txHash });
			setStatus("success");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setStatus("error");
		}
	}

	function reset() {
		setStatus("idle");
		setError(null);
		setResult(null);
	}

	return { status, error, result, claim, reset };
}
