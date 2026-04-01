import { t } from "@lingui/core/macro";
import { PaperPlaneTiltIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { type Address, isAddress } from "viem";
import { useConnection } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_QUOTE_TOKEN, isUsdStablecoin } from "@/config/constants";
import { exceedsBalance, isAmountWithinBalance } from "@/domain/market";
import { type BalanceRow, getAvailableFromTotals, getPerpAvailable } from "@/domain/trade/balances";
import { useAccountBalances } from "@/hooks/trade/use-account-balances";
import { cn } from "@/lib/cn";
import { formatToken } from "@/lib/format";
import { useExchangeSendAsset } from "@/lib/hyperliquid/hooks/exchange";
import { useExchangeSpotSend } from "@/lib/hyperliquid/hooks/exchange/useExchangeSpotSend";
import { useInfoUserAbstraction } from "@/lib/hyperliquid/hooks/info/useInfoUserAbstraction";
import { useSpotTokens } from "@/lib/hyperliquid/markets/use-spot-tokens";
import { floorToString, limitDecimalInput } from "@/lib/trade/numbers";
import { AssetDisplay } from "../components/asset-display";

type AccountType = "perp" | "spot";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialAsset?: string;
	initialAccountType?: AccountType;
}

export function SendDialog({
	open,
	onOpenChange,
	initialAsset = DEFAULT_QUOTE_TOKEN,
	initialAccountType = "spot",
}: Props) {
	const [destination, setDestination] = useState("");
	const [accountType, setAccountType] = useState<AccountType>(initialAccountType);
	const [selectedToken, setSelectedToken] = useState(initialAsset);
	const [amount, setAmount] = useState("");
	const [error, setError] = useState<string | null>(null);

	const { address } = useConnection();
	const { getToken } = useSpotTokens();
	const { mutateAsync: sendAsset, isPending: isSendAssetPending } = useExchangeSendAsset();
	const { mutateAsync: spotSend, isPending: isSpotSendPending } = useExchangeSpotSend();
	const { data: abstractionMode, isLoading: isAbstractionLoading } = useInfoUserAbstraction(
		address as Address | undefined,
	);
	const { perpSummary, spotBalances } = useAccountBalances();

	const isUnifiedAccount = abstractionMode !== "default" && abstractionMode !== undefined;
	const effectiveAccountType = isUnifiedAccount ? "spot" : accountType;

	const isPending = isSendAssetPending || isSpotSendPending;

	const availableSpotTokens = useMemo((): BalanceRow[] => {
		if (!spotBalances?.length) return [];
		return spotBalances
			.filter((b) => {
				const available = getAvailableFromTotals(b.total, b.hold);
				return available > 0;
			})
			.map((b) => ({
				asset: b.coin,
				type: "spot" as const,
				available: String(getAvailableFromTotals(b.total, b.hold)),
				inOrder: b.hold,
				total: b.total,
				usdValue: isUsdStablecoin(b.coin) ? b.total : b.entryNtl,
				entryNtl: b.entryNtl,
			}));
	}, [spotBalances]);

	const tokenOptions = useMemo(() => {
		if (effectiveAccountType === "perp") {
			return [DEFAULT_QUOTE_TOKEN];
		}
		return availableSpotTokens.map((b) => b.asset);
	}, [effectiveAccountType, availableSpotTokens]);

	const tokenInfo = useMemo(() => getToken(selectedToken), [getToken, selectedToken]);
	const tokenId = useMemo(() => {
		if (!tokenInfo) return "";
		return `${tokenInfo.name}:${tokenInfo.tokenId}`;
	}, [tokenInfo]);

	const decimals = useMemo(() => getToken(selectedToken)?.transferDecimals ?? 2, [getToken, selectedToken]);

	const availableBalance = useMemo(() => {
		if (effectiveAccountType === "perp") {
			return getPerpAvailable(perpSummary?.accountValue, perpSummary?.totalMarginUsed);
		}
		const balance = spotBalances?.find((b) => b.coin === selectedToken);
		return getAvailableFromTotals(balance?.total, balance?.hold);
	}, [effectiveAccountType, perpSummary, spotBalances, selectedToken]);

	const availableBalanceStr = useMemo(() => floorToString(availableBalance, decimals), [availableBalance, decimals]);

	const isValidDestination = isAddress(destination);
	const isValidAmount = isAmountWithinBalance(amount, availableBalance);
	const canSend = isValidDestination && isValidAmount && !!tokenId && !isPending && !isAbstractionLoading;

	function handleAccountTypeChange(value: AccountType) {
		setAccountType(value);
		if (value === "perp") {
			setSelectedToken(DEFAULT_QUOTE_TOKEN);
		} else if (!availableSpotTokens.some((t) => t.asset === selectedToken)) {
			setSelectedToken(availableSpotTokens[0]?.asset ?? DEFAULT_QUOTE_TOKEN);
		}
		setAmount("");
	}

	function handleTokenChange(value: string) {
		setSelectedToken(value);
		setAmount("");
	}

	function handleAmountChange(value: string) {
		setAmount(limitDecimalInput(value, decimals));
	}

	function handleMaxClick() {
		setAmount(floorToString(availableBalance, decimals));
	}

	const handleSend = useCallback(async () => {
		if (!canSend) return;

		setError(null);
		try {
			if (isUnifiedAccount) {
				await sendAsset({
					destination,
					sourceDex: "spot",
					destinationDex: selectedToken === DEFAULT_QUOTE_TOKEN ? "" : "spot",
					token: tokenId,
					amount,
				});
			} else if (effectiveAccountType === "perp") {
				await sendAsset({
					destination,
					sourceDex: "",
					destinationDex: "",
					token: tokenId,
					amount,
				});
			} else {
				await spotSend({
					destination,
					token: tokenId,
					amount,
				});
			}
			setDestination("");
			setAmount("");
			onOpenChange(false);
		} catch (err) {
			const message = err instanceof Error ? err.message : t`Send failed`;
			setError(message);
		}
	}, [
		effectiveAccountType,
		amount,
		canSend,
		destination,
		isUnifiedAccount,
		onOpenChange,
		selectedToken,
		sendAsset,
		spotSend,
		tokenId,
	]);

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			setDestination("");
			setAmount("");
			setError(null);
		}
		onOpenChange(newOpen);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{t`Send Tokens`}</DialogTitle>
					<DialogDescription>{t`Send tokens to another account on the Hyperliquid L1.`}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Input
							placeholder={t`Destination`}
							value={destination}
							onChange={(e) => setDestination(e.target.value)}
							inputSize="lg"
							className={cn(
								"w-full bg-surface-base/50 border-border-200/60",
								destination && !isValidDestination && "border-market-down-600 focus-visible:border-market-down-600",
							)}
						/>
					</div>

					<div className="flex gap-2">
						{!isUnifiedAccount && (
							<Select value={accountType} onValueChange={(v) => handleAccountTypeChange(v as AccountType)}>
								<SelectTrigger className="flex-1 h-10 bg-surface-base/50 border-border-200/60">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="perp">{t`Perps Account`}</SelectItem>
									<SelectItem value="spot">{t`Spot Account`}</SelectItem>
								</SelectContent>
							</Select>
						)}

						<Select value={selectedToken} onValueChange={handleTokenChange}>
							<SelectTrigger className="flex-1 h-10 bg-surface-base/50 border-border-200/60">
								<AssetDisplay coin={selectedToken} hideIcon />
							</SelectTrigger>
							<SelectContent>
								{tokenOptions.map((tokenName) => (
									<SelectItem key={tokenName} value={tokenName}>
										<AssetDisplay coin={tokenName} hideIcon />
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<NumberInput
						placeholder={t`Amount`}
						value={amount}
						onChange={(e) => handleAmountChange(e.target.value)}
						maxLabel={
							<>
								{t`MAX`}: {formatToken(availableBalanceStr, 2)}
							</>
						}
						onMaxClick={handleMaxClick}
						className={cn(
							"w-full h-10 text-sm bg-surface-base/50 border-border-200/60 tabular-nums",
							exceedsBalance(amount, availableBalance) && "border-market-down-600 focus:border-market-down-600",
						)}
					/>

					{error && (
						<div className="flex items-center gap-2 p-2.5 rounded-xs bg-market-down-100 border border-market-down-600/20 text-3xs text-market-down-600">
							<WarningCircleIcon className="size-3.5 shrink-0" />
							<span className="flex-1">{error}</span>
						</div>
					)}

					<Button onClick={handleSend} disabled={!canSend} size="lg" className="w-full">
						{isPending && <SpinnerGapIcon className="size-3.5 animate-spin mr-2" />}
						<PaperPlaneTiltIcon className="size-3.5 mr-2" />
						{isPending ? t`Sending...` : t`Send`}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
