"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface ParallaxFeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ParallaxFeatureCard({
  title,
  description,
  icon,
}: ParallaxFeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouch || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardRef.current.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateZ(8px)`;
    },
    [isTouch]
  );

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform =
        "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)";
    }
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-elevated group relative bg-paper-raised rounded-2xl p-8 border border-paper-sunken transition-all duration-150 ease-out"
      style={{ willChange: "transform" }}
    >
      <div className="w-12 h-12 rounded-xl bg-[#039a85]/10 flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-obsidian mb-2">{title}</h3>
      <p className="text-sm text-ash leading-relaxed">{description}</p>
    </div>
  );
}
