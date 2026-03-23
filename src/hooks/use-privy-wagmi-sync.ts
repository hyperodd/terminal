import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useConnection, useDisconnect } from "wagmi";

const PRIVY_READY_TIMEOUT_MS = 8_000;
const EMBEDDED_WALLET_PROXY_TIMEOUT_MS = 5_000;

function clearPrivyStorage() {
	const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith("privy:") || k.startsWith("privy-"));
	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}
}

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
 *
 * If Privy does not become ready within PRIVY_READY_TIMEOUT_MS, its stored
 * session data is cleared and the page reloads. This recovers from stale or
 * corrupted tokens that silently block initialization.
 *
 * If Privy is ready+authenticated but wagmi stays disconnected beyond
 * EMBEDDED_WALLET_PROXY_TIMEOUT_MS, the embedded wallet proxy failed to
 * initialize (typically Firefox dynamic state partitioning isolating the
 * auth.privy.io iframe's storage). Logging out and reloading clears the
 * broken embedded wallet state so the next login initializes fresh.
 */
export function usePrivyWagmiSync() {
	const { ready, authenticated, logout } = usePrivy();
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

	useEffect(() => {
		if (ready) return;
		const timer = setTimeout(() => {
			clearPrivyStorage();
			window.location.reload();
		}, PRIVY_READY_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [ready]);

	useEffect(() => {
		if (!ready || !authenticated || isConnected) return;
		const timer = setTimeout(() => {
			logout().finally(() => {
				clearPrivyStorage();
				window.location.reload();
			});
		}, EMBEDDED_WALLET_PROXY_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [ready, authenticated, isConnected, logout]);
}
