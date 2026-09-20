import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/app/theme";
import { Sun, Moon } from "lucide-react";

const TOTAL_FRAMES = 240;
const FPS = 24;
const FRAME_DURATION = 1000 / FPS;
const TRANSITION_DURATION_FRAMES = 16; // ~0.65s buttery smooth cinematic dissolve

const pad4 = (num: number) => num.toString().padStart(4, "0");

export function CinematicFrameHero() {
  const { theme, setTheme } = useTheme();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Frame image caches
  const lightFramesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const darkFramesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));

  // Current visual mode
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(
    theme === "dark" ? "dark" : "light",
  );

  // Animation & transition refs
  const currentFrameRef = useRef<number>(0);
  const activeModeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");
  const targetModeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");
  const isTransitioningRef = useRef<boolean>(false);
  const transitionProgressRef = useRef<number>(0); // 0 to 1
  const fromModeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");
  const toModeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");

  const lastFrameTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Progressive high-efficiency frame preloader
  useEffect(() => {
    let isCancelled = false;

    const loadSingleFrame = (mode: "light" | "dark", index: number): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = `/frames/${mode}/frame_${pad4(index + 1)}.webp`;
        img.decoding = "async";
        img.onload = () => {
          if (mode === "light") {
            lightFramesRef.current[index] = img;
          } else {
            darkFramesRef.current[index] = img;
          }
          resolve(img);
        };
        img.onerror = () => resolve(img);
      });
    };

    // Priority load first 32 frames for instant playback
    const priorityPromises: Promise<HTMLImageElement>[] = [];
    for (let i = 0; i < 32; i++) {
      priorityPromises.push(loadSingleFrame("light", i));
      priorityPromises.push(loadSingleFrame("dark", i));
    }

    Promise.all(priorityPromises).then(() => {
      if (isCancelled) return;
      // Load remaining frames in batches of 24
      let nextIndex = 32;
      const batchSize = 24;

      const loadNextBatch = () => {
        if (isCancelled || nextIndex >= TOTAL_FRAMES) return;
        const batchPromises: Promise<HTMLImageElement>[] = [];
        const limit = Math.min(TOTAL_FRAMES, nextIndex + batchSize);
        for (let i = nextIndex; i < limit; i++) {
          batchPromises.push(loadSingleFrame("light", i));
          batchPromises.push(loadSingleFrame("dark", i));
        }
        nextIndex = limit;
        Promise.all(batchPromises).then(() => {
          if (!isCancelled && nextIndex < TOTAL_FRAMES) {
            setTimeout(loadNextBatch, 20);
          }
        });
      };

      setTimeout(loadNextBatch, 40);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Instant seamless lighting transition trigger
  const handleToggle = () => {
    const newTarget = activeModeRef.current === "light" ? "dark" : "light";

    if (isTransitioningRef.current) {
      // If clicked during an active transition, seamlessly reverse from current progress
      fromModeRef.current = toModeRef.current;
      toModeRef.current = newTarget;
      transitionProgressRef.current = 1 - transitionProgressRef.current;
    } else {
      fromModeRef.current = activeModeRef.current;
      toModeRef.current = newTarget;
      transitionProgressRef.current = 0;
      isTransitioningRef.current = true;
    }

    targetModeRef.current = newTarget;
    setCurrentTheme(newTarget);
    setTheme(newTarget);
  };

  // Main Canvas Rendering Loop with Real-Time Synchronized Dissolve
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const render = (time: number) => {
      rafIdRef.current = requestAnimationFrame(render);

      const elapsed = time - lastFrameTimeRef.current;
      if (elapsed < FRAME_DURATION) return;

      lastFrameTimeRef.current = time - (elapsed % FRAME_DURATION);

      // Advance frame index in continuous loop
      const idx = currentFrameRef.current;
      currentFrameRef.current = (idx + 1) % TOTAL_FRAMES;

      // Advance transition blend progress if transitioning
      if (isTransitioningRef.current) {
        transitionProgressRef.current += 1 / TRANSITION_DURATION_FRAMES;
        if (transitionProgressRef.current >= 1) {
          transitionProgressRef.current = 1;
          isTransitioningRef.current = false;
          activeModeRef.current = toModeRef.current;
        }
      }

      // Determine frames to draw
      const isBlending = isTransitioningRef.current;
      const currentMode = activeModeRef.current;
      const fromMode = fromModeRef.current;
      const toMode = toModeRef.current;

      const baseFrames = isBlending
        ? fromMode === "light"
          ? lightFramesRef.current
          : darkFramesRef.current
        : currentMode === "light"
          ? lightFramesRef.current
          : darkFramesRef.current;

      const blendFrames = toMode === "light" ? lightFramesRef.current : darkFramesRef.current;

      const baseImg = baseFrames[idx];
      const blendImg = blendFrames[idx];

      if (baseImg && baseImg.complete && baseImg.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;

        if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
          canvas.width = displayWidth * dpr;
          canvas.height = displayHeight * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // Aspect ratio cover geometry (1920x1080 native 16:9)
        const srcAspect = 1920 / 1080;
        const canvasAspect = displayWidth / displayHeight;

        let drawWidth: number;
        let drawHeight: number;
        let drawX: number;
        let drawY: number;

        if (canvasAspect > srcAspect) {
          drawWidth = displayWidth;
          drawHeight = displayWidth / srcAspect;
          drawX = 0;
          drawY = (displayHeight - drawHeight) / 2;
        } else {
          drawHeight = displayHeight;
          drawWidth = displayHeight * srcAspect;
          drawX = (displayWidth - drawWidth) / 2;
          drawY = 0;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw base frame
        ctx.globalAlpha = 1;
        ctx.drawImage(baseImg, drawX, drawY, drawWidth, drawHeight);

        // If transitioning, draw incoming mode frame at matching index with smooth alpha dissolve
        if (isBlending && blendImg && blendImg.complete && blendImg.naturalWidth > 0) {
          const t = transitionProgressRef.current;
          // Smooth Hermite interpolation (smoothstep) for organic lighting fade: 3t^2 - 2t^3
          const alpha = t * t * (3 - 2 * t);
          ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
          ctx.drawImage(blendImg, drawX, drawY, drawWidth, drawHeight);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }
    };

    rafIdRef.current = requestAnimationFrame(render);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen min-h-[100dvh] overflow-hidden bg-black select-none"
    >
      {/* ── IMMERSIVE FULLSCREEN 1080P CANVAS ── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover block" />

      {/* ── MINIMAL FLOATING LIGHT / DARK TOGGLE ── */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleToggle}
          title={currentTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme mode"
          className="group relative flex items-center justify-center h-12 w-12 rounded-full backdrop-blur-2xl bg-black/40 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-black/60 active:scale-95 cursor-pointer"
        >
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute inset-0 rounded-full transition-opacity duration-500 blur-md ${
              currentTheme === "dark"
                ? "bg-cyan-500/25 group-hover:bg-cyan-500/40"
                : "bg-amber-400/25 group-hover:bg-amber-400/40"
            }`}
          />

          {/* Minimal Icon with Smooth Rotation */}
          <div className="relative z-10 transition-transform duration-500 group-hover:rotate-45">
            {currentTheme === "dark" ? (
              <Moon className="h-5 w-5 text-cyan-300 transition-colors drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
            ) : (
              <Sun className="h-5 w-5 text-amber-400 transition-colors drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
          </div>
        </button>
      </div>

      {/* ── MINIMAL SUBTLE BOTTOM SCROLL INDICATOR ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          onClick={() => {
            const el = document.getElementById("dice-scroll-screen");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer text-white/80"
          aria-label="Scroll to dice section"
        >
          <span className="text-[9px] font-mono tracking-widest uppercase">Scroll</span>
          <div className="h-6 w-3.5 rounded-full border border-white/40 flex items-start justify-center p-0.5">
            <div className="h-1.5 w-1 rounded-full bg-white animate-bounce" />
          </div>
        </button>
      </div>
    </div>
  );
}
