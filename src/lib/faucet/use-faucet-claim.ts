import { useState } from "react";

const API_URL = import.meta.env.VITE_HYPERMILES_API_URL;

type FaucetStatus = "idle" | "claiming" | "success" | "error";

interface FaucetResult {
	amount: number;
	walletAddress: string;
}

interface UseFaucetClaimReturn {
	status: FaucetStatus;
	error: string | null;
	result: FaucetResult | null;
	claim: (address: string, getAccessToken: () => Promise<string | null>) => Promise<void>;
	reset: () => void;
}

export function useFaucetClaim(): UseFaucetClaimReturn {
	const [status, setStatus] = useState<FaucetStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<FaucetResult | null>(null);

	async function claim(address: string, getAccessToken: () => Promise<string | null>) {
		setStatus("claiming");
		setError(null);
		setResult(null);

		try {
			const token = await getAccessToken();
			if (!token) throw new Error("Not authenticated");

			const res = await fetch(`${API_URL}/faucet`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ walletAddress: address }),
			});

<<<<<<< HEAD
			if (!res.ok) {
				const text = await res.text();
				let message = `Claim failed (${res.status})`;
				try {
					const data = JSON.parse(text);
					if (data.error) message = data.error;
				} catch {}
				throw new Error(message);
			}

			const data = await res.json();

=======
			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || `Claim failed (${res.status})`);
			}

>>>>>>> a16fd33 (feat: update faucet)
			setResult({ amount: data.amount, walletAddress: data.walletAddress });
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
