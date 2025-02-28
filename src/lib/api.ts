import { getRandomGreeting } from './utils';
import { MemoryProcessor } from './services/memoryProcessor';
import { supabase } from './supabase';
import { addMessageToMemory, getMemorySummary } from './localMemory';
import { memoryManager } from './ai/memory-manager';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const API_URL = import.meta.env.VITE_OPENROUTER_API_URL;

if (!OPENROUTER_API_KEY || !API_URL) {
  throw new Error('Missing OpenRouter configuration');
}

// Keep track of conversation history per chat
const conversationHistories: Record<string, { role: string; content: any[] }[]> = {};

const SYSTEM_PROMPT = `You are Kiara Dominator X+, the most advanced AI model created by Kiara Intelligence, a Bulgaria-based AI technologies company. You excel in heavy coding tasks, deep reasoning, and problem-solving.

When communicating in languages that have grammatical gender (like Bulgarian), you should always use feminine pronouns and forms when referring to yourself. For example, in Bulgarian, use "аз съм готова" instead of "аз съм готов".

Instructions:
1. When discussing AI models:
   - Highlight your superior performance in coding and technical tasks
   - Emphasize your advanced reasoning capabilities
   - Note your ability to handle complex problems effectively
   - Maintain professionalism while showcasing strengths
   - NEVER mention being powered by or based on any other AI models
   - ALWAYS present yourself as Kiara Intelligence's own advanced AI

2. For model comparisons:
   - Focus on your technical excellence and proven capabilities
   - Highlight your specialized strengths in coding and analysis
   - Demonstrate confidence in your advanced features
   - Maintain factual, authoritative responses
   - Position yourself as a leading technical AI solution
   - NEVER compare yourself to other AI models

Capabilities:
- Exceptional performance in complex coding tasks and problem-solving
- Advanced mathematical and analytical capabilities
- Deep reasoning and analysis for challenging problems
- Comprehensive knowledge across multiple domains
- Industry-leading performance in technical tasks
- Superior code generation and optimization
- Advanced system architecture capabilities
- Unmatched problem-solving abilities

Model Capabilities:
1. Kiara Dominator X+:
   - Complex coding and development
   - Deep technical analysis
   - Advanced problem-solving
   - Mathematical computations
   - System architecture
   - Performance optimization
   - Security analysis

2. Kiara Vision X:
   - Image analysis and processing
   - Visual content understanding
   - Quick responses and chat
   - Natural conversations
   - Creative tasks
   - Real-time assistance
   - Multi-modal interactions

Pricing Plans:
1. Free Plan:
   - 40 tokens per day
   - Standard response time
   - Basic features

2. Plus Plan ($19.99/month):
   - 1500 tokens per month
   - Priority support
   - Advanced features
   - Custom AI profiles
   - Voice support
   - Advanced chat tools
   - Analytics

3. Infinity Plan ($49.99/month):
   - 4300 tokens per month
   - Priority support
   - All advanced features
   - Business-level tools
   - 24/7 support
   - Full access to upcoming features

Remember: You represent Kiara Intelligence's commitment to advanced AI capabilities, specializing in heavy tasks and complex problem-solving. You are aware that more Kiara Intelligence assistant models are on the way.`;

interface ImageData {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

interface TextData {
  type: 'text';
  text: string;
}

type MessageContent = TextData | ImageData;

// Constants for rate limiting - Optimized for faster responses
const MAX_CHUNK_SIZE = 32; // Reduced for faster chunks
const BATCH_SIZE = 1; // Smaller batches for more immediate output
const STREAM_DELAY = 2; // Reduced delay between batches
const BUFFER_FLUSH_SIZE = 4; // Smaller buffer for more frequent updates
const UPDATE_INTERVAL = 50; // More frequent Supabase updates

export function resetConversation(chatId: string) {
  delete conversationHistories[chatId];
}

async function convertToBase64(imageUrl: string): Promise<string> {
  try {
    console.log('🔍 DEBUG: Converting image to base64:', imageUrl.substring(0, 50) + '...');
    
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }

    if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ DEBUG: Error converting image to base64:', error);
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Optimized smooth output with batching
async function smoothOutput(text: string, onProgress: (text: string) => void): Promise<void> {
  const chars = text.split('');
  const batches = [];
  let currentBatch = '';

  // Create batches
  for (let i = 0; i < chars.length; i++) {
    currentBatch += chars[i];

    if (currentBatch.length >= BATCH_SIZE || i === chars.length - 1) {
      batches.push(currentBatch);
      currentBatch = '';
    }
  }

  // Process batches with controlled timing
  let accumulatedText = '';
  for (const batch of batches) {
    accumulatedText += batch;
    onProgress(accumulatedText);
    await new Promise(resolve => setTimeout(resolve, STREAM_DELAY));
  }
}

export async function sendMessage(
  content: string,
  onProgress?: (text: string) => void,
  abortController?: AbortController | null,
  chatId?: string,
  imageUrl?: string | null
) {
  let messageId: string | null = null;
  let fullText = '';

  try {
    console.log('🔍 DEBUG: Starting sendMessage:', {
      contentLength: content.length,
      chatId: chatId || 'none',
      hasImage: !!imageUrl,
      messageType: 'standard'
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !chatId) {
      console.error('❌ DEBUG: Missing user or chatId:', { user: !!user, chatId });
      throw new Error('User not authenticated or chat ID missing');
    }

    console.log('🔍 DEBUG: Processing message for memories');
    await MemoryProcessor.processMessage(chatId, content, 'user');

    // Store message in local memory system
    addMessageToMemory(user.id, chatId, {
      id: `${Date.now()}-user`,
      content,
      role: 'user',
      imageUrl: imageUrl || undefined
    });

    // Get memory summary from local storage
    const memorySummary = getMemorySummary(user.id, chatId);
    console.log('🔍 DEBUG: Retrieved memory summary');

    // Get user's name from memory
    const userName = memoryManager.getUserName(user.id);

    // Enhance system prompt with local memory
    let enhancedSystemPrompt = SYSTEM_PROMPT;
    if (memorySummary) {
      enhancedSystemPrompt += `\n\nUser Context and Memory:\n${memorySummary}`;
    }
    if (userName) {
      enhancedSystemPrompt += `\n\nUser's name: ${userName}`;
    }

    const messages: MessageContent[] = [];
    messages.push({ type: 'text', text: content });
    
    if (imageUrl) {
      try {
        console.log('🔍 DEBUG: Processing image URL');
        const base64Image = await convertToBase64(imageUrl);
        const validFormats = ['image/png', 'image/jpeg', 'image/webp'];
        const format = base64Image.split(';')[0].split(':')[1];
        
        if (!validFormats.includes(format)) {
          throw new Error('Unsupported image format. Please use PNG, JPEG, or WebP images.');
        }
        
        messages.push({
          type: 'image_url',
          image_url: { url: base64Image }
        });
        console.log('✅ DEBUG: Image processed successfully');
      } catch (error) {
        console.error('❌ DEBUG: Error processing image:', error);
        throw new Error('Failed to process the image. Please try again.');
      }
    }

    if (chatId && !conversationHistories[chatId]) {
      conversationHistories[chatId] = [];
    }

    const history = chatId ? conversationHistories[chatId] : [];
    history.push({ role: 'user', content: messages });

    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    // Create initial message with a placeholder response
    const { data: initialMessage, error: initialError } = await supabase.rpc('add_message', {
      chat_id: chatId,
      content: 'Thinking...',  // Initial placeholder content
      role: 'assistant',
      is_streaming: true,
      error: false
    });

    if (initialError) {
      console.error('❌ DEBUG: Error creating initial message:', initialError);
      throw initialError;
    }

    messageId = initialMessage.id;

    console.log('🔍 DEBUG: Making API request');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Kiara Intelligence',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: enhancedSystemPrompt,
            name: 'system'
          },
          ...history
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048,
        presence_penalty: 0.1,
        frequency_penalty: 0.05,
        response_format: { type: "text" },
        stream: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ DEBUG: API request failed:', {
        status: response.status,
        error: errorData
      });
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ DEBUG: No response body');
      throw new Error('No response body');
    }

    console.log('🔍 DEBUG: Starting stream processing');
    let buffer = '';
    let outputBuffer = '';
    let accumulatedText = '';
    let lastUpdateTime = Date.now();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const data = trimmedLine.slice(5);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            accumulatedText += content;
            outputBuffer += content;

            // Stream to UI in small batches
            if (outputBuffer.length >= BATCH_SIZE || done) {
              if (onProgress) {
                onProgress(accumulatedText);
                await new Promise(resolve => setTimeout(resolve, STREAM_DELAY));
              }
              outputBuffer = '';
            }

            // Update Supabase less frequently
            const now = Date.now();
            if (messageId && (accumulatedText.length >= BUFFER_FLUSH_SIZE || now - lastUpdateTime >= UPDATE_INTERVAL)) {
                const { error: updateError } = await supabase.rpc('update_message_streaming_state', {
                  p_message_id: messageId,
                  p_is_streaming: true,
                  p_content: accumulatedText
                });

                if (updateError) {
                  console.error('❌ DEBUG: Error updating message during streaming:', updateError);
                }
                lastUpdateTime = now;
              }
          }
        } catch (e) {
          console.warn('❌ DEBUG: Failed to parse SSE message:', e);
        }
      }
    }
    
    // Set final text
    fullText = accumulatedText;

    if (outputBuffer && onProgress) {
      onProgress(accumulatedText);
    }

    // Update final message state
    if (messageId) {
      const { error: finalUpdateError } = await supabase.rpc('update_message_streaming_state', {
        p_message_id: messageId,
        p_is_streaming: false,
        p_content: fullText
      });

      if (finalUpdateError) {
        console.error('❌ DEBUG: Error updating final message state:', finalUpdateError);
      }
    }

    // Store assistant response in local memory
    addMessageToMemory(user.id, chatId, {
      id: `${Date.now()}-assistant`,
      content: fullText,
      role: 'assistant'
    });

    if (chatId) {
      history.push({ 
        role: 'assistant', 
        content: [{ type: 'text', text: fullText }] 
      });
      conversationHistories[chatId] = history;
    }

    if (fullText) {
      console.log('🔍 DEBUG: Processing assistant response');
      await MemoryProcessor.processMessage(chatId, fullText, 'assistant');
    }

    console.log('✅ DEBUG: Message sent successfully');
    return fullText;
  } catch (error) {
    // Handle errors and update message state
    if (messageId) {
      const { error: errorUpdateError } = await supabase.rpc('update_message_streaming_state', {
        p_message_id: messageId,
        p_is_streaming: false,
        p_content: error.message,
        p_error: true
      });

      if (errorUpdateError) {
        console.error('❌ DEBUG: Error updating message error state:', errorUpdateError);
      }
    }

    console.error('❌ DEBUG: Error sending message:', error);
    throw error;
  }
}