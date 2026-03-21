import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
	CheckCircleIcon,
	ClockIcon,
	CurrencyDollarIcon,
	DropIcon,
	SpinnerGapIcon,
	WalletIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useConnection } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoRow } from "@/components/ui/info-row";
import { cn } from "@/lib/cn";
import { useFaucetClaim } from "@/lib/faucet/use-faucet-claim";
import { useFaucetModalActions, useFaucetModalOpen } from "@/stores/use-global-modal-store";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

interface StepProps {
	label: string;
	active: boolean;
	done: boolean;
}

function Step({ label, active, done }: StepProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 text-3xs py-1",
				done ? "text-market-up-600" : active ? "text-primary-default" : "text-text-500",
			)}
		>
			{done ? (
				<CheckCircleIcon className="size-3.5" />
			) : active ? (
				<SpinnerGapIcon className="size-3.5 animate-spin" />
			) : (
				<div className="size-3.5 rounded-full border border-current opacity-40" />
			)}
			<span>{label}</span>
		</div>
	);
}

function ClaimProgress({ status }: { status: string }) {
	const steps = [
		{ key: "verifying-captcha", label: t`Verifying captcha` },
		{ key: "verifying-balance", label: t`Checking balance` },
		{ key: "claiming", label: t`Claiming USDH` },
	];
	const activeIdx = steps.findIndex((s) => s.key === status);

	return (
		<div className="space-y-0.5">
			{steps.map((step, i) => (
				<Step key={step.key} label={step.label} active={i === activeIdx} done={i < activeIdx} />
			))}
		</div>
	);
}

export function FaucetModal() {
	const open = useFaucetModalOpen();
	const { close } = useFaucetModalActions();
	const { address } = useConnection();
	const { status, error, result, claim, reset } = useFaucetClaim();
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const turnstileRef = useRef<TurnstileInstance>(null);

	const isProcessing = status === "verifying-captcha" || status === "verifying-balance" || status === "claiming";

	function handleClose() {
		reset();
		setTurnstileToken(null);
		close();
	}

	function handleClaim() {
		if (!turnstileToken || !address) return;
		claim(turnstileToken, address);
	}

	function handleRetry() {
		reset();
		setTurnstileToken(null);
		turnstileRef.current?.reset();
	}

	if (status === "success") {
		return (
			<Dialog open onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							<Trans>Faucet</Trans>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 py-6">
						<div className="flex size-14 items-center justify-center rounded-full bg-market-up-100 border border-market-up-600/30">
							<CheckCircleIcon className="size-7 text-market-up-600" />
						</div>
						<div className="text-center space-y-1.5">
							<p className="text-sm font-medium">
								<Trans>USDH claimed!</Trans>
							</p>
							<p className="text-xs text-text-600">
								<span className="tabular-nums font-medium text-market-up-600">{result?.amount} USDH</span>{" "}
								<Trans>sent to your account</Trans>
							</p>
						</div>
						<Button onClick={handleClose} className="w-full">
							<Trans>Done</Trans>
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (status === "error") {
		return (
			<Dialog open onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							<Trans>Faucet</Trans>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 py-6">
						<div className="flex size-14 items-center justify-center rounded-full bg-market-down-100 border border-market-down-600/30">
							<WarningCircleIcon className="size-7 text-market-down-600" />
						</div>
						<div className="text-center space-y-1.5">
							<p className="text-sm font-medium">
								<Trans>Claim failed</Trans>
							</p>
							{error && <p className="text-xs text-text-600">{error}</p>}
						</div>
						<div className="flex w-full gap-2">
							<Button variant="outlined" onClick={handleClose} className="flex-1">
								<Trans>Cancel</Trans>
							</Button>
							<Button onClick={handleRetry} className="flex-1">
								<Trans>Retry</Trans>
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (isProcessing) {
		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent className="sm:max-w-md" showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>
							<Trans>Faucet</Trans>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 py-6">
						<div className="relative">
							<div className="absolute inset-0 animate-ping rounded-full bg-primary-default/20" />
							<div className="relative flex size-14 items-center justify-center rounded-full bg-primary-default/10 border border-primary-default/30">
								<SpinnerGapIcon className="size-7 animate-spin text-primary-default" />
							</div>
						</div>
						<ClaimProgress status={status} />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						<Trans>Faucet</Trans>
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					{!address ? (
						<div className="flex flex-col items-center gap-4 py-8">
							<div className="flex size-12 items-center justify-center rounded-full bg-surface-analysis border border-border-200/40">
								<WalletIcon className="size-6 text-text-950" />
							</div>
							<div className="text-center space-y-1">
								<p className="text-sm font-medium">
									<Trans>Wallet not connected</Trans>
								</p>
								<p className="text-3xs text-text-950">
									<Trans>Connect your wallet to claim USDH</Trans>
								</p>
							</div>
						</div>
					) : (
						<>
							<div className="rounded-xs border border-border-200/40 bg-surface-analysis p-3 space-y-2 text-3xs">
								<InfoRow
									className="p-0"
									labelClassName="flex items-center gap-1.5 text-text-950"
									label={
										<>
											<DropIcon className="size-3" />
											<Trans>Amount</Trans>
										</>
									}
									value="1,000 USDH"
									valueClassName="font-medium"
								/>
								<InfoRow
									className="p-0"
									labelClassName="flex items-center gap-1.5 text-text-950"
									label={
										<>
											<CurrencyDollarIcon className="size-3" />
											<Trans>Requirement</Trans>
										</>
									}
									value={t`$5+ USDC balance`}
								/>
								<InfoRow
									className="p-0"
									labelClassName="flex items-center gap-1.5 text-text-950"
									label={
										<>
											<ClockIcon className="size-3" />
											<Trans>Cooldown</Trans>
										</>
									}
									value={t`24 hours`}
								/>
							</div>

							<div className="flex justify-center">
								<Turnstile
									ref={turnstileRef}
									siteKey={TURNSTILE_SITE_KEY}
									options={{ theme: "dark", size: "normal" }}
									onSuccess={setTurnstileToken}
									onExpire={() => setTurnstileToken(null)}
									onError={() => setTurnstileToken(null)}
								/>
							</div>

							<Button variant="contained" onClick={handleClaim} disabled={!turnstileToken} className="w-full">
								<DropIcon className="size-4" />
								<Trans>Claim 1,000 USDH</Trans>
							</Button>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
