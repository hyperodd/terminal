import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, type PluginOption } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { lingui } from '@lingui/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const isAnalyze = process.env.ANALYZE === 'true'
const eventsPolyfill = resolve(dirname(fileURLToPath(import.meta.url)), 'node_modules/events/events.js')

const browserOnlyModules: Record<string, string> = {
  klinecharts: `
    export const init = () => ({});
    export const dispose = () => {};
    export const FormatDateType = {};
    export const LoadDataType = {};
    export const CandleType = {};
    export const LineType = {};
    export const TooltipShowRule = {};
    export const TooltipShowType = {};
    export const YAxisPosition = {};
    export default {};
  `,
  'motion/react': `
    import { createElement, forwardRef } from 'react';
    const el = (tag) => forwardRef(({ children, animate, initial, exit, transition, variants,
      whileHover, whileTap, whileFocus, whileInView, whileDrag, drag, dragConstraints,
      layout, layoutId, onAnimationStart, onAnimationComplete, ...rest }, ref) =>
      createElement(tag, { ...rest, ref }, children));
    export const motion = new Proxy({}, { get: (_, tag) => el(tag) });
    export const m = motion;
    export const AnimatePresence = ({ children }) => children;
    export const MotionConfig = ({ children }) => children;
    export const LazyMotion = ({ children }) => children;
    export const useReducedMotion = () => null;
    export const domAnimation = {};
    export const domMax = {};
    export default {};
  `,
  wagmi: `
    import { createElement } from 'react';
    export const WagmiProvider = ({ children }) => children;
    export const createConfig = () => ({});
    export const http = () => ({});
    export const useAccount = () => ({ address: undefined, isConnected: false, status: 'disconnected' });
    export const useBalance = () => ({ data: undefined, isLoading: false, error: null });
    export const useConnect = () => ({ connect: () => {}, connectors: [], status: 'idle', error: null });
    export const useConnectors = () => [];
    export const useConnection = () => ({ address: undefined, isConnected: false, connector: null, status: 'disconnected' });
    export const useDisconnect = () => ({ disconnect: () => {} });
    export const useEnsName = () => ({ data: undefined, isLoading: false });
    export const useSwitchChain = () => ({ switchChain: () => {}, chains: [], status: 'idle', error: null });
    export const useWalletClient = () => ({ data: null, isLoading: false, error: null });
    export const usePublicClient = () => undefined;
    export const useChainId = () => 42161;
    export const useSignMessage = () => ({ signMessage: () => {}, status: 'idle', data: undefined });
    export const useWriteContract = () => ({ writeContract: () => {}, status: 'idle', data: undefined });
    export const useWaitForTransactionReceipt = () => ({ data: undefined, isLoading: false, status: 'idle', error: null });
    export const useReadContract = () => ({ data: undefined, isLoading: false, error: null });
    export const serialize = (x) => JSON.stringify(x);
    export const deserialize = JSON.parse;
    export const cookieToInitialState = () => undefined;
    export const cookieStorage = {};
    export default {};
  `,
  'wagmi/connectors': `
    export const injected = () => ({});
    export const coinbaseWallet = () => ({});
    export const walletConnect = () => ({});
    export const mock = () => ({});
    export default {};
  `,
  '@privy-io/react-auth': `
    import { createElement } from 'react';
    export const PrivyProvider = ({ children }) => children;
    export const usePrivy = () => ({ ready: true, authenticated: false, user: null, login: () => {}, logout: async () => {} });
    export const useLogin = () => ({ login: () => {} });
    export const useLogout = () => ({ logout: async () => {} });
    export const useWallets = () => ({ wallets: [], ready: true });
    export const toViemAccount = async () => null;
    export default {};
  `,
  '@privy-io/wagmi': `
    import { createElement } from 'react';
    export const WagmiProvider = ({ children }) => children;
    export const createConfig = () => ({});
    export const useSetActiveWallet = () => ({ setActiveWallet: async () => {} });
    export default {};
  `,
}

const ssrStubPlugin = {
  name: 'ssr-stub-browser-only-modules',
  enforce: 'pre' as const,
  resolveId(id: string, _: string | undefined, options: { ssr?: boolean } | undefined) {
    if (options?.ssr && id in browserOnlyModules) return `\0virtual:${id}`
  },
  load(id: string) {
    const name = id.replace('\0virtual:', '')
    if (name in browserOnlyModules) return browserOnlyModules[name]
  },
}

function createManualChunks(id: string) {
  if (id.includes('node_modules')) {
    if (id.includes('@radix-ui')) return 'vendor-radix'
    if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-table') || id.includes('@tanstack/react-virtual')) return 'vendor-tanstack'
    if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
    if (id.includes('viem') || id.includes('wagmi') || id.includes('@wagmi') || id.includes('@privy-io')) return 'vendor-web3'
    if (id.includes('klinecharts')) return 'vendor-klinecharts'
  }
}

const config = defineConfig({
  resolve: {
    alias: {
      events: eventsPolyfill,
      'node:events': eventsPolyfill,
    },
  },
  server: {
    strictPort: false,
  },
  build: {
    sourcemap: isAnalyze,
  },
  environments: {
    client: {
      resolve: {
        alias: {
          events: eventsPolyfill,
          'node:events': eventsPolyfill,
        },
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: createManualChunks,
          },
        },
      },
    },
  },
  plugins: [
    nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }),
    ssrStubPlugin,
    nitro({
      compressPublicAssets: true,
      minify: true,
      rollupConfig: {
        output: {
          inlineDynamicImports: true,
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
        },
      },
      routeRules: {
        '/api/faucet/**': {
          proxy: 'https://usdh.com/api/faucet/**',
        },
        '/assets/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
        '/charting_library/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
      },
    }),
    lingui(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      router: {
        autoCodeSplitting: true,
      },
    }),
    viteReact({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro', 'babel-plugin-react-compiler'],
      },
    }),
    isAnalyze &&
      (visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }) as PluginOption),
  ].filter(Boolean),
})

export default config
