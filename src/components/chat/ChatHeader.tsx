import React from 'react';
import { Brain, Flame, MoreVertical, Sparkles } from 'lucide-react';
import { useStore } from '../../lib/store';

export function ChatHeader() {
  const { activeModel, isUltraMode, setUltraMode, tokens } = useStore();
  const isDominator = activeModel === 'dominator';
  const isVision = activeModel === 'vision';

  const getModelName = () => {
    if (isDominator) {
      return {
        desktop: "Kiara Dominator X+",
        mobile: "Dominator X+"
      };
    }
    return {
      desktop: "Kiara Vision X",
      mobile: "Vision X"
    };
  };

  const modelName = getModelName();

  return (
    <header className={`flex items-center justify-between px-4 py-1.5 border-b ${
      isDominator ? "border-red-900/20" : "border-purple-900/20"
    } bg-[var(--bg-darker)] relative z-10`}>
      <div className="flex items-center space-x-1.5 pl-12 md:pl-0">
        <div className={`infinity-logo w-4 h-4 md:w-5 md:h-5 ${isDominator ? "" : "vision"}`}></div>
        <h1 className={`text-sm md:text-lg font-bold tracking-wide ${
          isDominator ? "title-gradient" : "vision-gradient"
        } whitespace-nowrap text-center flex-1 md:flex-none`}>
          <span className="hidden md:inline">{modelName.desktop}</span>
          <span className="md:hidden">{modelName.mobile}</span>
        </h1>
        <span className={`px-1 py-0.5 text-[8px] ${
          isDominator 
            ? "bg-red-900/50 text-red-400" 
            : "bg-purple-900/50 text-purple-400"
        } rounded`}>
          BETA
        </span>
      </div>
      <div className="flex items-center space-x-1.5 pr-2">
        {isDominator && (
          <>
            <button 
              className={`p-1 rounded-lg transition-colors hidden md:block ${
                isUltraMode ? 'bg-red-900/40 text-red-400' : 'hover:bg-red-900/20 text-red-400'
              }`}
              onClick={() => setUltraMode(!isUltraMode)}
            >
              <Flame className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <div className={`text-xs ${
          isDominator
            ? tokens <= 10 ? 'text-red-500' : 'text-red-400'
            : tokens <= 10 ? 'text-purple-500' : 'text-purple-400'
        } font-bold whitespace-nowrap min-w-[60px] text-right`}>
          {tokens} tokens
        </div>
        {isVision && (
          <></>
        )}
        <button className={`p-1 hover:${
          isDominator ? "bg-red-900/20" : "bg-purple-900/20"
        } rounded-lg transition-colors`}>
          <MoreVertical className={`w-3.5 h-3.5 ${
            isDominator ? "text-red-400" : "text-purple-400"
          }`} />
        </button>
      </div>
    </header>
  );
}