import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useConnection } from "wagmi";

const API_URL = import.meta.env.VITE_HYPERMILES_API_URL;
const STORAGE_KEY = "hyperterminal:referral";

function getStoredReferral(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(STORAGE_KEY);
}

function clearStoredReferral() {
	localStorage.removeItem(STORAGE_KEY);
}

export function useReferralCapture() {
	useEffect(() => {
		if (typeof window === "undefined") return;

		const params = new URLSearchParams(window.location.search);
		const referral = params.get("referral");
		if (!referral) return;

		localStorage.setItem(STORAGE_KEY, referral);

		params.delete("referral");
		const newSearch = params.toString();
		const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
		window.history.replaceState({}, "", newUrl);
	}, []);
}

export function useAutoRegisterReferral() {
	const { address, isConnected } = useConnection();
	const { user, authenticated } = usePrivy();
	const registeredRef = useRef(false);

	useEffect(() => {
		async function autoRegister() {
			if (!isConnected || !authenticated || !address || registeredRef.current) return;

			registeredRef.current = true;

			try {
				const res = await fetch(`${API_URL}/user_points?user_address=${address}`);
				if (res.ok) {
					clearStoredReferral();
					return;
				}

				if (res.status === 404) {
					const referral = getStoredReferral();
					const body: Record<string, string> = { walletAddress: address };
					if (referral) {
						body.referralCode = referral;
					}
					if (user?.id) {
						body.privyUserId = user.id;
					}
					await fetch(`${API_URL}/users`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
					});
					clearStoredReferral();
				}
			} catch (error) {
				console.error("Auto-registration failed:", error);
				registeredRef.current = false;
			}
		}

		autoRegister();
	}, [isConnected, authenticated, address, user?.id]);
}

export { getStoredReferral };
