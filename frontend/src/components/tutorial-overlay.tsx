"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Shield, ListTodo, FileText, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";

interface TutorialOverlayProps {
  isFirstAnalysis: boolean;
}

const STEPS = [
  {
    title: "Welcome to Trixon! 👋",
    description: "Your codebase is fully analyzed! Let's take a 30-second tour of your new superpowers. Click 'Next' to get started!",
    icon: Sparkles,
    color: "text-[#039a85]",
    bgColor: "bg-[#039a85]/10 border border-[#039a85]/20",
    selector: null,
  },
  {
    title: "Your Code's Report Card 📊",
    description: "These rings show how healthy your project is from 0 to 100. 'Tech Debt' checks for messy code chores, 'Security' scans for open locks, and 'Scalability' checks if your app can handle millions of users.",
    icon: Shield,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10 border border-amber-400/20",
    selector: "health-scores",
  },
  {
    title: "Chat with your Code 💬",
    description: "Want to build a new feature or find a bug? Talk directly to our AI! It knows your codebase inside-out. Ask it 'How do I add a new tab?' and watch it write the code.",
    icon: MessageCircle,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10 border border-purple-400/20",
    selector: 'a[href$="/chat"]',
  },
  {
    title: "Your Prioritized To-Do List 🎯",
    description: "Here are all the issues we found, sorted by priority. We tag 'Quick Wins' so you can knock out easy fixes and level up your project today.",
    icon: ListTodo,
    color: "text-red-400",
    bgColor: "bg-red-400/10 border border-red-400/20",
    selector: 'a[href$="/action-items"]',
  },
  {
    title: "Under the Hood Deep Dives 🔍",
    description: "Read plain-English, deep-dive reports on your app's structure, onboarding guides for new hires, and professional summaries for investors.",
    icon: FileText,
    color: "text-[#039a85]",
    bgColor: "bg-[#039a85]/10 border border-[#039a85]/20",
    selector: 'a[href$="/reports"]',
  }
];

export function TutorialOverlay({ isFirstAnalysis }: TutorialOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isFirstAnalysis) return;

    const seen = localStorage.getItem("trixon_tutorial_seen");
    if (!seen) {
      setIsOpen(true);
    }
  }, [isFirstAnalysis]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      const stepInfo = STEPS[currentStep];
      if (!stepInfo.selector) {
        setRect(null);
        return;
      }

      let el: HTMLElement | null = null;
      if (stepInfo.selector === "health-scores") {
        el = Array.from(document.querySelectorAll("h2")).find(
          (h) => h.textContent?.trim() === "Health Scores"
        )?.parentElement as HTMLElement | null;
      } else {
        el = document.querySelector(stepInfo.selector) as HTMLElement | null;
      }

      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => {
          setRect(el!.getBoundingClientRect());
        }, 300);
      } else {
        setRect(null);
      }
    };

    // Calculate rect with a small delay for scrolling
    const timer = setTimeout(updateRect, 100);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [currentStep, isOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem("trixon_tutorial_seen", "true");
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const stepInfo = STEPS[currentStep];
  const Icon = stepInfo.icon;

  // Determine card coordinates dynamically
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 110,
    width: "90%",
    maxWidth: "400px",
  };

  if (rect && !isMobile) {
    const spaceBelow = window.innerHeight - (rect.bottom + 16);
    const spaceAbove = rect.top - 16;
    const leftPos = Math.min(window.innerWidth - 420, Math.max(16, rect.left + rect.width / 2 - 200));

    if (spaceBelow > 280) {
      cardStyle = {
        position: "fixed",
        left: `${leftPos}px`,
        top: `${rect.bottom + 16}px`,
        width: "400px",
        zIndex: 110,
      };
    } else if (spaceAbove > 280) {
      cardStyle = {
        position: "fixed",
        left: `${leftPos}px`,
        top: `${rect.top - 280}px`,
        width: "400px",
        zIndex: 110,
      };
    } else {
      cardStyle = {
        position: "fixed",
        left: `${leftPos}px`,
        top: `${window.innerHeight / 2 - 140}px`,
        width: "400px",
        zIndex: 110,
      };
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* SVG Spotlight mask */}
      {rect && !isMobile ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={rect.x - 8}
                y={rect.y - 8}
                width={rect.width + 16}
                height={rect.height + 16}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="#050505"
            opacity="0.75"
            mask="url(#spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-[#050505]/75 backdrop-blur-[2px]" />
      )}

      {/* Tour Card */}
      <div
        style={cardStyle}
        className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-8 pb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${stepInfo.bgColor}`}>
            <Icon className={`w-6 h-6 ${stepInfo.color}`} />
          </div>

          <h2 className="text-lg font-bold text-white mb-2 leading-tight">
            {stepInfo.title}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {stepInfo.description}
          </p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentStep ? "w-5 bg-[#039a85]" : "w-1 bg-zinc-850"
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-zinc-900/50 border-t border-zinc-900 flex items-center justify-between">
          <button
            onClick={handlePrev}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentStep === 0 ? "text-transparent pointer-events-none" : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-950 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-all shadow-sm"
          >
            {currentStep === STEPS.length - 1 ? "Done" : "Next"}
            {currentStep !== STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
