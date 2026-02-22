import { GoogleGenAI, Modality } from "@google/genai";
import { getGeminiApiKey } from "../lib/apiKey";

export const CHAT_MODEL = "gemini-2.5-flash";
export const SEARCH_MODEL = "gemini-2.5-flash";
export const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export interface Message {
  role: 'user' | 'model';
  text: string;
  isAudio?: boolean;
  sources?: any[];
}

function createAIClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Open Settings and add your API key.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function generateChatResponse(message: string, history: Message[] = []) {
  const ai = createAIClient();
  const chat = ai.chats.create({
    model: CHAT_MODEL,
    config: {
      systemInstruction: "You are Aura, a helpful and human-like AI assistant. You are empathetic, concise, and intelligent.",
    },
  });

  // Reconstruct history
  // Note: sendMessage only takes message, but we can initialize chat with history if needed.
  // For simplicity in this demo, we'll just send the message.
  const response = await chat.sendMessage({ message });
  return response.text;
}

export async function generateSearchResponse(query: string) {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: SEARCH_MODEL,
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return {
    text: response.text,
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
}

export async function generateTTS(text: string, voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Zephyr') {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
}

