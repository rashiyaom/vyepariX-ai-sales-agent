import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "@/components/app/theme";
import { Sun, Moon } from "lucide-react";

const TOTAL_FRAMES = 240;
const FPS = 24;
const FRAME_DURATION = 1000 / FPS; // ~41.67ms
const TRANSITION_DURATION_FRAMES = 16; // ~660ms smoothstep dissolve
const NATIVE_WIDTH = 2560;
const NATIVE_HEIGHT = 1440;

type FrameImage = ImageBitmap | HTMLImageElement;

export function CinematicFrameHero() {
  const { theme, setTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active theme state with instant client storage fallback
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vyaperi_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (document.documentElement.classList.contains("dark")) return "dark";
    }
    return theme === "dark" ? "dark" : "light";
  });

  // Preloader State with Real Percentage
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("initializing frame sequence...");

  // Frame Cache Refs
  const darkFramesRef = useRef<(FrameImage | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const lightFramesRef = useRef<(FrameImage | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const lastValidBaseRef = useRef<FrameImage | null>(null);
  const lastValidBlendRef = useRef<FrameImage | null>(null);

  // Playback & Transition State Refs
  const frameIdxRef = useRef(0);
  const activeModeRef = useRef<"light" | "dark">(currentTheme);
  const fromModeRef = useRef<"light" | "dark">(currentTheme);
  const toModeRef = useRef<"light" | "dark">(currentTheme);
  const isTransitioningRef = useRef(false);
  const transitionProgressRef = useRef(0);
  const isCancelledRef = useRef(false);

  // Sync external theme changes
  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      setCurrentTheme(theme);
    }
  }, [theme]);

  // Load a single frame (using createImageBitmap on background thread for sub-millisecond GPU draw)
  const loadSingleFrame = useCallback(
    async (mode: "dark" | "light", index: number): Promise<FrameImage | null> => {
      const pad = String(index).padStart(4, "0");
      const url = `/frames/${mode}/frame_${pad}.webp`;
      try {
        if (typeof window !== "undefined" && "createImageBitmap" in window) {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return await createImageBitmap(blob);
        } else {
          return new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
          });
        }
      } catch {
        return null;
      }
    },
    []
  );

  // Concurrent Worker Pool Loader
  const loadModeFrames = useCallback(
    async (
      mode: "dark" | "light",
      concurrency: number,
      onProgress?: (loadedCount: number, total: number) => void
    ) => {
      const targetArray = mode === "dark" ? darkFramesRef.current : lightFramesRef.current;
      let nextIndex = 1;
      let completedCount = 0;

      return new Promise<void>((resolve) => {
        const runWorker = async () => {
          while (!isCancelledRef.current && nextIndex <= TOTAL_FRAMES) {
            const currentIdx = nextIndex++;
            const frame = await loadSingleFrame(mode, currentIdx);
            if (isCancelledRef.current) return;

            if (frame) {
              targetArray[currentIdx - 1] = frame;
            }
            completedCount++;
            onProgress?.(completedCount, TOTAL_FRAMES);
          }
        };

        const workers: Promise<void>[] = [];
        const poolSize = Math.min(concurrency, TOTAL_FRAMES);
        for (let i = 0; i < poolSize; i++) {
          workers.push(runWorker());
        }

        Promise.all(workers).then(() => resolve());
      });
    },
    [loadSingleFrame]
  );

  // Dynamic status text calculator based on real download progress
  const getStatusMessage = (pct: number) => {
    if (pct < 20) return "fetching high-resolution frame sequence...";
    if (pct < 50) return "decoding 2k retina textures in gpu memory...";
    if (pct < 80) return "calibrating lighting crossfade matrix...";
    if (pct < 100) return "synchronizing 24fps autonomous canvas...";
    return "system operational · ready";
  };

  // Preloading Orchestrator: Active Theme First, then Background Alternate
  useEffect(() => {
    isCancelledRef.current = false;
    const initialMode = currentTheme;
    activeModeRef.current = initialMode;
    fromModeRef.current = initialMode;
    toModeRef.current = initialMode;

    const runPreloader = async () => {
      // 1. High-concurrency load of active theme (240 frames)
      await loadModeFrames(initialMode, 10, (loaded, total) => {
        if (isCancelledRef.current) return;
        const pct = Math.min(100, Math.round((loaded / total) * 100));
        setProgress(pct);
        setStatusText(getStatusMessage(pct));
      });

      if (isCancelledRef.current) return;

      // 2. Active theme 100% ready — trigger graceful exit transition
      setProgress(100);
      setStatusText("system operational · ready");

      const exitTimer = setTimeout(() => {
        setIsExiting(true);
        const removeTimer = setTimeout(() => {
          setIsLoading(false);
        }, 650);
        return () => clearTimeout(removeTimer);
      }, 350);

      // 3. Lazily background-load the alternate theme at lower concurrency
      const alternateMode = initialMode === "dark" ? "light" : "dark";
      const idleTimer = setTimeout(() => {
        if (!isCancelledRef.current) {
          loadModeFrames(alternateMode, 4);
        }
      }, 1000);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(idleTimer);
      };
    };

    runPreloader();

    return () => {
      isCancelledRef.current = true;
    };
  }, [currentTheme, loadModeFrames]);

  // Main Canvas Rendering Loop with Real-Time Smoothstep Lighting Dissolve
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let lastRenderTime = performance.now();
    let rafId: number;

    const render = (time: number) => {
      rafId = requestAnimationFrame(render);

      const elapsed = time - lastRenderTime;
      if (elapsed < FRAME_DURATION) return;

      lastRenderTime = time - (elapsed % FRAME_DURATION);

      // Advance frame index in continuous loop
      frameIdxRef.current = (frameIdxRef.current + 1) % TOTAL_FRAMES;
      const idx = frameIdxRef.current;

      // Advance lighting crossfade transition
      if (isTransitioningRef.current) {
        transitionProgressRef.current += 1 / TRANSITION_DURATION_FRAMES;
        if (transitionProgressRef.current >= 1) {
          transitionProgressRef.current = 1;
          isTransitioningRef.current = false;
          activeModeRef.current = toModeRef.current;
        }
      }

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

      // Resilient frame fallback: if this frame isn't ready yet, hold the last valid frame
      let baseImg = baseFrames[idx];
      if (baseImg) {
        lastValidBaseRef.current = baseImg;
      } else {
        baseImg = lastValidBaseRef.current;
      }

      if (baseImg) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;

        if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
          canvas.width = displayWidth * dpr;
          canvas.height = displayHeight * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // Aspect ratio cover geometry (2560x1440 2K native 16:9)
        const srcAspect = NATIVE_WIDTH / NATIVE_HEIGHT;
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
        ctx.imageSmoothingQuality = "medium";

        // Draw base frame
        ctx.globalAlpha = 1;
        ctx.drawImage(baseImg, drawX, drawY, drawWidth, drawHeight);

        // Draw crossfading theme frame with smoothstep interpolation: 3t^2 - 2t^3
        if (isBlending) {
          let blendImg = blendFrames[idx];
          if (blendImg) {
            lastValidBlendRef.current = blendImg;
          } else {
            blendImg = lastValidBlendRef.current;
          }

          if (blendImg) {
            const t = transitionProgressRef.current;
            const alpha = t * t * (3 - 2 * t);
            ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
            ctx.drawImage(blendImg, drawX, drawY, drawWidth, drawHeight);
            ctx.globalAlpha = 1;
          }
        }

        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Instant seamless lighting crossfade trigger
  const handleToggle = () => {
    const newTarget = currentTheme === "light" ? "dark" : "light";

    if (isTransitioningRef.current) {
      fromModeRef.current = toModeRef.current;
      toModeRef.current = newTarget;
      transitionProgressRef.current = 1 - transitionProgressRef.current;
    } else {
      fromModeRef.current = activeModeRef.current;
      toModeRef.current = newTarget;
      transitionProgressRef.current = 0;
      isTransitioningRef.current = true;
    }

    setCurrentTheme(newTarget);
    setTheme(newTarget);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen min-h-[100dvh] overflow-hidden select-none transition-colors duration-500 ${
        currentTheme === "dark" ? "bg-black" : "bg-[#f5f5f7]"
      }`}
    >
      {/* ── IMMERSIVE FULLSCREEN 2K HIGH-PERFORMANCE CANVAS ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover block will-change-transform"
      />

      {/* ── PURE BLACK UIVERSE KINETIC PRELOADER OVERLAY ── */}
      {isLoading && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black select-none transition-all duration-700 ease-out ${
            isExiting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
          }`}
        >
          {/* Kinetic Ball Wheel */}
          <div className="uiverse-main mb-8">
            <div className="up">
              <div className="uiverse-loaders">
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
                <div className="uiverse-loader" />
              </div>
              <div className="uiverse-loadersB">
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball0" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball1" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball2" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball3" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball4" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball5" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball6" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball7" />
                </div>
                <div className="uiverse-loaderA">
                  <div className="uiverse-ball8" />
                </div>
              </div>
            </div>
          </div>

          {/* Minimal Brand Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.4em] text-white uppercase select-none drop-shadow-[0_2px_20px_rgba(255,255,255,0.2)]">
            VYEPARI X
          </h1>

          {/* Real Percentage and Status Header */}
          <div className="flex items-center justify-between w-48 sm:w-64 mt-6 text-[11px] font-mono">
            <span className="text-white/60 tracking-wider">DOWNLOADING FRAMES</span>
            <span className="text-lime font-bold tracking-widest text-xs drop-shadow-[0_0_8px_rgba(214,255,68,0.7)]">
              {progress}%
            </span>
          </div>

          {/* Ultra-Fine Responsive Progress Bar */}
          <div className="w-48 sm:w-64 h-[2px] bg-white/10 rounded-full mt-2 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-lime via-cyan-400 to-violet-400 transition-all duration-150 ease-out shadow-[0_0_10px_rgba(214,255,68,0.7)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Micro-Status Ticker */}
          <div className="flex items-center gap-2 mt-3.5 h-5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
            <p className="text-[10px] sm:text-[11px] font-mono tracking-widest text-neutral-400 lowercase transition-all duration-300">
              {statusText}
            </p>
          </div>
        </div>
      )}

      {/* ── MINIMAL FLOATING LIGHT / DARK TOGGLE ── */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleToggle}
          title={currentTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme mode"
          className={`group relative flex items-center justify-center h-12 w-12 rounded-full backdrop-blur-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer ${
            currentTheme === "dark"
              ? "bg-black/40 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-white/40 hover:bg-black/60"
              : "bg-white/80 border border-black/15 shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-black/30 hover:bg-white/95"
          }`}
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
              <Sun className="h-5 w-5 text-amber-500 transition-colors drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            )}
          </div>
        </button>
      </div>

      {/* ── MINIMAL SUBTLE BOTTOM SCROLL INDICATOR ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          onClick={() => {
            const el = document.getElementById("platform-content");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1.5 opacity-70 hover:opacity-100 transition-all cursor-pointer ${
            currentTheme === "dark"
              ? "text-white/80 hover:text-white"
              : "text-neutral-900/80 hover:text-neutral-950"
          }`}
          aria-label="Scroll to platform overview"
        >
          <span className="text-[9px] font-mono tracking-widest uppercase font-bold">Scroll</span>
          <div
            className={`h-6 w-3.5 rounded-full border flex items-start justify-center p-0.5 ${
              currentTheme === "dark" ? "border-white/50" : "border-neutral-900/50"
            }`}
          >
            <div
              className={`h-1.5 w-1 rounded-full animate-bounce ${
                currentTheme === "dark" ? "bg-white" : "bg-neutral-900"
              }`}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
