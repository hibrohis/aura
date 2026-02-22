import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getGeminiApiKey } from '../lib/apiKey';

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

export function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueue = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const stopAudio = useCallback(() => {
    audioQueue.current = [];
    isPlayingRef.current = false;
    // In a real app, we'd stop the current source node if playing
  }, []);

  const playNextChunk = useCallback(() => {
    if (audioQueue.current.length === 0) {
      setIsSpeaking(false);
      return;
    }
    if (isPlayingRef.current) return;

    const ctx = audioContextRef.current;
    if (!ctx) return;

    setIsSpeaking(true);
    isPlayingRef.current = true;
    const chunk = audioQueue.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  }, []);

  const connect = useCallback(async () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Missing Gemini API key. Open Settings and add your API key.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => {
          setIsConnected(true);
          console.log("Live API connected");
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            // Convert PCM16 to Float32
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              float32[i] = pcm16[i] / 32768.0;
            }
            audioQueue.current.push(float32);
            playNextChunk();
          }

          if (message.serverContent?.interrupted) {
            stopAudio();
          }

          if (message.serverContent?.modelTurn?.parts[0]?.text) {
             setAiTranscript(prev => prev + message.serverContent?.modelTurn?.parts[0]?.text);
          }
        },
        onclose: () => {
          setIsConnected(false);
          setIsRecording(false);
        },
        onerror: (err) => {
          console.error("Live API error:", err);
          setIsConnected(false);
        }
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are Aura, a helpful and human-like AI assistant. You are empathetic, concise, and intelligent. Speak naturally. You have access to Google Search to provide up-to-date information.",
      },
    });

    sessionRef.current = session;
  }, [playNextChunk, stopAudio]);

  const startRecording = useCallback(async () => {
    try {
      setAiTranscript(""); // Clear previous transcript
      if (!isConnected) await connect();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  }, [connect, isConnected]);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsRecording(false);
  }, []);

  const disconnect = useCallback(() => {
    stopRecording();
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsConnected(false);
  }, [stopRecording]);

  return {
    isConnected,
    isRecording,
    isSpeaking,
    transcript,
    aiTranscript,
    startRecording,
    stopRecording,
    connect,
    disconnect
  };
}

