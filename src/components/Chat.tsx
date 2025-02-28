import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { sendMessage } from '../lib/api';
import { sendVisionMessage } from '../lib/visionApi';
import { MatrixRain } from './MatrixRain';
import { SettingsModal } from './SettingsModal';
import Pricing from './Pricing';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
import { Sidebar } from './chat/Sidebar';
import { WelcomeScreen } from './chat/WelcomeScreen';
import { supabase } from '../lib/supabase';

export function Chat() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const { 
    tokens,
    isUltraMode,
    chats,
    activeChat,
    activeModel,
    createChat,
    getActiveChat,
    addMessageToChat,
    updateLastMessage,
    computingMetrics,
    updateComputingMetrics,
    isPricingOpen,
    setIsPricingOpen,
    loadUserChats,
    loadChatMessages,
    deleteChat
  } = useStore();
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const thinkingStepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeMessages = getActiveChat()?.messages || [];
  const isDominator = activeModel === 'dominator';

  useEffect(() => {
    loadUserChats();
  }, []);

  useEffect(() => {
    if (activeChat) {
      loadChatMessages(activeChat);
    }
  }, [activeChat]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, thinkingStep]);

  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  const updateMetrics = () => {
    updateComputingMetrics({
      codeAnalysis: Math.floor(Math.random() * 30) + 70,
      patternMatching: Math.floor(Math.random() * 40) + 60,
      processingSpeed: Math.floor(Math.random() * 5) + 5,
      neuralLoad: Math.floor(Math.random() * 30) + 70,
    });
  };

  const startMetricsUpdate = () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
    updateMetrics();
    metricsIntervalRef.current = setInterval(updateMetrics, 1000);
  };

  const stopMetricsUpdate = () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
    updateComputingMetrics({
      codeAnalysis: 0,
      patternMatching: 0,
      processingSpeed: 0,
      neuralLoad: 0,
    });
  };

  const handleNewChat = async () => {
    if (isLoading) return;
    await createChat(activeModel);
    setIsLoading(false);
  };

  const simulateThinkingSteps = async (input: string) => {
    const steps = [
      `Analyzing input: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`,
      "Processing context and requirements...",
      "Identifying key components and patterns...",
      "Formulating comprehensive response...",
    ];

    for (const step of steps) {
      if (thinkingStepTimeoutRef.current) {
        clearTimeout(thinkingStepTimeoutRef.current);
      }
      
      setThinkingStep(step);
      await new Promise(resolve => {
        thinkingStepTimeoutRef.current = setTimeout(resolve, 800);
      });
    }
    
    setThinkingStep('');
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setImageUrl(blobUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('🔍 DEBUG: Starting handleSubmit');

      if (!input.trim() && !imageUrl) {
        console.log('❌ DEBUG: No input or image provided');
        return;
      }
      if (tokens <= 0) {
        console.log('❌ DEBUG: No tokens available');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('❌ DEBUG: No authenticated user');
        return;
      }

      let chatId = activeChat;
      let isNewChat = false;

      if (!chatId) {
        console.log('🔍 DEBUG: Creating new chat');
        chatId = await createChat(activeModel);
        isNewChat = true;
      }

      const currentImageUrl = imageUrl;

      // Set loading state before any async operations
      setIsLoading(true);

      if (isUltraMode && isDominator) {
        startMetricsUpdate();
      }

      const userMessage = {
        id: `${Date.now()}-user`,
        content: currentImageUrl 
          ? `![Uploaded Image](${currentImageUrl})\n\n${input.trim()}`
          : input.trim(),
        role: 'user' as const
      };
      
      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        content: '',
        role: 'assistant' as const,
        isStreaming: true
      };

      console.log('🔍 DEBUG: Adding messages to chat');
      await addMessageToChat(chatId, userMessage);
      await addMessageToChat(chatId, assistantMessage);
      scrollToBottom();
      
      // Deduct tokens using RPC function
      const tokenCost = isDominator 
        ? isUltraMode ? 4 : 2
        : 1;
      
      const { error: deductError } = await supabase.rpc('deduct_user_tokens', {
        p_user_id: user.id,
        p_amount: tokenCost,
        p_reason: 'usage'
      });

      if (deductError) {
        console.error('❌ DEBUG: Error deducting tokens:', deductError);
        throw new Error('Failed to deduct tokens');
      }

      // Clear input and image after successful message addition
      setInput('');
      setImageUrl(null);

      try {
        if (isUltraMode && isDominator) {
          await simulateThinkingSteps(input);
        }

        console.log('🔍 DEBUG: Sending message to API');
        if (isDominator) {
          await sendMessage(
            input,
            (text) => {
              updateLastMessage(chatId, text);
            },
            null, // No abort controller needed
            chatId,
            currentImageUrl
          );
        } else {
          await sendVisionMessage(
            input,
            currentImageUrl,
            (text) => {
              updateLastMessage(chatId, text);
            },
            null, // No abort controller needed
            chatId
          );
        }
        console.log('✅ DEBUG: Message sent successfully');
      } catch (error: any) {
        console.error('❌ DEBUG: Error sending message:', error);
        
        // Clear the streaming message and add error
        updateLastMessage(chatId, '');
        await addMessageToChat(chatId, {
          id: `${Date.now()}-error`,
          content: error instanceof Error ? error.message : 'An error occurred',
          role: 'assistant',
          error: true
        });

        // If this was a new chat that failed, clean it up
        if (isNewChat) {
          await deleteChat(chatId);
        }
      } finally {
        setIsLoading(false);
        setThinkingStep('');
        stopMetricsUpdate();

        // Clean up image URL
        if (currentImageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(currentImageUrl);
        }
      }
    } catch (error) {
      console.error('❌ DEBUG: Error in handleSubmit:', error);
      // Reset all states and clean up on error
      setIsLoading(false);
      setThinkingStep('');
      stopMetricsUpdate();
      setInput('');
      setImageUrl(null);
    }
  };

  return (
    <div className={`flex h-screen bg-[var(--bg-dark)] ${isUltraMode && isDominator ? 'ultra-active' : ''}`}>
      <MatrixRain ultraMode={isUltraMode && isDominator} />
      {isUltraMode && isDominator && (
        <>
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </>
      )}
      <div className="flex w-full">
        <Sidebar 
          isLoading={isLoading}
          handleNewChat={handleNewChat}
        />

        <div className="flex-1 flex flex-col">
          <ChatHeader />

          <div ref={messagesContainerRef} className="messages-container">
            {activeMessages.length === 0 ? (
              activeChat?.isLoading ? (
                <ChatMessages 
                  messages={[]}
                  thinkingStep=""
                  isLoading={true}
                />
              ) : (
                <WelcomeScreen />
              )
            ) : (
              <ChatMessages 
                messages={activeMessages}
                thinkingStep={thinkingStep}
                isLoading={activeChat?.isLoading}
              />
            )}
          </div>

          <ChatInput
            input={input}
            setInput={setInput}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            isLoading={isLoading}
            isDragging={isDragging}
            handleSubmit={handleSubmit}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleImageUpload={handleImageUpload}
          />
        </div>
      </div>
      <SettingsModal />
      {isPricingOpen && <Pricing onClose={() => setIsPricingOpen(false)} />}
    </div>
  );
}