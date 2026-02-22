import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  Search, 
  Send, 
  Sparkles, 
  Globe, 
  ArrowLeft,
  Settings,
  X
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { useLiveAPI } from './hooks/useLiveAPI';
import { generateChatResponse, generateSearchResponse, generateTTS, Message } from './services/gemini';
import { getGeminiApiKey, hasGeminiApiKey, setGeminiApiKey } from './lib/apiKey';

const VoiceVisualizer = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          animate={isActive ? {
            height: [8, Math.random() * 40 + 10, 8],
          } : { height: 8 }}
          transition={{
            repeat: Infinity,
            duration: 0.5 + Math.random() * 0.5,
            ease: "easeInOut"
          }}
          className="w-1 bg-orange-500/50 rounded-full"
        />
      ))}
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<'voice' | 'chat'>('voice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  
  const { 
    isConnected, 
    isRecording, 
    isSpeaking,
    aiTranscript, 
    startRecording, 
    stopRecording, 
    connect, 
    disconnect 
  } = useLiveAPI();

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setApiKeyInput(getGeminiApiKey());
  }, []);

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput);
    setApiKeyStatus(apiKeyInput.trim() ? 'API key saved in this browser.' : 'API key cleared.');
    if (isConnected) {
      disconnect();
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;
    if (!hasGeminiApiKey()) {
      setMessages(prev => [
        ...prev,
        { role: 'model', text: "Missing API key. Open Settings and add your Gemini API key." }
      ]);
      return;
    }

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      let responseText = '';
      let sources = [];

      if (useSearch) {
        try {
          const result = await generateSearchResponse(input);
          responseText = result.text;
          sources = result.sources;
        } catch {
          // Fall back to plain chat when Search grounding is unavailable.
          responseText = await generateChatResponse(input, messages);
        }
      } else {
        responseText = await generateChatResponse(input, messages);
      }

      const aiMessage: Message = { 
        role: 'model', 
        text: responseText,
        sources: sources 
      };
      setMessages(prev => [...prev, aiMessage]);

      if (ttsEnabled) {
        try {
          const audioBase64 = await generateTTS(responseText);
          if (audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
            audio.play();
          }
        } catch (ttsError) {
          console.error("TTS error:", ttsError);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const message = error instanceof Error ? error.message : "I'm sorry, I encountered an error. Please try again.";
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-orange-500/30 overflow-hidden relative">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 atmosphere" />
      </div>

      <AnimatePresence mode="wait">
        {mode === 'voice' ? (
          <motion.div
            key="voice"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-10 h-screen flex flex-col items-center justify-between p-8"
          >
            <header className="w-full flex justify-between items-center max-w-5xl">
              <div className="flex items-center gap-2">
                <Sparkles className="text-orange-500 w-6 h-6" />
                <span className="text-xl font-serif italic tracking-tight">Aura</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="glass px-3 py-2 rounded-full flex items-center gap-2 text-sm hover:bg-white/10 transition-colors"
                  title="API Key Settings"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button 
                  onClick={() => setMode('chat')}
                  className="glass px-4 py-2 rounded-full flex items-center gap-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <MessageSquare size={16} />
                  Switch to Chat
                </button>
              </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center gap-12 w-full max-w-2xl text-center">
              <div className="relative flex flex-col items-center gap-8">
                <VoiceVisualizer isActive={isRecording || isSpeaking} />
                <div className="relative">
                  <motion.div
                    animate={isRecording ? {
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    } : isSpeaking ? {
                      scale: [1, 1.1, 1],
                      opacity: [0.2, 0.4, 0.2],
                    } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-orange-500 rounded-full blur-3xl opacity-20"
                  />
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      "relative z-20 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
                      isRecording ? "bg-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.4)]" : "bg-white/5 hover:bg-white/10 border border-white/10"
                    )}
                  >
                    {isRecording ? <MicOff size={48} /> : <Mic size={48} />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-serif italic tracking-tighter">
                  {isRecording ? "I'm listening..." : isSpeaking ? "Aura is speaking" : "Tap to talk"}
                </h1>
                <p className="text-white/40 max-w-md mx-auto text-sm uppercase tracking-[0.2em]">
                  {isConnected ? "Real-time voice active" : "Ready for conversation"}
                </p>
              </div>

              {aiTranscript && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass p-6 rounded-3xl max-w-lg w-full text-left"
                >
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Aura</p>
                  <p className="text-lg leading-relaxed font-serif italic">{aiTranscript}</p>
                </motion.div>
              )}
            </main>

            <footer className="w-full max-w-5xl flex justify-center pb-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => isConnected ? disconnect() : connect()}
                  className="text-white/40 hover:text-white transition-colors text-xs uppercase tracking-widest"
                >
                  {isConnected ? "Disconnect" : "Initialize Session"}
                </button>
              </div>
            </footer>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 h-screen flex flex-col max-w-4xl mx-auto p-4 md:p-8"
          >
            <header className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setMode('voice')}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-xl font-serif italic">Aura Chat</h2>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Powered by Gemini 3.1 Pro</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-full text-white/40 hover:bg-white/5 hover:text-white transition-colors"
                  title="API Key Settings"
                >
                  <Settings size={20} />
                </button>
                <button 
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    ttsEnabled ? "text-orange-500 bg-orange-500/10" : "text-white/40 hover:bg-white/5"
                  )}
                  title="Toggle TTS"
                >
                  {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button 
                  onClick={() => setUseSearch(!useSearch)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    useSearch ? "text-blue-400 bg-blue-400/10" : "text-white/40 hover:bg-white/5"
                  )}
                  title="Toggle Search Grounding"
                >
                  <Globe size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto space-y-6 pr-4 scrollbar-hide">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <Sparkles size={48} className="text-orange-500" />
                  <p className="font-serif italic text-xl">How can I help you today?</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-3xl relative group",
                    msg.role === 'user' 
                      ? "bg-orange-500 text-white rounded-tr-none" 
                      : "glass rounded-tl-none"
                  )}>
                    <div className="markdown-body">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                          <Globe size={10} /> Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, idx) => (
                            source.web && (
                              <a 
                                key={idx} 
                                href={source.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors truncate max-w-[150px]"
                                title={source.web.title}
                              >
                                {source.web.title || source.web.uri}
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'model' && (
                      <button 
                        onClick={() => generateTTS(msg.text).then(b => b && new Audio(`data:audio/mp3;base64,${b}`).play())}
                        className="absolute -right-10 top-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white"
                      >
                        <Volume2 size={16} />
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-white/20 mt-2 px-2">
                    {msg.role === 'user' ? 'You' : 'Aura'}
                  </span>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-white/40 px-4">
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form 
              onSubmit={handleSendMessage}
              className="mt-6 relative"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={useSearch ? "Search with Aura..." : "Message Aura..."}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-white/20"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-2 top-2 bottom-2 w-10 bg-orange-500 rounded-xl flex items-center justify-center hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative w-full max-w-xl glass rounded-2xl p-6 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic">Gemini API Key</h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close settings"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-white/60 mt-3">
                Saved in browser local storage. For Vercel production, route Gemini calls through a server API.
              </p>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (apiKeyStatus) setApiKeyStatus('');
                }}
                placeholder="AIza..."
                className="w-full mt-4 bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
              {apiKeyStatus && (
                <p className="text-xs uppercase tracking-wider text-emerald-300 mt-3">{apiKeyStatus}</p>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveApiKey}
                  className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-4 py-2 text-sm transition-colors"
                >
                  Save Key
                </button>
                <button
                  onClick={() => {
                    setApiKeyInput('');
                    setGeminiApiKey('');
                    setApiKeyStatus('API key cleared.');
                    if (isConnected) {
                      disconnect();
                    }
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-2 text-sm transition-colors border border-white/10"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
