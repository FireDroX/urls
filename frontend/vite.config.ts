import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const DEV_PORT = 5174;
const DEFAULT_API_PROXY_TARGET = "http://localhost:3001";
const PUBLIC_LINK_ERROR_STATUSES = [404, 410];

function publicLinkProxy(target: string): { plugin: Plugin; proxy: ProxyOptions } {
  let devServer: ViteDevServer | undefined;

  async function appShell(url: string): Promise<string> {
    const server = devServer!;
    const template = await readFile(resolve(server.config.root, "index.html"), "utf8");
    return server.transformIndexHtml(url, template);
  }

  return {
    plugin: {
      name: "public-link-proxy",
      configureServer(server) {
        devServer = server;
      },
    },
    proxy: {
      target,
      selfHandleResponse: true,
      configure(proxy) {
        proxy.on("proxyRes", (proxyRes, req, res) => {
          const status = proxyRes.statusCode ?? 502;
          if (!devServer || !PUBLIC_LINK_ERROR_STATUSES.includes(status)) {
            res.writeHead(status, proxyRes.headers);
            proxyRes.pipe(res);
            return;
          }
          proxyRes.resume();
          void appShell(req.url ?? "/").then((html) => {
            res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            res.end(html);
          });
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = env.VITE_API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET;
  const links = publicLinkProxy(apiTarget);
  return {
    plugins: [react(), tailwindcss(), links.plugin],
    server: {
      port: DEV_PORT,
      strictPort: true,
      proxy: {
        "/api": apiTarget,
        "/r/": links.proxy,
      },
    },
  };
});
