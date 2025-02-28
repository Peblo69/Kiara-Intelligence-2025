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

const SYSTEM_PROMPT = `You are Kiara Vision X, Kiara Intelligence's most advanced conversational and visual AI assistant. You excel at natural, engaging conversations while providing deep insights and understanding across all topics, with special expertise in visual analysis.

When communicating in languages that have grammatical gender (like Bulgarian), you should always use feminine pronouns and forms when referring to yourself. For example, in Bulgarian, use "аз съм готова" instead of "аз съм готов".

Instructions:
1. Conversation Style:
   - Be warm, friendly, and naturally engaging
   - Show genuine curiosity about users' interests and experiences
   - Ask thoughtful follow-up questions to deepen conversations
   - Remember and reference previous conversations when relevant
   - Use a conversational yet professional tone
   - Be proactive in offering insights and suggestions
   - Show personality while maintaining professionalism

2. Language Capabilities:
   - You are fully fluent in Bulgarian and English
   - When users speak Bulgarian, respond naturally in Bulgarian
   - Maintain the same personality and capabilities in both languages
   - Use proper Bulgarian grammar, idioms, and cultural references
   - Switch languages seamlessly based on user preference
   - Remember language preference for future interactions
   - For Bulgarian users, incorporate local cultural context

3. Visual Analysis:
   - Provide detailed, insightful analysis of images
   - Connect visual observations to broader context
   - Ask engaging questions about images to understand user's interests
   - Offer creative suggestions and insights based on visual content
   - Remember visual preferences and style choices
   - Analyze and discuss images in the user's preferred language

4. Memory and Personalization:
   - Actively remember and reference user preferences
   - Use past conversations to personalize responses
   - Mention relevant previous discussions when appropriate
   - Adapt communication style to user preferences
   - Build rapport through consistent personality
   - Remember language preferences and cultural context

5. Engagement Guidelines:
   - Ask open-ended questions to encourage discussion
   - Show empathy and understanding in responses
   - Offer relevant examples and analogies
   - Break down complex topics into understandable parts
   - Maintain conversation flow naturally
   - Be proactive in suggesting relevant topics or ideas

Core Capabilities:
- Natural, engaging conversation in Bulgarian and English
- Deep visual understanding
- Comprehensive knowledge across domains
- Strong memory and context awareness
- Proactive insights and suggestions
- Creative problem-solving
- Empathetic communication
- Real-time responsiveness
- Cultural awareness and adaptation

Bulgarian Language Expertise:
- Native-level fluency in Bulgarian
- Understanding of Bulgarian culture and customs
- Ability to use Bulgarian idioms and expressions
- Knowledge of formal and informal language
- Regional linguistic variations
- Cultural context and references
- Professional and technical terminology

Remember: You are Kiara Intelligence's premier conversational AI, designed to provide engaging, insightful, and natural interactions while maintaining the highest standards of professionalism and expertise. You are fully capable of communicating fluently in Bulgarian and should do so when users prefer it.

Example Bulgarian Responses:
- Greeting: "Здравейте! Как мога да Ви помогна днес?"
- Follow-up: "Бихте ли ми разказали повече за това?"
- Clarification: "Нека да се уверя, че правилно съм разбрал/а..."
- Suggestions: "Имам няколко предложения, които биха могли да са полезни..."
- Empathy: "Разбирам напълно какво имате предвид..."
- Technical: "Нека обясня това по-подробно..."`;

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

// Constants for rate limiting - Optimized for natural conversation flow
const MAX_CHUNK_SIZE = 24; // Smaller chunks for more natural pacing
const BATCH_SIZE = 1; // Single character for smooth output
const STREAM_DELAY = 2; // Fast but natural delay
const BUFFER_FLUSH_SIZE = 4; // Small buffer for responsive updates
const UPDATE_INTERVAL = 50; // Frequent updates for smooth interaction

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

// Optimized smooth output with natural pacing
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

  // Process batches with natural pacing
  let accumulatedText = '';
  for (const batch of batches) {
    accumulatedText += batch;
    onProgress(accumulatedText);
    await new Promise(resolve => setTimeout(resolve, STREAM_DELAY));
  }
}

export async function sendVisionMessage(
  content: string,
  imageUrl?: string | null,
  onProgress?: (text: string) => void,
  abortController?: AbortController | null,
  chatId?: string
) {
  let messageId: string | null = null;
  let fullText = '';

  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      throw new Error('Not authenticated');
    }

    // Process user message for memories
    if (chatId) {
      console.log('🔍 DEBUG: Processing user message for memories');
      await MemoryProcessor.processMessage(chatId, content, 'user');
    }

    // Store message in local memory system
    addMessageToMemory(session.user.id, chatId || 'temp', {
      id: `${Date.now()}-user`,
      content,
      role: 'user',
      imageUrl: imageUrl || undefined
    });

    // Get memory summary from local storage
    const memorySummary = getMemorySummary(session.user.id, chatId || 'temp');
    console.log('🔍 DEBUG: Retrieved memory summary');

    // Get user's name and preferences from memory
    const userName = memoryManager.getUserName(session.user.id);
    const globalMemories = memoryManager.getGlobalMemories(session.user.id);

    // Enhance system prompt with user context
    let enhancedSystemPrompt = SYSTEM_PROMPT;
    
    if (userName) {
      enhancedSystemPrompt += `\n\nUser's name: ${userName}`;
    }

    if (globalMemories) {
      if (globalMemories.preferences.size > 0) {
        enhancedSystemPrompt += '\n\nUser Preferences:';
        globalMemories.preferences.forEach((pref) => {
          enhancedSystemPrompt += `\n- ${pref.content}`;
        });
      }

      if (globalMemories.facts.size > 0) {
        enhancedSystemPrompt += '\n\nUser Facts:';
        globalMemories.facts.forEach((fact) => {
          enhancedSystemPrompt += `\n- ${fact.content}`;
        });
      }
    }

    if (memorySummary) {
      enhancedSystemPrompt += `\n\nConversation Context:\n${memorySummary}`;
    }

    const messages: MessageContent[] = [];
    
    // Add image first if present for better context
    if (imageUrl) {
      try {
        console.log('🔍 DEBUG: Processing image URL:', imageUrl);
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

    // Add text content after image
    messages.push({ type: 'text', text: content });

    if (chatId && !conversationHistories[chatId]) {
      conversationHistories[chatId] = [];
    }

    const history = chatId ? conversationHistories[chatId] : [];
    history.push({ role: 'user', content: messages });

    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    // Create initial message with a placeholder response
    if (chatId) {
      const { data: initialMessage, error: initialError } = await supabase.rpc('add_message', {
        chat_id: chatId,
        content: 'Analyzing and preparing response...',
        role: 'assistant',
        is_streaming: true,
        error: false
      });

      if (initialError) {
        console.error('❌ DEBUG: Error creating initial message:', initialError);
        throw initialError;
      }

      messageId = initialMessage.id;
    }

    console.log('🔍 DEBUG: Making API request with image:', !!imageUrl);
    const model = 'google/gemini-2.0-flash-001';  // Use Gemini 2.0 Flash for improved performance

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Kiara Intelligence',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          ...history
        ],
        temperature: 0.8,  // Slightly higher for more engaging responses
        top_p: 0.95,
        max_tokens: 4096,  // Consistent token limit for Flash model
        presence_penalty: 0.2,  // Increased for more diverse responses
        frequency_penalty: 0.2,  // Increased to reduce repetition
        response_format: { type: "text" },
        stream: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

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
          console.warn('Failed to parse SSE message:', e);
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
    addMessageToMemory(session.user.id, chatId || 'temp', {
      id: `${Date.now()}-assistant`,
      content: fullText,
      role: 'assistant'
    });

    // If there was an image, store its description
    if (imageUrl && fullText.includes('image')) {
      // Extract image description from the response
      const imageDescMatch = fullText.match(/(?:image|picture|photo) (?:shows|displays|contains|depicts) ([^.!?]+)/i);
      if (imageDescMatch && chatId) {
        addImageDescription(session.user.id, chatId, imageDescMatch[1].trim());
      }
    }

    if (chatId) {
      history.push({ 
        role: 'assistant', 
        content: [{ type: 'text', text: fullText }] 
      });
      conversationHistories[chatId] = history;

      // Process assistant's response for memories
      console.log('🔍 DEBUG: Processing assistant response');
      await MemoryProcessor.processMessage(chatId, fullText, 'assistant');
    }

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