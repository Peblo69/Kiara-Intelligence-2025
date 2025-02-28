import React from 'react';
import { useStore } from '../../lib/store';

export function WelcomeScreen() {
  const { activeModel } = useStore();
  const isDominator = activeModel === 'dominator';

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className={`infinity-logo w-32 h-32 md:w-48 md:h-48 mb-6 md:mb-8 ${isDominator ? "" : "vision"}`}></div>
      <h2 className={`text-4xl font-bold mb-4 tracking-wide ${
        isDominator ? "title-gradient" : "vision-gradient"
      } text-2xl md:text-4xl`}>
        {isDominator ? "Kiara Dominator X+" : "Kiara Vision X"}
      </h2>
      <p className={`text-xs md:text-sm ${
        isDominator ? "text-red-400/80" : "text-purple-400/80"
      } max-w-md mb-2`}>
        {isDominator
          ? "Experience unparalleled AI capabilities with advanced reasoning and deep learning abilities."
          : "Your AI assistant for smart productivity, quick answers, and seamless daily assistance."}
      </p>
      <p className={`text-[10px] md:text-xs ${
        isDominator ? "text-red-500/60" : "text-purple-500/60"
      }`}>
        Powered by Kiara Intelligence
      </p>
    </div>
  );
}