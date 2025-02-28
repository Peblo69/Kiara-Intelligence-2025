import React, { memo, useState } from 'react';
import { Copy, Palette } from 'lucide-react';
import { highlightCode } from '../lib/codeHighlighter';
import { useStore } from '../lib/store'; 

interface CodeBlockProps {
  code: string;
  language: string;
}

// Initialize Prism.js
if (typeof window !== 'undefined') {
  window.Prism = window.Prism || {};
  window.Prism.manual = true;
}

export const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const { codeTheme, setCodeTheme, isUltraMode, activeModel } = useStore();
  const isDominator = activeModel === 'dominator';
  
  // Process code and line numbers
  const processedCode = code.split('\n').map((line, i) => ({
    number: i + 1,
    content: highlightCode(line, language)
  }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themes = [
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
    { id: 'dracula', name: 'Dracula' },
    { id: 'nord', name: 'Nord' }
  ] as const;

  return (
    <div className={`relative group ${isUltraMode ? 'ultra-code-block' : ''}`}>
      <div className="absolute inset-x-0 top-0 h-10 bg-black/20 rounded-t-lg z-10 flex items-center justify-between px-4">
        <div>
          <span className={`text-xs ${isDominator ? 'text-red-400' : 'text-gray-400'}`}>
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowThemeMenu(!showThemeMenu);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
                isDominator 
                  ? 'text-red-400 hover:text-red-300 bg-red-900/30' 
                  : 'text-gray-400 hover:text-white bg-black/30'
              } rounded`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="ml-1">Theme</span>
            </button>
            {showThemeMenu && (
              <div 
                className={`absolute right-0 top-full mt-1 ${
                  isDominator 
                    ? 'bg-red-900/90' 
                    : 'bg-black/90'
                } rounded-lg shadow-lg overflow-hidden z-20`}
                onClick={(e) => e.stopPropagation()}
              >
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setCodeTheme(theme.id);
                      setShowThemeMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs ${
                      isUltraMode
                        ? 'hover:bg-red-800/30 text-red-200'
                        : 'hover:bg-white/10 text-gray-300'
                    } ${codeTheme === theme.id ? 'text-red-400' : ''}`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
              isDominator 
                ? 'text-red-400 hover:text-red-300 bg-red-900/30' 
                : 'text-gray-400 hover:text-white bg-black/30'
            } rounded`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="ml-1">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code content */}
      <pre className={`theme-${codeTheme} mt-10 overflow-x-auto`}>
        <code className={`language-${language} block`}>
          <table className="min-w-full border-collapse">
            <tbody>
              {processedCode.map((line) => (
                <tr key={line.number} className="hover:bg-black/10">
                  <td className="select-none pr-4 text-right text-opacity-50 border-r border-opacity-20 w-12">
                    {line.number}
                  </td>
                  <td className="pl-4 whitespace-pre overflow-x-auto">
                    <span dangerouslySetInnerHTML={{ __html: line.content || '&nbsp;' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </code>
      </pre>
    </div>
  );
});