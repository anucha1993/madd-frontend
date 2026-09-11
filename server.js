/**
 * Custom Node.js entry point for deploying this Next.js app on Plesk.
 *
 * Plesk's Node.js hosting runs a single JS file (the "Application Startup File")
 * and expects it to start an HTTP server listening on process.env.PORT — Next.js's
 * own `next start` CLI doesn't fit that model directly, so this wraps the Next.js
 * request handler in a plain http server instead.
 *
 * Plesk setup:
 *   1. Run `npm install` and `npm run build` in this app's directory (via Plesk's
 *      "NPM install" button / Node.js extension, or manually over SSH).
 *   2. In the Plesk Node.js settings for this domain, set:
 *        - Application Root: this folder (madd-frontend)
 *        - Application Startup File: server.js
 *        - Application Mode: production
 *   3. Restart the app from the Plesk Node.js panel.
 */

const { createServer } = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
// Plesk assigns the port to listen on via process.env.PORT — do not hardcode it.
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    // Use the WHATWG URL API instead of the legacy/deprecated `url.parse()` (Node flags it
    // as having unstandardized, security-sensitive parsing behavior).
    const parsedUrl = new URL(req.url, `http://${req.headers.host || hostname}`);
    handle(req, res, {
      pathname: parsedUrl.pathname,
      query: Object.fromEntries(parsedUrl.searchParams),
    });
  }).listen(port, hostname, () => {
    console.log(`> madd-frontend ready on http://${hostname}:${port} (env: ${dev ? "development" : "production"})`);
  });
});
