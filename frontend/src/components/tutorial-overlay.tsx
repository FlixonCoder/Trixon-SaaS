"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Shield, ListTodo, FileText, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";

interface TutorialOverlayProps {
  isFirstAnalysis: boolean;
}

const STEPS = [
  {
    title: "Welcome to your Dashboard!",
    description: "Your codebase has been successfully analysed. Let's take a quick tour of what Trixon can do for you.",
    icon: Sparkles,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
  },
  {
    title: "Health Scores",
    description: "At the top, you'll see scores from 0-100 for Security, Scalability, and Tech Debt. This gives you an instant pulse on your codebase.",
    icon: Shield,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  {
    title: "AI Codebase Advisor",
    description: "Use the Chat feature to talk directly to your codebase. Ask about architectural decisions, security risks, or where to find specific features.",
    icon: MessageCircle,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
  },
  {
    title: "Action Items",
    description: "Trixon generates a prioritised list of what needs fixing. Filter by 'Quick Wins' to get started immediately.",
    icon: ListTodo,
    color: "text-red-500",
    bgColor: "bg-red-50",
  },
  {
    title: "Deep Dive Reports",
    description: "Scroll down to read detailed, plain-English reports on your architecture, onboarding, and investor due-diligence.",
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-50",
  }
];

export function TutorialOverlay({ isFirstAnalysis }: TutorialOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isFirstAnalysis) return;

    // Check if they've already seen it
    const seen = localStorage.getItem("trixon_tutorial_seen");
    if (!seen) {
      setIsOpen(true);
    }
  }, [isFirstAnalysis]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/40 backdrop-blur-sm">
      <div className="bg-paper-raised border border-paper-sunken rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-paper-sunken text-ash transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pb-6 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${stepInfo.bgColor}`}>
            <Icon className={`w-8 h-8 ${stepInfo.color}`} />
          </div>
          
          <h2 className="text-xl font-bold text-obsidian mb-3">
            {stepInfo.title}
          </h2>
          <p className="text-sm text-ash leading-relaxed">
            {stepInfo.description}
          </p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? "w-6 bg-obsidian" : "w-1.5 bg-zinc-200"
              }`}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-paper-sunken border-t border-paper-sunken flex items-center justify-between">
          <button
            onClick={handlePrev}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              currentStep === 0 ? "text-transparent pointer-events-none" : "text-ash hover:text-obsidian"
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-obsidian text-paper-raised rounded-lg text-sm font-medium hover:bg-[#333] transition-colors shadow-sm"
          >
            {currentStep === STEPS.length - 1 ? "Get Started" : "Next"} 
            {currentStep !== STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
