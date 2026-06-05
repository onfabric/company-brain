import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

const API_PROXY_PATHS = ['/data-sources', '/people', '/records'] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const brainApiBaseUrl = env.BRAIN_API_BASE_URL || env.VITE_BRAIN_API_BASE_URL;

  return {
    base: '/dashboard/',
    resolve: { tsconfigPaths: true },
    server: brainApiBaseUrl
      ? {
          proxy: Object.fromEntries(
            API_PROXY_PATHS.map((path) => [
              path,
              {
                target: brainApiBaseUrl,
                changeOrigin: true,
                secure: true,
              } satisfies ProxyOptions,
            ]),
          ),
        }
      : undefined,
    plugins: [tanstackRouter({ target: 'react' }), viteReact(), tailwindcss()],
  };
});
