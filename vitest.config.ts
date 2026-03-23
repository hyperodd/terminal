import { lingui } from "@lingui/vite-plugin";
import path from "node:path";
import { defineConfig } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
		lingui(),
	],
	resolve: {
		alias: {
			"@lingui/core/macro": path.resolve(__dirname, "src/lib/test-setup/lingui-macro-stub.ts"),
		},
	},
	test: {
		environment: "node",
	},
});
