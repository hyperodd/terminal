import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DownloadSimpleIcon, DropIcon, GearIcon, TrophyIcon } from "@phosphor-icons/react";
import { useConnection } from "wagmi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useExchangeScope } from "@/providers/exchange-scope";
import {
	useDepositModalActions,
	useFaucetModalActions,
	usePointsModalActions,
	useSettingsDialogActions,
} from "@/stores/use-global-modal-store";

const isTestnet = import.meta.env.VITE_HYPERLIQUID_TESTNET === "true";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

function getScopeAccentClass(scope: string): string {
	switch (scope) {
		case "perp":
			return "border-scope-perp/40";
		case "spot":
			return "border-scope-spot/40";
		case "builders-perp":
			return "border-scope-builders/40";
		default:
			return "border-border-100";
	}
}

export function TopNav() {
	const { open: openDepositModal } = useDepositModalActions();
	const { open: openFaucetModal } = useFaucetModalActions();
	const { open: openPointsModal } = usePointsModalActions();
	const { open: openSettingsDialog } = useSettingsDialogActions();
	const { isConnected } = useConnection();
	const { scope } = useExchangeScope();

	const accentClass = getScopeAccentClass(scope);

	return (
		<header
			className={cn(
				"fixed top-0 left-0 right-0 z-40 h-11 border-b px-3 flex items-center justify-between bg-surface-execution transition-colors duration-300 ease-in-out",
				accentClass,
			)}
		>
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex items-center gap-1.5">
					<img src="/hyperodd_icon.png" alt="Hyperodd" className="size-5 dark:hidden" />
					<img src="/Icon_only_cyan.png" alt="Hyperodd" className="size-5 hidden dark:block" />
					<span className="text-xs font-bold tracking-tight">
						<span className="text-primary-default">Hyperodd</span>
						<span className="text-text-950"> Terminal</span>
					</span>
				</div>
			</div>

			<div className="flex items-center gap-2">
				{isConnected && (
					<>
						<Button
							variant="outlined"
							onClick={openPointsModal}
							className="h-6 px-2 text-xs font-medium rounded-xs bg-fill-100 border border-border-300 text-text-950 hover:border-border-500 transition-colors inline-flex items-center gap-1 shadow-xs"
						>
							<TrophyIcon className="size-4" />
							<Trans>Points</Trans>
						</Button>
						{isTestnet ? (
							<Button
								variant="outlined"
								onClick={openFaucetModal}
								className="h-6 px-2 text-xs font-medium rounded-xs bg-fill-100 border border-border-300 text-text-950 hover:border-border-500 transition-colors inline-flex items-center gap-1 shadow-xs"
							>
								<DropIcon className="size-4" />
								<Trans>Faucet</Trans>
							</Button>
						) : (
							<Button
								variant="outlined"
								onClick={() => openDepositModal("deposit")}
								className="h-6 px-2 text-xs font-medium rounded-xs bg-fill-100 border border-border-300 text-text-950 hover:border-border-500 transition-colors inline-flex items-center gap-1 shadow-xs"
							>
								<DownloadSimpleIcon className="size-4" />
								<Trans>Deposit</Trans>
							</Button>
						)}
					</>
				)}
				<UserMenu />
				<div className="flex items-center gap-1">
					<ThemeToggle />
					<button
						type="button"
						className="size-7 inline-flex items-center justify-center rounded text-text-600 hover:text-primary-default transition-colors duration-150"
						onClick={openSettingsDialog}
						aria-label={t`Settings`}
					>
						<GearIcon className="size-4" />
					</button>
				</div>
			</div>
		</header>
	);
}
