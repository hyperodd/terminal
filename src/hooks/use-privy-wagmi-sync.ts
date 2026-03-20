import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
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
 *
 * The check runs only when Privy becomes ready (once on init), not reactively
 * on auth/connection changes — otherwise it would disconnect wagmi mid-login
 * before Privy finishes the wallet authentication handshake.
 */
export function usePrivyWagmiSync() {
	const { ready, authenticated } = usePrivy();
	const { isConnected } = useConnection();
	const { mutate: disconnect } = useDisconnect();

	const authenticatedRef = useRef(authenticated);
	const isConnectedRef = useRef(isConnected);
	authenticatedRef.current = authenticated;
	isConnectedRef.current = isConnected;

	useEffect(() => {
		if (!ready) return;
		if (!authenticatedRef.current && isConnectedRef.current) {
			disconnect();
		}
	}, [ready, disconnect]);
}
