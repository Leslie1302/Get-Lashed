"use client";

import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LASH_DESIGNS,
  nailServiceId,
  NAIL_DESIGNS,
  paintNail,
  swatchStyle,
  type LashDesign,
  type NailDesign,
} from "@/lib/designs";
import {
  FINGERS,
  NAIL_LENGTHS,
  NAIL_SHAPES,
  handKey,
  nailQuad,
  smoothPoints,
  type NailLength,
  type NailShape,
  type Point,
} from "@/lib/ar-geometry";

type Mode = "nails" | "lashes";
type Phase = "idle" | "loading" | "live" | "error";

const EYE_OUTLINES = [
  [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
];

interface Landmarker {
  close(): void;
  detectForVideo(video: HTMLVideoElement, timestamp: number): unknown;
}

/** A failure we diagnosed ourselves; its message is already fit to show. */
class StartError extends Error {}

/**
 * Turn a start-up failure into something that says what to actually do about
 * it. A generic "your browser may not support it" is worse than useless — it
 * misattributes a missing file, a denied permission and a busy camera all to
 * the one cause that isn't fixable.
 */
function describeStartFailure(error: unknown): string {
  if (error instanceof StartError) return error.message;

  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Camera permission was declined. Allow camera access for this site, then tap Start again.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No camera was found on this device.";
      case "NotReadableError":
        return "The camera is already in use by another app. Close it and tap Start again.";
    }
  }

  const detail = error instanceof Error ? error.message : String(error);
  return `Couldn't start the try-on: ${detail}. Booking still works normally.`;
}

/**
 * Everything a frame needs. Passing it explicitly keeps the drawing code at
 * module scope — React treats functions declared during render as render-phase
 * code, and this lot reads refs, mutates a cache and calls performance.now().
 */
interface Scene {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement | null;
  landmarker: Landmarker | null;
  smoothed: Map<string, Point[]>;
  nailCanvas: HTMLCanvasElement | null;
  shape: NailShape;
  length: NailLength;
  lash: LashDesign;
  now: () => number;
}

function draw(activeMode: Mode, scene: Scene) {
  const { video, canvas, landmarker } = scene;
  if (!video || !canvas || !landmarker) return;

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const result = landmarker.detectForVideo(video, scene.now()) as {
    landmarks?: { x: number; y: number }[][];
    handedness?: { categoryName?: string }[][];
    faceLandmarks?: { x: number; y: number }[][];
  };

  if (activeMode === "nails") {
    (result.landmarks ?? []).forEach((hand, index) => {
      const key = handKey(result.handedness?.[index]?.[0]?.categoryName, index);
      drawNails(ctx, hand.map((p): Point => [p.x * w, p.y * h]), key, h, scene);
    });
  } else {
    (result.faceLandmarks ?? []).forEach((face) => {
      const points = face.map((p): Point => [p.x * w, p.y * h]);
      EYE_OUTLINES.forEach((outline, eyeIndex) => {
        drawLashes(ctx, outline.map((i) => points[i]).filter(Boolean), eyeIndex, h, scene);
      });
    });
  }
}

function drawNails(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  hand: string,
  frameHeight: number,
  scene: Scene
) {
  const design = scene.nailCanvas;
  if (!design) return;

  for (let finger = 0; finger < FINGERS.length; finger++) {
    const raw = nailQuad(points, finger, scene.length.extend);
    if (!raw) continue;

    // Keyed by hand identity, not array position: MediaPipe does not keep the
    // order of `landmarks` stable, so an index key makes two hands swap
    // filters mid-motion and lurch.
    const key = `${hand}:${finger}`;
    const quad = smoothPoints(scene.smoothed.get(key), raw, frameHeight);
    scene.smoothed.set(key, quad);

    ctx.save();
    nailPath(ctx, quad, scene.shape);
    ctx.clip();

    // Affine-warp the design square onto the quad. Canvas 2D has no
    // perspective transform, and a nail is small enough that affine reads fine.
    // nailQuad guarantees a parallelogram, which is what makes this exact.
    const s = design.width;
    ctx.transform(
      (quad[3][0] - quad[0][0]) / s,
      (quad[3][1] - quad[0][1]) / s,
      (quad[1][0] - quad[0][0]) / s,
      (quad[1][1] - quad[0][1]) / s,
      quad[0][0],
      quad[0][1]
    );
    ctx.drawImage(design, 0, 0);
    ctx.restore();
  }
}

/** How far the cuticle line bows back into the nail. Same for every shape. */
const CUTICLE_CURVE = 0.06;

/**
 * The nail outline over the quad [base-left, tip-left, tip-right, base-right],
 * shaped by the chosen `NailShape`.
 *
 * The curves are deliberately shallow. An early attempt bowed the free edge
 * 28% of the nail's length outward and cut the cuticle 14% inward, which on a
 * roughly square quad produced a leaf, not a nail — it read as a rotated
 * diamond floating past the fingertip.
 */
function nailPath(ctx: CanvasRenderingContext2D, quad: Point[], shape: NailShape) {
  const [baseL, tipL, tipR, baseR] = quad;
  // Half the width, as a vector across the nail.
  const mx = (tipR[0] - tipL[0]) / 2;
  const my = (tipR[1] - tipL[1]) / 2;
  // The nail's long axis, base to tip.
  const lx = tipL[0] - baseL[0];
  const ly = tipL[1] - baseL[1];

  // Taper pulls the free edge corners inward, turning the outline into a
  // trapezoid — that's what separates an almond from a square.
  const t = shape.taper;
  const edgeL: Point = [tipL[0] + mx * t, tipL[1] + my * t];
  const edgeR: Point = [tipR[0] - mx * t, tipR[1] - my * t];
  // What's left of the half-width at the tip, for the free-edge control point.
  const tipHalfX = mx * (1 - t);
  const tipHalfY = my * (1 - t);

  ctx.beginPath();
  ctx.moveTo(baseL[0], baseL[1]);
  // Left sidewall.
  ctx.quadraticCurveTo(
    baseL[0] + lx * 0.5 - mx * shape.sideCurve,
    baseL[1] + ly * 0.5 - my * shape.sideCurve,
    edgeL[0],
    edgeL[1]
  );
  // Free edge: flat for square and coffin, rounded or pointed as tipCurve rises.
  ctx.quadraticCurveTo(
    edgeL[0] + tipHalfX + lx * shape.tipCurve,
    edgeL[1] + tipHalfY + ly * shape.tipCurve,
    edgeR[0],
    edgeR[1]
  );
  // Right sidewall.
  ctx.quadraticCurveTo(
    baseR[0] + lx * 0.5 + mx * shape.sideCurve,
    baseR[1] + ly * 0.5 + my * shape.sideCurve,
    baseR[0],
    baseR[1]
  );
  // Cuticle, bowing gently back into the nail.
  ctx.quadraticCurveTo(
    baseR[0] - mx + lx * CUTICLE_CURVE,
    baseR[1] - my + ly * CUTICLE_CURVE,
    baseL[0],
    baseL[1]
  );
  ctx.closePath();
}

function drawLashes(
  ctx: CanvasRenderingContext2D,
  outline: Point[],
  eyeIndex: number,
  frameHeight: number,
  scene: Scene
) {
  if (outline.length < 6) return;

  const key = `eye:${eyeIndex}`;
  const points = smoothPoints(scene.smoothed.get(key), outline, frameHeight);
  scene.smoothed.set(key, points);

  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= points.length;
  cy /= points.length;

  const upper = points.filter((p) => p[1] < cy).sort((a, b) => a[0] - b[0]);
  if (upper.length < 3) return;

  const xs = points.map((p) => p[0]);
  const eyeWidth = Math.max(...xs) - Math.min(...xs);
  if (eyeWidth < 16) return; // face too small or turned away

  const lash = scene.lash;
  const lashLength = Math.max(4, eyeWidth * 0.1 * lash.flair);
  const n = upper.length;

  const outer = upper.map((p, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const taper = Math.min(t, 1 - t) * 2; // 0 at the corners, 1 mid-eye
    const d = Math.hypot(p[0] - cx, p[1] - cy) || 1;
    const push = lashLength * (0.3 + 0.7 * taper);
    return [p[0] + ((p[0] - cx) / d) * push, p[1] + ((p[1] - cy) / d) * push] as Point;
  });

  ctx.beginPath();
  ctx.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(outer[i][0], outer[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(upper[i][0], upper[i][1]);
  ctx.closePath();
  ctx.fillStyle = lash.color;
  ctx.fill();
}

export default function TryOn() {
  const [mode, setMode] = useState<Mode>("nails");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [nail, setNail] = useState<NailDesign>(NAIL_DESIGNS[0]);
  const [lash, setLash] = useState<LashDesign>(LASH_DESIGNS[1]);
  const [shape, setShape] = useState<NailShape>(NAIL_SHAPES[1]);
  const [nailLength, setNailLength] = useState<NailLength>(NAIL_LENGTHS[0]);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const runningRef = useRef(false);

  // One mutable Scene the frame loop reads, so changing a colour mid-session
  // doesn't tear down the camera. Written from effects, never during render.
  const sceneRef = useRef<Scene>({
    video: null,
    canvas: null,
    landmarker: null,
    smoothed: new Map<string, Point[]>(),
    nailCanvas: null,
    shape: NAIL_SHAPES[1],
    length: NAIL_LENGTHS[0],
    lash: LASH_DESIGNS[1],
    now: () => performance.now(),
  });

  // Painting a finish now waits on an image for the patterned ones. The frame
  // loop keeps drawing the previous swatch until the new one is ready, so a
  // slow load shows the old colour rather than bare fingers.
  useEffect(() => {
    let cancelled = false;
    paintNail(nail)
      .then((canvas) => {
        if (!cancelled) sceneRef.current.nailCanvas = canvas;
      })
      .catch((error: unknown) => {
        console.error("[try-on]", error);
        if (!cancelled) setMessage("That design's image didn't load. Pick another one.");
      });
    return () => {
      cancelled = true;
    };
  }, [nail]);

  useEffect(() => {
    sceneRef.current.lash = lash;
  }, [lash]);

  // Shape and length only change the outline, so they take effect on the next
  // frame with no camera restart.
  useEffect(() => {
    sceneRef.current.shape = shape;
  }, [shape]);

  useEffect(() => {
    sceneRef.current.length = nailLength;
  }, [nailLength]);

  const stop = useCallback(() => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    sceneRef.current.landmarker = null;
    sceneRef.current.smoothed.clear();
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setPhase("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (wanted: Mode) => {
      setPhase("loading");
      setMessage(null);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new StartError(
            "The camera needs a secure connection. Open this page over https, or on localhost."
          );
        }

        const model =
          wanted === "nails"
            ? "/mediapipe/hand_landmarker.task"
            : "/mediapipe/face_landmarker.task";

        // Preflight the model. Without this a missing file surfaces as an
        // opaque WASM abort, because MediaPipe tries to parse Next's 404 page
        // as a model — which reads like "your browser is unsupported" and
        // sends you looking in entirely the wrong place.
        const check = await fetch(model, { method: "HEAD" });
        if (!check.ok) {
          throw new StartError(
            `The AR model file is missing (${model}). Run "npm install" to download it, then reload.`
          );
        }

        // ~10 MB of WASM plus a model. Imported here, never at page load, so a
        // visitor on mobile data only pays for it after tapping Start.
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");

        landmarkerRef.current =
          wanted === "nails"
            ? await vision.HandLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: model, delegate: "GPU" },
                runningMode: "VIDEO",
                numHands: 2,
              })
            : await vision.FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: model, delegate: "GPU" },
                runningMode: "VIDEO",
                numFaces: 1,
              });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: wanted === "nails" ? facing : "user" },
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const scene = sceneRef.current;
        scene.video = video;
        scene.canvas = canvasRef.current;
        scene.landmarker = landmarkerRef.current;
        scene.smoothed.clear();

        runningRef.current = true;
        setPhase("live");

        const frame = () => {
          if (!runningRef.current) return;
          draw(wanted, scene);
          video.requestVideoFrameCallback(frame);
        };
        video.requestVideoFrameCallback(frame);
      } catch (error) {
        console.error("[try-on]", error);
        stop();
        setPhase("error");
        setMessage(describeStartFailure(error));
      }
    },
    [facing, stop]
  );

  function switchMode(next: Mode) {
    if (next === mode) return;
    stop();
    setMode(next);
  }

  const live = phase === "live";
  // Lashes always use the front camera; nails only when flipped to it.
  const selfie = mode === "lashes" || facing === "user";

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Try-on mode">
        {(["nails", "lashes"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`h-11 rounded-full px-6 text-sm font-semibold capitalize ${
              mode === m ? "bg-espresso text-paper" : "border border-sand text-cocoa"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* The front camera is mirrored, the way a mirror is — an unflipped
          selfie feed makes people move the wrong way when lining their face
          up. The overlay canvas is flipped with it so the two stay registered;
          the landmark maths never sees the flip. */}
      <div
        className={`relative mt-6 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-espresso sm:aspect-video ${
          selfie ? "[&>video]:-scale-x-100 [&>canvas]:-scale-x-100" : ""
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${live ? "" : "opacity-0"}`}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

        {!live && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="max-w-sm">
              {phase === "loading" ? (
                <>
                  <p className="font-display text-xl font-medium text-paper">Loading the camera…</p>
                  <p className="mt-2 text-sm text-paper/70">
                    First load fetches about 10 MB. It&rsquo;s cached after this.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-medium text-paper">
                    See {mode === "nails" ? "a set on your own hand" : "lashes on your own eyes"}
                  </p>
                  <p className="mt-2 text-sm text-paper/70">
                    Uses your camera in the browser. Nothing is recorded, uploaded or sent
                    anywhere. Starting downloads about 10 MB, so Wi-Fi is kinder to your data.
                  </p>
                  {message && (
                    <p role="alert" className="mt-3 text-sm text-blush">
                      {message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => start(mode)}
                    className="mt-5 h-12 rounded-md bg-terracotta px-8 font-semibold text-paper hover:bg-clay"
                  >
                    Start camera
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {live && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {mode === "nails" && (
              <button
                type="button"
                onClick={() => {
                  const next = facing === "environment" ? "user" : "environment";
                  setFacing(next);
                  stop();
                  setTimeout(() => start(mode), 0);
                }}
                className="h-11 rounded-full bg-paper/90 px-5 text-sm font-semibold"
              >
                Flip camera
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="h-11 rounded-full bg-paper/90 px-5 text-sm font-semibold"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* While the camera is live the overlay panel is hidden, so a failure
          after start-up (a design image that won't load) needs its own place
          to appear or it fails silently. */}
      {live && message && (
        <p role="alert" className="mt-3 rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {message}
        </p>
      )}

      {mode === "nails" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Choices
            label="Shape"
            options={NAIL_SHAPES}
            selectedId={shape.id}
            onSelect={setShape}
          />
          <Choices
            label="Length"
            options={NAIL_LENGTHS}
            selectedId={nailLength.id}
            onSelect={setNailLength}
            hint="Anything past Natural is an extension set."
          />
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm font-semibold text-cocoa">
          {mode === "nails" ? "Design" : "Lash style"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mode === "nails"
            ? NAIL_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setNail(d)}
                  aria-pressed={nail.id === d.id}
                  className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                    nail.id === d.id ? "border-terracotta bg-linen" : "border-sand"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={swatchStyle(d)}
                  />
                  {d.name}
                  {d.extra && (
                    <span className="text-xs font-normal text-mocha">+GH₵20–30</span>
                  )}
                </button>
              ))
            : LASH_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setLash(d)}
                  aria-pressed={lash.id === d.id}
                  className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                    lash.id === d.id ? "border-terracotta bg-linen" : "border-sand"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ background: d.color }}
                  />
                  {d.name}
                </button>
              ))}
        </div>

        {/* The whole point of the try-on. Deep-links to /book with the matching
            service already selected, so the look someone just liked is one tap
            from being the thing they book. */}
        <BookThisLook
          href={`/book?service=${
            mode === "nails" ? nailServiceId(nailLength.id) : lash.serviceId
          }`}
          what={
            mode === "nails"
              ? `${nailLength.name === "Natural" ? "BIAB on natural nails" : `${nailLength.name.toLowerCase()} ${shape.name.toLowerCase()} set`} in ${nail.name}`
              : `${lash.name} lashes`
          }
        />
      </div>
    </div>
  );
}

function BookThisLook({ href, what }: { href: string; what: string }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-sand bg-linen/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-cocoa">
        Liking <span className="font-semibold text-espresso">{what}</span>?
      </p>
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-terracotta px-6 text-sm font-semibold text-paper hover:bg-clay"
      >
        Book this look
      </Link>
    </div>
  );
}

/** A labelled row of single-choice pills — used for nail shape and length. */
function Choices<T extends { id: string; name: string }>({
  label,
  options,
  selectedId,
  onSelect,
  hint,
}: {
  label: string;
  options: readonly T[];
  selectedId: string;
  onSelect: (option: T) => void;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-cocoa">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            aria-pressed={selectedId === option.id}
            className={`h-10 rounded-full border px-4 text-sm font-semibold ${
              selectedId === option.id
                ? "border-terracotta bg-linen text-terracotta"
                : "border-sand text-cocoa hover:border-mocha"
            }`}
          >
            {option.name}
          </button>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-mocha">{hint}</p>}
    </div>
  );
}
