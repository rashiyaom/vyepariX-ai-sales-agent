import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/app/theme";
import { Sun, Moon } from "lucide-react";

export function CinematicFrameHero() {
  const { theme, setTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lightVideoRef = useRef<HTMLVideoElement | null>(null);
  const darkVideoRef = useRef<HTMLVideoElement | null>(null);

  // Active theme state
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(
    theme === "dark" ? "dark" : "light",
  );

  // Sync external theme changes
  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      setCurrentTheme(theme);
    }
  }, [theme]);

  // Frame-accurate hardware video synchronization
  useEffect(() => {
    const lightVideo = lightVideoRef.current;
    const darkVideo = darkVideoRef.current;
    if (!lightVideo || !darkVideo) return;

    // Ensure both videos start playing seamlessly
    const playBoth = async () => {
      try {
        await Promise.all([
          lightVideo.play().catch(() => {}),
          darkVideo.play().catch(() => {}),
        ]);
      } catch {
        // Autoplay policy fallback
      }
    };

    playBoth();

    // Strict time alignment so transitions occur at the exact same millisecond
    const syncVideos = () => {
      if (Math.abs(lightVideo.currentTime - darkVideo.currentTime) > 0.04) {
        // Master clock follows the currently visible video
        if (currentTheme === "light") {
          darkVideo.currentTime = lightVideo.currentTime;
        } else {
          lightVideo.currentTime = darkVideo.currentTime;
        }
      }
    };

    const syncInterval = setInterval(syncVideos, 300);

    return () => {
      clearInterval(syncInterval);
    };
  }, [currentTheme]);

  // Instant seamless lighting crossfade trigger
  const handleToggle = () => {
    const newTarget = currentTheme === "light" ? "dark" : "light";
    setCurrentTheme(newTarget);
    setTheme(newTarget);

    // Re-verify synchronization at trigger point
    const light = lightVideoRef.current;
    const dark = darkVideoRef.current;
    if (light && dark) {
      if (newTarget === "dark") {
        dark.currentTime = light.currentTime;
      } else {
        light.currentTime = dark.currentTime;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen min-h-[100dvh] overflow-hidden select-none transition-colors duration-500 ${
        currentTheme === "dark" ? "bg-black" : "bg-[#f5f5f7]"
      }`}
    >
      {/* ── HARDWARE-ACCELERATED 2K LIGHT MODE VIDEO STREAM ── */}
      <video
        ref={lightVideoRef}
        src="/videos/hero_light_2k.mp4"
        playsInline
        muted
        loop
        autoPlay
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out pointer-events-none will-change-transform ${
          currentTheme === "light" ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      />

      {/* ── HARDWARE-ACCELERATED 2K DARK MODE VIDEO STREAM ── */}
      <video
        ref={darkVideoRef}
        src="/videos/hero_dark_2k.mp4"
        playsInline
        muted
        loop
        autoPlay
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out pointer-events-none will-change-transform ${
          currentTheme === "dark" ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      />

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
            currentTheme === "dark" ? "text-white/80 hover:text-white" : "text-neutral-900/80 hover:text-neutral-950"
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
