import { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Radio,
  ExternalLink,
} from "lucide-react";

export type PipelineModule = {
  n: string;
  t: string;
  tag: string;
  d: string;
  metric: string;
};

interface PipelineCarouselProps {
  modules: PipelineModule[];
}

export function PipelineCarousel({ modules }: PipelineCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smoothly scroll the container to an index
  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.children;
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      // Scroll with padding offset so the card sits nicely in view
      const targetLeft = card.offsetLeft - (container.clientWidth / 2 - card.clientWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
      setActiveIndex(index);
    }
  }, []);

  // Handle next / prev
  const handleNext = useCallback(() => {
    const nextIdx = (activeIndex + 1) % modules.length;
    scrollToIndex(nextIdx);
  }, [activeIndex, modules.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    const prevIdx = (activeIndex - 1 + modules.length) % modules.length;
    scrollToIndex(prevIdx);
  }, [activeIndex, modules.length, scrollToIndex]);

  // Auto-advance loop
  useEffect(() => {
    if (!isPlaying || isHovered) {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      return;
    }

    autoScrollTimer.current = setInterval(() => {
      setActiveIndex((curr) => {
        const next = (curr + 1) % modules.length;
        scrollToIndex(next);
        return next;
      });
    }, 3600);

    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [isPlaying, isHovered, modules.length, scrollToIndex]);

  // Track manual scroll by user on mobile swipe
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.children[0]?.clientWidth || 320;
    const approxIndex = Math.round(scrollLeft / (cardWidth + 16));
    const clampedIndex = Math.min(Math.max(approxIndex, 0), modules.length - 1);
    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
    }
  };

  const activeModule = modules[activeIndex] || modules[0]!;

  return (
    <div
      className="space-y-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => {
        // Resume after small delay when touch ends
        setTimeout(() => setIsHovered(false), 2000);
      }}
    >
      {/* ── Control Bar & Step Pill Tracker ── */}
      <div className="flex flex-col gap-4 border border-ink/20 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Left: Active Step Title & Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink bg-violet text-white font-mono text-xs font-extrabold shadow-sm">
            {activeModule.n}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="label-mono text-[10px] text-muted-foreground">
                Step {activeIndex + 1} of {modules.length}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-lime live-dot" />
              <span className="label-mono text-[10px] text-violet font-bold uppercase">
                {activeModule.tag}
              </span>
            </div>
            <h4 className="font-display text-sm font-bold text-ink truncate sm:text-base">
              {activeModule.t}
            </h4>
          </div>
        </div>

        {/* Right: Actions & Playback */}
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`inline-flex items-center gap-1.5 border border-ink/20 px-3 py-2 font-mono text-xs transition-colors ${
              isPlaying
                ? "bg-paper text-ink hover:border-violet"
                : "bg-violet/10 text-violet border-violet font-bold"
            }`}
            title={isPlaying ? "Pause auto-scroll" : "Resume auto-scroll"}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3 w-3 text-violet" />
                <span className="hidden sm:inline">Auto-Scroll</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current text-violet" />
                <span>Paused</span>
              </>
            )}
          </button>

          {/* Navigation Chevrons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="border border-ink/30 bg-paper p-2 text-ink transition-colors hover:border-violet hover:bg-secondary active:scale-95"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="border border-ink/30 bg-paper p-2 text-ink transition-colors hover:border-violet hover:bg-secondary active:scale-95"
              aria-label="Next step"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Mini Step Progress Bar (Scrollable on phones) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {modules.map((m, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={m.n}
              onClick={() => {
                scrollToIndex(idx);
                setIsPlaying(false);
              }}
              className={`group shrink-0 border px-2.5 py-1.5 font-mono text-xs transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-ink text-paper border-ink font-extrabold shadow-sm scale-102"
                  : "bg-paper text-muted-foreground border-ink/20 hover:border-violet hover:text-ink"
              }`}
            >
              <span className={isActive ? "text-lime font-bold" : "text-violet font-bold"}>
                {m.n}
              </span>
              <span className="hidden md:inline truncate max-w-[90px]">{m.t.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Carousel Track: Horizontal Snap Card Strip (Phone & Desktop optimized) ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none"
        style={{ scrollBehavior: "smooth" }}
      >
        {modules.map((p, idx) => {
          const isActive = idx === activeIndex;
          const nextStepName = modules[(idx + 1) % modules.length]?.t;

          return (
            <div
              key={p.n}
              onClick={() => scrollToIndex(idx)}
              className={`w-[84vw] max-w-[320px] sm:w-[350px] shrink-0 snap-center cursor-pointer border p-5 transition-all duration-300 flex flex-col justify-between ${
                isActive
                  ? "bg-paper border-violet shadow-[0_8px_30px_rgba(139,92,246,0.15)] ring-2 ring-violet/25 scale-[1.01]"
                  : "bg-paper/85 dark:bg-card/90 border-ink/15 hover:border-ink/50 hover:bg-paper"
              }`}
            >
              <div className="space-y-3.5">
                {/* Top Step Meta */}
                <div className="flex items-center justify-between border-b border-ink/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-none border ${
                        isActive
                          ? "bg-violet text-white border-violet"
                          : "bg-violet/10 text-violet border-violet/20"
                      }`}
                    >
                      STEP {p.n}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 label-mono text-[9px] text-emerald-700 dark:text-lime font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime animate-ping" />
                        Active
                      </span>
                    )}
                  </div>
                  <span className="label-mono text-[10px] text-muted-foreground uppercase tracking-tight">
                    {p.tag}
                  </span>
                </div>

                {/* Card Title */}
                <h3
                  className={`font-display text-base font-bold transition-colors line-clamp-2 leading-tight ${
                    isActive ? "text-violet" : "text-ink"
                  }`}
                >
                  {p.t}
                </h3>

                {/* Card Description */}
                <p className="font-mono text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {p.d}
                </p>
              </div>

              {/* Bottom Meta & Metric */}
              <div className="mt-4 pt-3 border-t border-ink/10 space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-emerald-700 dark:text-lime font-bold flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-lime shrink-0" />
                    <span className="truncate">{p.metric}</span>
                  </span>
                  <span className="text-muted-foreground text-[10px] shrink-0 font-mono">
                    {idx < modules.length - 1 ? `→ #${modules[idx + 1]!.n}` : "↺ Loop"}
                  </span>
                </div>

                {isActive && (
                  <div className="label-mono text-[9px] text-muted-foreground truncate pt-0.5">
                    Next: <strong className="text-ink">{nextStepName}</strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Interactive Step Inspector Spotlight ── */}
      <div className="border border-ink bg-ink p-4 text-paper sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/15 pb-2 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-lime animate-pulse" />
            <span className="font-bold text-paper uppercase tracking-wider">
              // Step {activeModule.n} Real-Time Pipeline Telemetry
            </span>
          </div>
          <span className="text-paper/60 text-[11px]">
            {isPlaying ? "Auto-cycling through 11 gates" : "Viewing step details"}
          </span>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-[1.4fr_1fr] items-center font-mono text-xs">
          <div className="space-y-1.5">
            <div className="text-violet font-bold text-sm">{activeModule.t}</div>
            <p className="text-paper/70 text-[11px] leading-relaxed max-w-xl">{activeModule.d}</p>
          </div>

          <div className="flex flex-col sm:items-end justify-center space-y-2 border-t border-paper/10 pt-3 sm:border-t-0 sm:pt-0">
            <div className="inline-flex items-center gap-2 bg-paper/10 px-3 py-1.5 border border-paper/20">
              <span className="text-lime font-bold">Metric:</span>
              <span className="text-paper font-mono">{activeModule.metric}</span>
            </div>
            <a
              href="#sandbox"
              className="inline-flex items-center gap-1.5 label-mono text-[10px] text-paper/70 hover:text-lime transition-colors"
            >
              Test in Interactive Sandbox <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
