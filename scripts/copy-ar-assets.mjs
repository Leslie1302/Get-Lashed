// Self-host the MediaPipe runtime and models under /public/mediapipe.
// Runs on postinstall. Rationale: a CDN fetch at try-on time adds a third-party
// origin to the CSP, a second DNS lookup on a mobile connection, and an outage
// we don't control. Serving from our own origin also lets Vercel's CDN cache it.
//
// The .wasm ships inside the npm package; the .task models don't, so they are
// downloaded once and then cached by the file's presence.
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "mediapipe");
const wasmSource = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const MODELS = [
  {
    file: "hand_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  },
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
];

async function exists(path) {
  return stat(path).then(
    () => true,
    () => false
  );
}

async function main() {
  if (!(await exists(wasmSource))) {
    console.warn("[ar-assets] @mediapipe/tasks-vision not installed — skipping");
    return;
  }
  // Only the two builds FilesetResolver actually loads: the SIMD one, and the
  // nosimd fallback for older devices. The package also ships an ES-module
  // variant we never ask for — copying it adds ~11 MB to every deploy.
  await mkdir(join(target, "wasm"), { recursive: true });
  await cp(wasmSource, join(target, "wasm"), {
    recursive: true,
    filter: (src) =>
      !src.includes("module_internal") && !src.endsWith(".map"),
  });

  const missing = [];
  for (const model of MODELS) {
    const path = join(target, model.file);
    if (await exists(path)) continue;
    try {
      const res = await fetch(model.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
      console.log(`[ar-assets] downloaded ${model.file}`);
    } catch (error) {
      // Never fail the install: the site works without /try-on, and the page
      // reports the missing model rather than the build breaking. But say so
      // loudly and give the exact command — a quiet warning here turns into a
      // confusing failure on the try-on page much later.
      missing.push(model);
      console.warn(`[ar-assets] could not fetch ${model.file}: ${error.message}`);
    }
  }

  if (missing.length) {
    const dir = join("public", "mediapipe");
    console.warn(
      [
        "",
        "  ┌─ AR models not downloaded ─────────────────────────────────────",
        "  │  /try-on will refuse to start until these exist. Everything",
        "  │  else works. To fetch them by hand, from the project root:",
        "  │",
        ...missing.map((m) => `  │    curl -L -o ${join(dir, m.file)} \\\n  │      ${m.url}`),
        "  └────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  }
}

await main();
