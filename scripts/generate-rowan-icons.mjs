import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Run with sharp installed, or set ROWAN_ICON_NODE_MODULES to a tooling package directory.
const require = createRequire(import.meta.url);
const sharp = process.env.ROWAN_ICON_NODE_MODULES
  ? require(require.resolve("sharp", { paths: [process.env.ROWAN_ICON_NODE_MODULES] }))
  : require("sharp");
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const background =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="maroon" x2=".85" y2="1">
      <stop stop-color="#8c3448"/><stop offset=".5" stop-color="#651d2d"/><stop offset="1" stop-color="#3d111d"/>
    </linearGradient>
    <radialGradient id="light" cx=".2" cy="0" r="1">
      <stop stop-color="#fff4e5" stop-opacity=".2"/><stop offset=".65" stop-color="#fff4e5" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x2="0" y2="1">
      <stop stop-color="#fff4e5" stop-opacity=".32"/><stop offset=".5" stop-color="#fff4e5" stop-opacity=".03"/>
      <stop offset="1" stop-color="#fff4e5" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <path fill="url(#maroon)" d="M0 0h512v512H0z"/>
  <path fill="url(#light)" d="M0 0h512v512H0z"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="url(#rim)" stroke-width="2"/>
</svg>`);
const mark = await sharp(`${publicDir}/rowan-mark.png`).resize(420, 420).toBuffer();
// Keep the entire canvas opaque; iOS applies its own outer corner mask.
const artwork = await sharp(background)
  .composite([{ input: mark, left: 46, top: 46 }])
  .flatten()
  .png()
  .toBuffer();
for (const [filename, size] of [
  ["rowan-favicon-v2.png", 48],
  ["rowan-apple-touch-v2.png", 180],
  ["rowan-icon-192-v2.png", 192],
  ["rowan-icon-512-v2.png", 512],
]) {
  await sharp(artwork).resize(size, size).png().toFile(`${publicDir}/${filename}`);
}
