import type { AcrossClient } from "@across-protocol/app-sdk";
import type { SwapApiToken } from "@across-protocol/app-sdk/dist/actions/index.js";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CheckIcon, CopyIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import { useConnection } from "wagmi";
import { arbitrum, base, mainnet } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoRow, InfoRowGroup } from "@/components/ui/info-row";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useAcrossBridgeModalActions, useAcrossBridgeModalOpen } from "@/stores/use-global-modal-store";

const HYPER_CORE_CHAIN_ID = 1337;

const USDC_PERPS = {
	address: "0x2100000000000000000000000000000000000000" as Address,
	symbol: "USDC",
	decimals: 8,
};

const COUNTERFACTUAL_CHAINS = [
	{ id: mainnet.id, name: "Ethereum", shortName: "ETH" },
	{ id: arbitrum.id, name: "Arbitrum", shortName: "ARB" },
	{ id: base.id, name: "Base", shortName: "BASE" },
] as const;

const POPULAR_SYMBOLS = new Set(["USDC", "USDT", "USDT0", "ETH", "WETH", "WBTC", "DAI", "cbBTC"]);

const INTEGRATOR_ID = (import.meta.env.VITE_ACROSS_INTEGRATOR_ID ?? "0xdead") as `0x${string}`;
const ACROSS_API_KEY = import.meta.env.VITE_ACROSS_API_KEY as string | undefined;
const ACROSS_API_BASE = "https://app.across.to/api";

type ModalView = "loading" | "form" | "generating" | "address" | "error";

interface CounterfactualResponse {
	depositAddress: `0x${string}`;
	expectedOutputAmount: string;
	minOutputAmount?: string;
	fees?: { total?: { pct?: string } };
	expiresAt?: number;
	expectedFillTime?: number;
}

async function fetchCounterfactual(params: {
	inputToken: string;
	outputToken: string;
	originChainId: number;
	destinationChainId: number;
	amount: bigint;
	recipient: string;
	refundAddress: string;
}): Promise<CounterfactualResponse> {
	if (!ACROSS_API_KEY) throw new Error("Across API key not configured");

	const search = new URLSearchParams({
		useDepositAddress: "true",
		inputToken: params.inputToken,
		outputToken: params.outputToken,
		originChainId: String(params.originChainId),
		destinationChainId: String(params.destinationChainId),
		amount: params.amount.toString(),
		recipient: params.recipient,
		refundAddress: params.refundAddress,
		integratorId: INTEGRATOR_ID,
	});

	const res = await fetch(`${ACROSS_API_BASE}/swap/counterfactual?${search.toString()}`, {
		headers: { Authorization: `Bearer ${ACROSS_API_KEY}` },
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.message ?? `Across API error (${res.status})`);
	}
	return res.json();
}

export function AcrossBridgeModal() {
	const isOpen = useAcrossBridgeModalOpen();
	if (!isOpen) return null;
	return <AcrossBridgeModalContent />;
}

function AcrossBridgeModalContent() {
	const { close } = useAcrossBridgeModalActions();
	const { address: recipientAddress } = useConnection();

	const [acrossClient, setAcrossClient] = useState<AcrossClient | null>(null);
	const [sourceTokens, setSourceTokens] = useState<SwapApiToken[]>([]);
	const [isLoadingTokens, setIsLoadingTokens] = useState(false);

	const [selectedChainId, setSelectedChainId] = useState<number>(arbitrum.id);
	const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("");
	const [amount, setAmount] = useState("");
	const [recipientOverride, setRecipientOverride] = useState("");

	const [view, setView] = useState<ModalView>("loading");
	const [error, setError] = useState<string | null>(null);
	const [deposit, setDeposit] = useState<CounterfactualResponse | null>(null);
	const [copied, setCopied] = useState(false);

	const finalRecipient = (recipientOverride || recipientAddress || "") as `0x${string}` | "";

	useEffect(() => {
		let cancelled = false;
		import("@across-protocol/app-sdk")
			.then(async ({ createAcrossClient }) => {
				const client = createAcrossClient({
					integratorId: INTEGRATOR_ID,
					chains: [mainnet, arbitrum, base],
				});
				if (cancelled) return;
				setAcrossClient(client);
				try {
					const tokens = await client.getSwapTokens({ chainId: arbitrum.id });
					if (cancelled) return;
					const popular = tokens.filter((tok) => POPULAR_SYMBOLS.has(tok.symbol));
					setSourceTokens(popular);
					if (popular.length > 0) setSelectedTokenAddress(popular[0].address);
					setView("form");
				} catch {
					if (cancelled) return;
					setError(t`Unable to load bridge routes. Please try again.`);
					setView("error");
				}
			})
			.catch(() => {
				if (cancelled) return;
				setError(t`Unable to load bridge module. Please try again.`);
				setView("error");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	async function handleChainChange(chainId: number) {
		if (!acrossClient) return;
		setSelectedChainId(chainId);
		setSelectedTokenAddress("");
		setIsLoadingTokens(true);
		try {
			const tokens = await acrossClient.getSwapTokens({ chainId });
			const popular = tokens.filter((tok) => POPULAR_SYMBOLS.has(tok.symbol));
			setSourceTokens(popular);
			if (popular.length > 0) setSelectedTokenAddress(popular[0].address);
		} catch {
			setSourceTokens([]);
		} finally {
			setIsLoadingTokens(false);
		}
	}

	const selectedToken = sourceTokens.find((tok) => tok.address === selectedTokenAddress);
	const tokenDecimals = selectedToken?.decimals ?? 6;
	const amountValue = parseFloat(amount) || 0;
	const isValidRecipient = /^0x[0-9a-fA-F]{40}$/.test(finalRecipient);
	const canGenerate = !!selectedTokenAddress && amountValue > 0 && isValidRecipient && !!ACROSS_API_KEY;

	async function handleGenerate() {
		if (!selectedTokenAddress || !isValidRecipient) return;
		setView("generating");
		setError(null);

		try {
			const response = await fetchCounterfactual({
				inputToken: selectedTokenAddress,
				outputToken: USDC_PERPS.address,
				originChainId: selectedChainId,
				destinationChainId: HYPER_CORE_CHAIN_ID,
				amount: parseUnits(amount, tokenDecimals),
				recipient: finalRecipient,
				refundAddress: recipientAddress || finalRecipient,
			});
			setDeposit(response);
			setView("address");
		} catch (err) {
			setError(err instanceof Error ? err.message : t`Failed to generate deposit address`);
			setView("error");
		}
	}

	function handleReset() {
		setDeposit(null);
		setError(null);
		setView("form");
	}

	async function handleCopy() {
		if (!deposit) return;
		await navigator.clipboard.writeText(deposit.depositAddress);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	const expectedOutput = deposit ? formatUnits(BigInt(deposit.expectedOutputAmount), USDC_PERPS.decimals) : "";
	const feePct = deposit?.fees?.total?.pct !== undefined ? Number(deposit.fees.total.pct) / 1e16 : null;
	const selectedChainName = COUNTERFACTUAL_CHAINS.find((c) => c.id === selectedChainId)?.name ?? "";

	return (
		<Dialog open onOpenChange={close}>
			<DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
				<DialogHeader className="px-5 pt-5 pb-3 border-b border-border-200/50">
					<DialogTitle>
						<Trans>Deposit via Across</Trans>
					</DialogTitle>
				</DialogHeader>

				<div className="px-5 py-4">
					{!ACROSS_API_KEY && (
						<div className="mb-3 flex items-start gap-2 p-2.5 bg-warning-700/10 border border-warning-700/20 rounded-xs">
							<WarningCircleIcon className="size-3.5 text-warning-700 shrink-0 mt-0.5" />
							<p className="text-xs text-warning-700">
								<Trans>Across API key is not configured. Set VITE_ACROSS_API_KEY in your environment.</Trans>
							</p>
						</div>
					)}

					{view === "loading" && (
						<div className="flex flex-col items-center gap-3 py-8">
							<SpinnerGapIcon className="size-6 animate-spin text-primary-default" />
							<p className="text-xs text-text-600">
								<Trans>Loading bridge routes...</Trans>
							</p>
						</div>
					)}

					{view === "generating" && (
						<div className="flex flex-col items-center gap-4 py-8">
							<SpinnerGapIcon className="size-7 animate-spin text-primary-default" />
							<p className="text-xs text-text-950 text-center">
								<Trans>Generating deposit address...</Trans>
							</p>
						</div>
					)}

					{view === "error" && (
						<div className="flex flex-col items-center gap-4 py-6">
							<div className="flex size-14 items-center justify-center rounded-full bg-market-down-100 border border-market-down-600/30">
								<WarningCircleIcon className="size-7 text-market-down-600" />
							</div>
							<p className="text-xs text-text-600 text-center break-all w-full">{error}</p>
							<div className="flex w-full gap-2">
								<Button variant="outlined" onClick={close} className="flex-1">
									<Trans>Close</Trans>
								</Button>
								<Button variant="contained" onClick={handleReset} className="flex-1">
									<Trans>Retry</Trans>
								</Button>
							</div>
						</div>
					)}

					{view === "address" && deposit && (
						<AddressView
							deposit={deposit}
							expectedOutput={expectedOutput}
							sourceSymbol={selectedToken?.symbol ?? ""}
							sourceChainName={selectedChainName}
							amount={amount}
							feePct={feePct}
							copied={copied}
							onCopy={handleCopy}
							onNew={handleReset}
							onClose={close}
						/>
					)}

					{view === "form" && (
						<div className="space-y-3">
							<div className="p-3 rounded-xs border border-border-200/40 bg-surface-execution/30">
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs text-text-950 uppercase tracking-wider">
										<Trans>From</Trans>
									</span>
									<Select value={String(selectedChainId)} onValueChange={(val) => handleChainChange(Number(val))}>
										<SelectTrigger size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{COUNTERFACTUAL_CHAINS.map((chain) => (
												<SelectItem key={chain.id} value={String(chain.id)}>
													{chain.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center gap-2">
									<Select
										value={selectedTokenAddress}
										onValueChange={setSelectedTokenAddress}
										disabled={isLoadingTokens}
									>
										<SelectTrigger size="sm" className="w-28 shrink-0">
											{isLoadingTokens ? (
												<SpinnerGapIcon className="size-3 animate-spin" />
											) : (
												<SelectValue placeholder="Token" />
											)}
										</SelectTrigger>
										<SelectContent>
											{sourceTokens.map((token) => (
												<SelectItem key={token.address} value={token.address}>
													{token.symbol}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<NumberInput
										placeholder="0.00"
										value={amount}
										onChange={(e) => setAmount(e.target.value)}
										className="flex-1 h-9 text-base font-medium bg-transparent border-border-200/40 focus:border-primary-default/60 tabular-nums text-right"
									/>
								</div>
							</div>

							<div className="p-3 rounded-xs border border-border-200/40 bg-surface-execution/30 space-y-2">
								<span className="text-xs text-text-950 uppercase tracking-wider">
									<Trans>Hyperliquid account</Trans>
								</span>
								<input
									type="text"
									placeholder="0x..."
									value={recipientOverride || recipientAddress || ""}
									onChange={(e) => setRecipientOverride(e.target.value)}
									className={cn(
										"w-full h-9 px-2 text-xs bg-transparent border rounded-xs tabular-nums outline-none transition-colors",
										isValidRecipient
											? "border-border-200/40 focus:border-primary-default/60"
											: "border-market-down-600/40 focus:border-market-down-600",
									)}
								/>
								<p className="text-3xs text-text-500">
									<Trans>Funds will arrive directly in this account's trading balance.</Trans>
								</p>
							</div>

							<Button variant="contained" size="lg" onClick={handleGenerate} disabled={!canGenerate} className="w-full">
								<Trans>Generate deposit address</Trans>
							</Button>

							<p className="text-3xs text-text-500 text-center">
								<Trans>
									You'll get an address to send {selectedToken?.symbol || "tokens"} from any wallet — no signing
									required.
								</Trans>
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

interface AddressViewProps {
	deposit: CounterfactualResponse;
	expectedOutput: string;
	sourceSymbol: string;
	sourceChainName: string;
	amount: string;
	feePct: number | null;
	copied: boolean;
	onCopy: () => void;
	onNew: () => void;
	onClose: () => void;
}

function AddressView({
	deposit,
	expectedOutput,
	sourceSymbol,
	sourceChainName,
	amount,
	feePct,
	copied,
	onCopy,
	onNew,
	onClose,
}: AddressViewProps) {
	const expiresAt = deposit.expiresAt ? deposit.expiresAt * 1000 : null;
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const timeLeft = useMemo(() => {
		if (!expiresAt) return null;
		const diff = Math.max(0, expiresAt - now);
		const mins = Math.floor(diff / 60000);
		const secs = Math.floor((diff % 60000) / 1000);
		return { diff, label: `${mins}:${secs.toString().padStart(2, "0")}` };
	}, [expiresAt, now]);

	const expired = timeLeft?.diff === 0;

	return (
		<div className="space-y-3">
			<div className="p-3 rounded-xs border border-primary-default/30 bg-primary-default/5">
				<div className="flex items-center justify-between mb-2">
					<span className="text-3xs text-text-950 uppercase tracking-wider">
						<Trans>Deposit address</Trans>
					</span>
					<span className="text-3xs text-text-600">
						<Trans>on</Trans> {sourceChainName}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<code className="flex-1 text-xs font-mono text-text-950 break-all">{deposit.depositAddress}</code>
					<button
						type="button"
						onClick={onCopy}
						className="size-7 flex items-center justify-center rounded-xs border border-border-200/60 hover:bg-surface-analysis transition-colors"
					>
						{copied ? (
							<CheckIcon className="size-3.5 text-market-up-600" />
						) : (
							<CopyIcon className="size-3.5 text-text-600" />
						)}
					</button>
				</div>
			</div>

			<InfoRowGroup className="rounded-xs border border-border-200/40 bg-surface-analysis/50 text-3xs">
				<InfoRow label={<Trans>Send exactly</Trans>} value={`${amount} ${sourceSymbol}`} />
				<InfoRow
					label={<Trans>You receive</Trans>}
					value={expectedOutput ? `~${parseFloat(expectedOutput).toFixed(4)} ${USDC_PERPS.symbol}` : "—"}
				/>
				{feePct !== null && <InfoRow label={<Trans>Fee</Trans>} value={`${feePct.toFixed(3)}%`} />}
				{deposit.expectedFillTime !== undefined && (
					<InfoRow label={<Trans>Est. fill time</Trans>} value={`~${deposit.expectedFillTime}s`} />
				)}
				{timeLeft && (
					<InfoRow
						label={<Trans>Address expires in</Trans>}
						value={expired ? t`Expired` : timeLeft.label}
						valueClassName={cn("tabular-nums", expired && "text-market-down-600")}
					/>
				)}
			</InfoRowGroup>

			<div className="flex items-start gap-2 p-2.5 bg-warning-700/10 border border-warning-700/20 rounded-xs">
				<WarningCircleIcon className="size-3.5 text-warning-700 shrink-0 mt-0.5" />
				<p className="text-xs text-warning-700">
					<Trans>
						Send exactly {amount} {sourceSymbol} on {sourceChainName} to this address. Other amounts or chains may cause
						loss of funds.
					</Trans>
				</p>
			</div>

			<div className="flex gap-2">
				<Button variant="outlined" onClick={onNew} className="flex-1">
					{expired ? <Trans>Generate new address</Trans> : <Trans>New deposit</Trans>}
				</Button>
				<Button variant="contained" onClick={onClose} className="flex-1">
					<Trans>Done — I've sent funds</Trans>
				</Button>
			</div>

			<p className="text-3xs text-text-500 text-center">
				<Trans>Your {USDC_PERPS.symbol} will arrive directly in your Hyperliquid trading balance once confirmed.</Trans>
			</p>
		</div>
	);
}

export default AcrossBridgeModal;
