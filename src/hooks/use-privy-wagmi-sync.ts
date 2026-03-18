import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { useConnection, useDisconnect } from "wagmi";

/**
 * Keeps Privy auth and wagmi wallet state in sync.
 *
 * Wagmi persists the last connector and auto-reconnects on mount, even when
 * the Privy session has expired. This leaves `isConnected: true` with no
 * Privy session — causing logout() to 400 and the UI to show a stale address.
 *
 * This hook detects that mismatch once Privy is ready and force-disconnects
 * wagmi so both layers agree on the unauthenticated state.
 */
export function usePrivyWagmiSync() {
	const { ready, authenticated } = usePrivy();
	const { isConnected } = useConnection();
	const { disconnect } = useDisconnect();

	useEffect(() => {
		if (!ready) return;
		if (!authenticated && isConnected) {
			disconnect();
		}
	}, [ready, authenticated, isConnected, disconnect]);
}
