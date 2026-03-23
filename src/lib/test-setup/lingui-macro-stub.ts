/**
 * Stub for @lingui/core/macro in tests. Avoids requiring babel-plugin-macros at runtime.
 * Template tag returns the literal string (no translation).
 */
export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
	return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
}
