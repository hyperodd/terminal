import { Trans } from "@lingui/react/macro";
import {
	ArrowRightIcon,
	CheckIcon,
	CopyIcon,
	LightningIcon,
	SpinnerGapIcon,
	TrophyIcon,
	UsersIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useId, useState } from "react";
import { useConnection } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoRow } from "@/components/ui/info-row";
import { Input } from "@/components/ui/input";
import { useCopyToClipboard } from "@/hooks/ui/use-copy-to-clipboard";
import { getStoredReferral } from "@/hooks/use-referral";
import { usePointsModalActions, usePointsModalOpen } from "@/stores/use-global-modal-store";

const API_URL = import.meta.env.VITE_HYPERMILES_API_URL;

type ModalView = "loading" | "signup" | "summary" | "error";

interface UserPoints {
	walletAddress: string;
	totalPoints: string;
	rank: number;
	referralCode: string;
	firstOrderAt: string | null;
	lastOrderAt: string | null;
}

interface EarnMethodProps {
	icon: React.ReactNode;
	title: React.ReactNode;
	description: React.ReactNode;
}

function EarnMethod({ icon, title, description }: EarnMethodProps) {
	return (
		<div className="flex items-start gap-2.5">
			<div className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-primary-default/8 border border-primary-default/15">
				{icon}
			</div>
			<div className="space-y-0.5 min-w-0">
				<p className="text-2xs font-medium text-text-950">{title}</p>
				<p className="text-3xs text-text-500">{description}</p>
			</div>
		</div>
	);
}

function CopyableCode({ code }: { code: string }) {
	const { copied, copy } = useCopyToClipboard();

	return (
		<button
			type="button"
			className="inline-flex items-center gap-1.5 rounded-xs bg-surface-analysis border border-border-200/40 px-2 py-1 text-xs font-mono text-text-950 hover:border-border-300 transition-colors"
			onClick={() => copy(code)}
		>
			{code}
			{copied ? <CheckIcon className="size-3 text-market-up-600" /> : <CopyIcon className="size-3 text-text-500" />}
		</button>
	);
}

function HowToEarn() {
	return (
		<div className="space-y-3">
			<p className="text-3xs font-medium uppercase tracking-wider text-text-500">
				<Trans>How to earn</Trans>
			</p>
			<div className="space-y-3">
				<EarnMethod
					icon={<LightningIcon className="size-3.5 text-primary-default" />}
					title={<Trans>Trade</Trans>}
					description={<Trans>Earn points for every trade you execute on Hyperliquid</Trans>}
				/>
				<EarnMethod
					icon={<UsersIcon className="size-3.5 text-primary-default" />}
					title={<Trans>Refer friends</Trans>}
					description={<Trans>Share your referral code and earn bonus points when they trade</Trans>}
				/>
			</div>
		</div>
	);
}

export function PointsModal() {
	const open = usePointsModalOpen();
	const { close } = usePointsModalActions();
	const { address } = useConnection();
	const { user } = usePrivy();

	const [view, setView] = useState<ModalView>("loading");
	const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
	const [referralCode, setReferralCode] = useState(() => getStoredReferral() ?? "");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const referralInputId = useId();

	function fetchPoints() {
		if (!address) return;
		setView("loading");
		setError(null);
		setReferralCode("");

		fetch(`${API_URL}/user_points?user_address=${address}`)
			.then((res) => {
				if (res.ok) return res.json();
				if (res.status === 404) return null;
				throw new Error("Failed to fetch points");
			})
			.then((data) => {
				if (data) {
					setUserPoints(data);
					setView("summary");
				} else {
					setView("signup");
				}
			})
			.catch(() => {
				setError("Unable to connect to points service");
				setView("error");
			});
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchPoints is intentionally excluded to avoid re-creating on every render
	useEffect(() => {
		if (!open || !address) return;
		fetchPoints();
	}, [open, address]);

	function handleClose() {
		close();
		setView("loading");
		setUserPoints(null);
		setError(null);
		setReferralCode("");
		setSubmitting(false);
	}

	async function handleSignup(withReferral: boolean) {
		if (!address) return;
		setSubmitting(true);
		setError(null);

		const body: Record<string, string> = { walletAddress: address };
		if (user?.id) {
			body.privyUserId = user.id;
		}
		if (withReferral && referralCode.trim()) {
			body.referralCode = referralCode.trim();
		}

		try {
			const res = await fetch(`${API_URL}/users`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error ?? "Signup failed");
			}

			const created = await res.json();
			setUserPoints({
				walletAddress: created.walletAddress,
				totalPoints: created.totalPoints ?? "0",
				rank: 0,
				referralCode: created.referralCode,
				firstOrderAt: null,
				lastOrderAt: null,
			});
			setView("summary");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Signup failed");
		} finally {
			setSubmitting(false);
		}
	}

	if (view === "summary" && userPoints) {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							<Trans>Hypermiles</Trans>
						</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-5">
						<div className="rounded-xs border border-border-200/40 bg-surface-analysis p-4">
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<p className="text-3xs uppercase tracking-wider text-text-500">
										<Trans>Total Points</Trans>
									</p>
									<p className="text-xl font-bold tabular-nums text-text-950">{userPoints.totalPoints}</p>
								</div>
								{userPoints.rank > 0 && (
									<div className="flex items-center gap-1.5 rounded-xs bg-highlight/10 border border-highlight/20 px-2 py-1">
										<TrophyIcon className="size-3.5 text-highlight" />
										<span className="text-2xs font-medium text-highlight">#{userPoints.rank}</span>
									</div>
								)}
							</div>
						</div>

						<div className="rounded-xs border border-border-200/40 bg-surface-analysis p-3 space-y-2 text-3xs">
							<InfoRow
								className="p-0"
								labelClassName="flex items-center gap-1.5 text-text-500"
								label={<Trans>Your Referral Link</Trans>}
								value={<CopyableCode code={`${window.location.origin}/?referral=${userPoints.referralCode}`} />}
							/>
						</div>

						<HowToEarn />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (view === "error") {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							<Trans>Hypermiles</Trans>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 py-6">
						<div className="flex size-14 items-center justify-center rounded-full bg-market-down-100 border border-market-down-600/30">
							<WarningCircleIcon className="size-7 text-market-down-600" />
						</div>
						<p className="text-xs text-text-600">{error}</p>
						<div className="flex w-full gap-2">
							<Button variant="outlined" onClick={handleClose} className="flex-1">
								<Trans>Close</Trans>
							</Button>
							<Button variant="contained" onClick={fetchPoints} className="flex-1">
								<Trans>Retry</Trans>
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (view === "signup") {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							<Trans>Join Hypermiles</Trans>
						</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-5">
						<p className="text-xs text-text-600">
							<Trans>Earn points every time you trade on Hyperliquid. Refer friends to earn even more.</Trans>
						</p>

						<HowToEarn />

						<div className="space-y-1.5">
							<label htmlFor={referralInputId} className="text-3xs font-medium text-text-500">
								<Trans>Referral Code (optional)</Trans>
							</label>
							<Input
								id={referralInputId}
								value={referralCode}
								onChange={(e) => setReferralCode(e.target.value)}
								placeholder="Enter code"
								disabled={submitting}
							/>
							{error && <p className="text-3xs text-market-down-600">{error}</p>}
						</div>

						<div className="flex flex-col gap-2">
							<Button
								variant="contained"
								onClick={() => handleSignup(!!referralCode.trim())}
								disabled={submitting}
								className="w-full"
							>
								{submitting ? (
									<SpinnerGapIcon className="size-4 animate-spin" />
								) : (
									<>
										<Trans>Get Started</Trans>
										<ArrowRightIcon className="size-3.5" />
									</>
								)}
							</Button>
							{referralCode.trim() && (
								<button
									type="button"
									className="text-3xs text-text-500 hover:text-text-600 transition-colors"
									onClick={() => {
										setReferralCode("");
										handleSignup(false);
									}}
									disabled={submitting}
								>
									<Trans>Skip referral</Trans>
								</button>
							)}
						</div>
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
						<Trans>Hypermiles</Trans>
					</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col items-center gap-4 py-8">
					<SpinnerGapIcon className="size-7 animate-spin text-primary-default" />
					<p className="text-xs text-text-600">
						<Trans>Loading points...</Trans>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
