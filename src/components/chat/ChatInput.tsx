import React, { useRef, useEffect } from 'react';
import { Send, Code, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../lib/store';
import { ComputingMetrics } from '../ComputingMetrics';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  isLoading: boolean;
  isDragging: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleImageUpload: (file: File) => void;
}

export function ChatInput({
  input,
  setInput,
  imageUrl,
  setImageUrl,
  isLoading,
  isDragging,
  handleSubmit,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleImageUpload
}: ChatInputProps) {
  const { tokens, isUltraMode, activeModel, computingMetrics } = useStore();
  const isDominator = activeModel === 'dominator';
  const isVision = activeModel === 'vision';
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '36px';
    }
  };

  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = '36px';
    const newHeight = Math.min(element.scrollHeight, 120);
    element.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    if (inputRef.current) {
      if (!input) {
        resetTextareaHeight();
      } else {
        adjustTextareaHeight(inputRef.current);
      }
    }
  }, [input]);

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`p-2 md:p-4 border-t ${
        isDominator ? "border-red-900/20" : "border-purple-900/20"
      } bg-[var(--bg-darker)]`}
    >
      <div 
        className={`chat-input-wrapper ${
          isUltraMode && isDominator ? 'ultra-mode' : 'normal-mode'
        } ${!isDominator ? 'vision' : ''} ${isDragging ? 'border-dashed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-full">
          <div className="flex items-center">
            {isDominator ? (
              <div className={`p-2 rounded-lg ${
                isDominator 
                  ? "text-red-500" 
                  : "text-purple-500"
              }`}>
                <Code className="w-4 h-4" />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg transition-colors text-purple-500 hover:text-purple-400"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                />
              </>
            )}
            <div className="flex-1 relative">
              {!isDominator && imageUrl && (
                <div className="absolute -top-16 left-0 right-0 bg-purple-900/20 rounded-lg p-2 mb-2">
                  <img 
                    src={imageUrl} 
                    alt="Uploaded" 
                    className="h-12 object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute top-1 right-1 text-purple-400 hover:text-purple-300"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="relative flex items-center">
                <textarea
                  ref={inputRef}
                  value={input}
                  style={{
                    height: '36px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    lineHeight: '20px'
                  }}
                  onChange={(e) => {
                    setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading && (input.trim() || imageUrl)) {
                        handleSubmit(e);
                      }
                    }
                  }}
                  placeholder={
                    isDominator
                      ? isUltraMode 
                        ? "Ask anything..." 
                        : "Ask anything..."
                      : "Ask Kiara anything..."
                  }
                  className={`chat-input ${isDominator ? "" : "vision"} min-h-[36px] align-middle`}
                  disabled={isLoading || tokens <= 0}
                  rows={1}
                  enterKeyHint="send"
                />
                <button
                  type="submit"
                  disabled={(!input.trim() || tokens <= 0) || isLoading}
                  className={`absolute right-2 p-2 ${
                    isDominator 
                      ? "text-red-500 hover:text-red-400" 
                      : "text-purple-500 hover:text-purple-400"
                  } disabled:text-gray-600 transition-colors`}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-red-400/60">
        {isDominator 
          ? 'Kiara Dominator X+ Advanced Reasoning'
          : 'Kiara Vision X - Your Smart Assistant'
        }
      </div>
    </form>
  );
}