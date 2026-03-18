import { useLogin } from "@privy-io/react-auth";
import { useEffect } from "react";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function WalletDialog({ open, onOpenChange }: Props) {
	const { login } = useLogin({
		onComplete: () => onOpenChange(false),
		onError: () => onOpenChange(false),
	});

	useEffect(() => {
		if (open) {
			login();
		}
	}, [open, login]);

	return null;
}
