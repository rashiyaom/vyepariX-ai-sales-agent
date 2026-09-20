import React, { useEffect, useRef, useState, useCallback } from "react";
import { Dices, Sparkles, ArrowDown, Shield, Zap, RefreshCw } from "lucide-react";

export function DiceScrollSection() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [manualRotations, setManualRotations] = useState<{ x: number; y: number; z: number }>({
    x: 15,
    y: -25,
    z: 10,
  });
  const [activeFace, setActiveFace] = useState<number>(1);

  // Track scroll position through the section to drive 3D rotation
  useEffect(() => {
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Section is active from when top enters viewport to when bottom leaves
      const totalDist = el.offsetHeight + windowHeight;
      const currentDist = windowHeight - rect.top;
      const progress = Math.max(0, Math.min(1, currentDist / totalDist));

      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Compute 3D rotation based on scroll or manual roll
  const baseRotX = isRolling ? manualRotations.x : 20 + scrollProgress * 540;
  const baseRotY = isRolling ? manualRotations.y : -30 + scrollProgress * 720;
  const baseRotZ = isRolling ? manualRotations.z : 10 + scrollProgress * 360;

  // Interactive dice roll button
  const rollDice = useCallback(() => {
    setIsRolling(true);
    const randomFace = Math.floor(Math.random() * 6) + 1;
    setActiveFace(randomFace);

    // Preset rotations for specific faces plus multiple full spins
    const faceRotations: Record<number, { x: number; y: number; z: number }> = {
      1: { x: 0, y: 0, z: 0 },
      2: { x: 0, y: -90, z: 0 },
      3: { x: 0, y: 180, z: 0 },
      4: { x: 0, y: 90, z: 0 },
      5: { x: -90, y: 0, z: 0 },
      6: { x: 90, y: 0, z: 0 },
    };

    const target = faceRotations[randomFace];
    const extraSpins = 720;

    setManualRotations({
      x: target.x + extraSpins,
      y: target.y + extraSpins * 1.5,
      z: target.z + extraSpins * 0.5,
    });

    setTimeout(() => {
      setIsRolling(false);
    }, 1200);
  }, []);

  const scrollToOldHero = () => {
    const el = document.getElementById("platform-content");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      ref={sectionRef}
      id="dice-scroll-screen"
      className="relative min-h-[110vh] w-full bg-paper text-ink transition-colors duration-300 py-20 flex flex-col justify-between items-center overflow-hidden border-b border-ink/20 select-none"
    >
      {/* ── HIGH-TECH CYBER GRID & AMBIENT RADIAL GLOWS ── */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-25 bg-[radial-gradient(#8b5cf6_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-violet/20 via-lime/10 to-transparent blur-3xl pointer-events-none" />

      {/* ── TOP SECTION INTRO ── */}
      <div className="relative z-10 text-center max-w-2xl px-4 space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet/30 bg-violet/10 backdrop-blur-md">
          <Dices className="h-4 w-4 text-violet animate-spin [animation-duration:8s]" />
          <span className="font-mono text-xs font-semibold text-violet uppercase tracking-widest">
            Deterministic Sales Intelligence
          </span>
        </div>

        <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight leading-[0.95]">
          Stop Rolling the Dice on Your Pipeline
        </h2>

        <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Traditional outreach gambles with random cold lists and lucky timing. VYAPERI X replaces
          luck with continuous mathematical certainty across every stage of the sale.
        </p>
      </div>

      {/* ── 3D ROLLING CUBE CONTAINER ── */}
      <div className="relative z-10 my-12 flex flex-col items-center justify-center">
        {/* 3D Scene Viewport */}
        <div
          className="relative w-64 h-64 sm:w-72 sm:h-72 [perspective:1200px]"
          style={{ perspective: "1200px" }}
        >
          <div
            className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-300 ease-out"
            style={{
              transform: `rotateX(${baseRotX}deg) rotateY(${baseRotY}deg) rotateZ(${baseRotZ}deg)`,
            }}
          >
            {/* ── FACE 1: FRONT (1 PIP - INTENT RADAR) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-violet/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(139,92,246,0.3)] select-none"
              style={{ transform: "translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-violet font-bold">
                  Face // 01
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-violet animate-ping" />
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <div className="h-10 w-10 rounded-full bg-violet/20 border border-violet/40 flex items-center justify-center mb-2">
                  <span className="h-4 w-4 rounded-full bg-violet shadow-[0_0_12px_#8b5cf6]" />
                </div>
                <span className="font-display font-bold text-lg text-ink text-center">
                  Intent Radar
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  40+ Stream Sweep
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>INTENT</span>
                <span>4,200/DAY</span>
              </div>
            </div>

            {/* ── FACE 2: RIGHT (2 PIPS - ENRICHMENT) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-lime/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(184,255,107,0.3)] select-none"
              style={{ transform: "rotateY(90deg) translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-lime font-bold">
                  Face // 02
                </span>
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-lime" />
                  <span className="h-2 w-2 rounded-full bg-lime" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <div className="flex gap-3 mb-2">
                  <span className="h-3 w-3 rounded-full bg-lime shadow-[0_0_8px_#b8ff6b]" />
                  <span className="h-3 w-3 rounded-full bg-lime shadow-[0_0_8px_#b8ff6b]" />
                </div>
                <span className="font-display font-bold text-lg text-ink text-center">
                  Enrichment
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  99.8% Resolution
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>MX & PHONE</span>
                <span>VERIFIED</span>
              </div>
            </div>

            {/* ── FACE 3: BACK (3 PIPS - MULTILINGUAL VOICE) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-cyan-400/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(34,211,238,0.3)] select-none"
              style={{ transform: "rotateY(180deg) translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                  Face // 03
                </span>
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <div className="flex gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                </div>
                <span className="font-display font-bold text-lg text-ink text-center">
                  Voice Fleet
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  14+ Dialects
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>HINDI · EN · GU</span>
                <span>CONSULTATIVE</span>
              </div>
            </div>

            {/* ── FACE 4: LEFT (4 PIPS - AUTONOMOUS SCORING) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-amber-400/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(251,191,36,0.3)] select-none"
              style={{ transform: "rotateY(-90deg) translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                  Face // 04
                </span>
                <div className="grid grid-cols-2 gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <div className="grid grid-cols-2 gap-2.5 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                </div>
                <span className="font-display font-bold text-lg text-ink text-center">
                  ICP Scoring
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  92% Precision
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>SCORING</span>
                <span>AUTONOMOUS</span>
              </div>
            </div>

            {/* ── FACE 5: TOP (5 PIPS - DEAL CADENCE) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-emerald-400/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(52,211,153,0.3)] select-none"
              style={{ transform: "rotateX(90deg) translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                  Face // 05
                </span>
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="font-display font-bold text-lg text-ink text-center">
                  Deal Cadence
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  Global Timezones
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>CADENCE</span>
                <span>24/7 SYNC</span>
              </div>
            </div>

            {/* ── FACE 6: BOTTOM (6 PIPS - CLOSED LOOP) ── */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-fuchsia-400/60 bg-paper/90 dark:bg-card/90 backdrop-blur-xl p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(232,121,249,0.3)] select-none"
              style={{ transform: "rotateX(-90deg) translateZ(130px)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fuchsia-400 font-bold">
                  Face // 06
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="font-display font-bold text-lg text-ink text-center">
                  Closed Loop
                </span>
                <span className="font-mono text-[11px] text-muted-foreground text-center mt-1">
                  Direct CRM Sync
                </span>
              </div>
              <div className="border-t border-ink/10 pt-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>RESULTS</span>
                <span>GUARANTEED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Roll Trigger */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={rollDice}
            disabled={isRolling}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-violet/40 bg-card/80 hover:bg-secondary font-mono text-xs font-bold text-ink shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-violet ${isRolling ? "animate-spin" : ""}`} />
            <span>Roll the AI Dice</span>
          </button>

          <span className="font-mono text-xs text-muted-foreground">
            {isRolling ? "Tumbling..." : `Face #${activeFace} Active`}
          </span>
        </div>
      </div>

      {/* ── BOTTOM SCROLL PROMPT INTO OLD HERO SECTION ── */}
      <div className="relative z-10 flex flex-col items-center gap-2 pt-8">
        <button
          onClick={scrollToOldHero}
          className="group flex flex-col items-center gap-1.5 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-violet font-semibold">
            Scroll down to enter platform overview
          </span>
          <div className="h-8 w-5 rounded-full border border-ink/30 flex items-start justify-center p-1 group-hover:border-violet transition-colors">
            <div className="h-2 w-1 rounded-full bg-violet animate-bounce" />
          </div>
        </button>
      </div>
    </section>
  );
}
