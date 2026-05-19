import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist/client");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

const worker = (await import("./dist/server/server.js")).default;

async function tryStatic(pathname) {
  try {
    const filePath = join(CLIENT_DIR, pathname);
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const ext = extname(filePath);
    const headers = {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
    };
    if (pathname.startsWith("/assets/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
    return { data: await readFile(filePath), headers };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = (req.url ?? "/").split("?")[0];

    // Serve static assets directly — CF Workers handles this before the worker;
    // we must intercept it here before passing to the worker fetch handler.
    if (pathname.startsWith("/assets/") || extname(pathname)) {
      const file = await tryStatic(pathname);
      if (file) {
        res.writeHead(200, file.headers);
        res.end(file.data);
        return;
      }
    }

    const url = `http://localhost${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
      else if (v) headers.set(k, v);
    }

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) body = Buffer.concat(chunks);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: body ?? null,
    });

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  }
});

const port = parseInt(process.env.PORT ?? "5000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Basgiath running on http://0.0.0.0:${port}`);
});
