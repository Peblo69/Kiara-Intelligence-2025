import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../lib/store';
import { CodeBlock } from '../CodeBlock';
import { Loader2 } from 'lucide-react';
import { ComputingMetrics } from '../ComputingMetrics';

interface ChatMessagesProps {
  messages: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    isStreaming?: boolean;
    error?: boolean;
  }>;
  thinkingStep: string;
  isLoading?: boolean;
}

const THINKING_MESSAGES = [
  "Analyzing input and context...",
  "Processing request...",
  "Generating response...",
  "Finalizing output..."
];

export function ChatMessages({ messages, thinkingStep, isLoading }: ChatMessagesProps) {
  const { activeModel, isUltraMode } = useStore();
  const isDominator = activeModel === 'dominator';
  const isVision = activeModel === 'vision';
  const [thinkingMessage, setThinkingMessage] = React.useState('');

  React.useEffect(() => {
    if (isDominator && isUltraMode && thinkingStep) {
      const randomMessage = THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
      setThinkingMessage(randomMessage);
    } else {
      setThinkingMessage('');
    }
  }, [thinkingStep, isDominator, isUltraMode]);

  const renderMessage = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          a: ({ node, children, href, ...props }) => (
            <a 
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={isDominator ? "text-red-400 hover:text-red-300" : "text-purple-400 hover:text-purple-300"}
              {...props}
            >
              {children}
            </a>
          ),
          p: ({ children }) => <div className="mb-4 leading-relaxed">{children}</div>,
          
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>,
          li: ({ children }) => <li className={isDominator ? "text-red-200" : "text-purple-200"}>{children}</li>,
          
          h1: ({ children }) => (
            <h1 className={`text-2xl font-bold mb-4 ${isDominator ? "text-red-300" : "text-purple-300"}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-xl font-bold mb-3 ${isDominator ? "text-red-300" : "text-purple-300"}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-lg font-bold mb-2 ${isDominator ? "text-red-300" : "text-purple-300"}`}>
              {children}
            </h3>
          ),
          
          code({ node, inline, className, children, ...props }) {
            if (inline) {
              return (
                <code 
                  className={`${isDominator ? "bg-red-900/20" : "bg-purple-900/20"} px-1 py-0.5 rounded ${
                    isDominator ? "text-yellow-200" : "text-purple-200"
                  }`} 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const codeText = String(children).replace(/\n$/, '');
            return <CodeBlock code={codeText} language={language} />;
          },
          
          img: ({ src, alt }) => {
            const imageMatch = src?.match(/^blob:.*$/);
            if (!imageMatch) return null;

            return (
              <div className="my-2 max-w-[300px]">
                <img 
                  src={src} 
                  alt={alt || 'Uploaded image'} 
                  className="w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src.startsWith('blob:')) {
                      URL.revokeObjectURL(img.src);
                    }
                    img.style.display = 'none';
                  }}
                />
              </div>
            );
          },
          
          strong: ({ children }) => (
            <strong className={isDominator ? "font-bold text-yellow-200" : "font-bold text-purple-200"}>
              {children}
            </strong>
          ),
          
          em: ({ children }) => (
            <em className={isDominator ? "italic text-red-300" : "italic text-purple-300"}>
              {children}
            </em>
          ),
          
          blockquote: ({ children }) => (
            <blockquote 
              className={`border-l-4 ${
                isDominator 
                  ? "border-red-500/50 text-red-200/80" 
                  : "border-purple-500/50 text-purple-200/80"
              } pl-4 my-4 italic`}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const renderMessageContent = (message: ChatMessagesProps['messages'][0]) => {
    const imageMatch = message.content.match(/!\[.*?\]\((blob:.*?)\)/);
    const textContent = message.content.replace(/!\[.*?\]\(blob:.*?\)\n*/g, '').trim();

    return (
      <>
        {imageMatch && (
          <div className="mb-2">
            <img 
              src={imageMatch[1]} 
              alt="Uploaded" 
              className="max-w-[300px] w-full h-auto rounded-lg shadow-lg"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src.startsWith('blob:')) {
                  URL.revokeObjectURL(img.src);
                }
                img.style.display = 'none';
              }}
            />
          </div>
        )}
        {textContent && renderMessage(textContent)}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={`w-8 h-8 animate-spin ${
            isDominator ? "text-red-500" : "text-purple-500"
          }`} />
          <p className={isDominator ? "text-red-400" : "text-purple-400"}>
            Loading messages...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {messages.map((message) => {
        const messageKey = message.id;
        
        if (message.role === 'user') {
          return (
            <div key={messageKey} className="flex justify-end">
              <div className={`max-w-[85%] md:max-w-[70%] rounded-xl px-4 py-3 text-sm message-content inline-block ${
                isDominator 
                  ? 'bg-red-900/20 text-white'
                  : 'bg-purple-900/20 text-white'
              } shadow-sm`}>
                {message.error ? (
                  <div className={`${isDominator ? "text-red-400" : "text-purple-400"} text-center`}>
                    Error: {message.content}
                  </div>
                ) : (
                  renderMessageContent(message)
                )}
              </div>
            </div>
          );
        }

        // Assistant messages without bubble
        return (
          <div key={messageKey} className="flex justify-start">
            <div className={`w-full md:max-w-[85%] px-4 py-3 text-sm message-content ${
              isDominator ? 'text-red-200' : 'text-purple-200'
            }`}>
              {message.error ? (
                <div className={`${isDominator ? "text-red-400" : "text-purple-400"} text-center`}>
                  Error: {message.content}
                </div>
              ) : (
                renderMessageContent(message)
              )}
              {message.isStreaming && (
                <div className="mt-2 flex items-center gap-2 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                    </div>
                  </div>
                  {thinkingMessage && <span className="italic">{thinkingMessage}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {thinkingStep && (
        <div className="flex items-center gap-2 text-gray-500 text-sm pl-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
          </div>
          <span className="italic">{thinkingStep}</span>
        </div>
      )}
    </div>
  );
}