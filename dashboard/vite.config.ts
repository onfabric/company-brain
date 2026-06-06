/// <reference types="node" />

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

const BRAIN_API_PROXY_PATHS = [
  '/data-sources',
  '/health',
  '/knowledge',
  '/knowledge-types',
  '/people',
  '/records',
  '/sessions',
  '/openapi',
] as const;

const brainApiOrigin = apiOriginFrom(process.env.BRAIN_API_ORIGIN);
const brainApiProxy = brainApiOrigin ? apiProxyConfig(brainApiOrigin) : undefined;

export default defineConfig({
  base: '/dashboard/',
  resolve: { tsconfigPaths: true },
  plugins: [tanstackRouter({ target: 'react' }), viteReact(), tailwindcss()],
  server: brainApiProxy ? { proxy: brainApiProxy } : undefined,
});

function apiOriginFrom(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return new URL(trimmed).origin;
}

function apiProxyConfig(target: string) {
  return Object.fromEntries(
    BRAIN_API_PROXY_PATHS.map((path) => [
      path,
      {
        target,
        changeOrigin: true,
        secure: true,
        configure(proxy) {
          proxy.on('proxyRes', (proxyResponse) => {
            const cookies = proxyResponse.headers['set-cookie'];
            if (Array.isArray(cookies)) {
              proxyResponse.headers['set-cookie'] = cookies.map(allowLocalSessionCookie);
            }
          });
        },
      } satisfies ProxyOptions,
    ]),
  );
}

function allowLocalSessionCookie(cookie: string) {
  return cookie.replace(/;\s*Secure/giu, '');
}
