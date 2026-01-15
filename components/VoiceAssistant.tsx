import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Activity, WifiOff, Play, MessageSquare, ArrowRight, Save } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import UniversalLoader from './UniversalLoader';
import { ChatMessage } from '../types';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
  onUpdateText: (newText: string) => void;
}

// Audio helpers
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output.buffer;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose, initialContext, onUpdateText }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [minLoadTimePassed, setMinLoadTimePassed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioContextSuspended, setAudioContextSuspended] = useState(false);
  
  // Chat History State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const sessionRef = useRef<any>(null);

  // Connection Lifecycle
  useEffect(() => {
    let loadTimer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      // Reset states
      setError(null);
      setMinLoadTimePassed(false);
      setIsConnected(false);
      setAudioContextSuspended(false);
      setChatHistory([{
        id: 'init',
        role: 'system',
        text: 'Iniciando protocolo de voz Tatiana v2.5...',
        timestamp: new Date()
      }]);
      
      // Initialize Audio Context IMMEDIATELY (while we have the user gesture token from the click)
      initAudioContext();

      // Start minimum load timer (visual only)
      loadTimer = setTimeout(() => {
        setMinLoadTimePassed(true);
      }, 2000);

      // Connect
      connectToLive();
    }

    return () => {
      clearTimeout(loadTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const initAudioContext = async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setAudioContextSuspended(false);
    } catch (e) {
      console.warn("Audio Context Initial Suspend:", e);
      setAudioContextSuspended(true);
    }
  };

  // Connect to Gemini Live
  const connectToLive = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const updateDraftTool: FunctionDeclaration = {
        name: 'update_draft',
        description: 'Updates the text/document visible to the user with the new agreed upon content.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            new_text: {
              type: Type.STRING,
              description: 'The full, updated text content to replace the current draft.',
            },
          },
          required: ['new_text'],
        },
      };

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          tools: [{ functionDeclarations: [updateDraftTool] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            You are Tatiana, a highly professional, sophisticated executive assistant created by Latin Grammy members.
            
            CRITICAL INSTRUCTION:
            1. YOU MUST SPEAK IMMEDIATELY upon connection.
            2. GREET THE USER IN SPANISH: "Hola, soy Tatiana. Estoy lista para trabajar en tu carta."
            3. Act as a "Professional Electrician of Words".
            4. Keep responses concise and professional.
            
            Current Draft Context: "${initialContext?.substring(0, 1000) || '(Empty)'}..."
          `,
        },
      };

      const session = await ai.live.connect({
        ...config,
        callbacks: {
          onopen: async () => {
            console.log("Tatiana Live Session Opened");
            setIsConnected(true);
            setIsConnecting(false);
            
            // 1. Start Microphone
            await startAudioInput(session);

            // 2. FORCE MODEL TO SPEAK: Send a hidden text prompt to wake it up
            // Using a generic content part to trigger response
            try {
               session.send({ parts: [{ text: "Hello Tatiana, introduce yourself in Spanish now." }], turnComplete: true });
            } catch(e) {
               console.log("Could not send initial wake up message, relying on system instruction.", e);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle interruptions
             if (message.serverContent?.interrupted) {
               stopAllAudio();
               nextStartTimeRef.current = 0;
               return;
             }

             // Handle Tool Calls
             if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === 'update_draft') {
                    const newText = (fc.args as any).new_text;
                    onUpdateText(newText);
                    setChatHistory(prev => [...prev, {
                      id: Date.now().toString(),
                      role: 'system',
                      text: 'Document updated successfully.',
                      timestamp: new Date()
                    }]);
                    session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Success" }
                      }
                    });
                  }
                }
             }

             // Handle Audio Output
             if (message.serverContent?.modelTurn) {
               const audioData = message.serverContent.modelTurn.parts?.[0]?.inlineData?.data;
               if (audioData) {
                 playAudioChunk(audioData);
               }
             }
             
             // Handle Transcriptions
             const serverContent = message.serverContent as any;
             if (serverContent?.outputTranscription?.text) {
                updateChatHistory('assistant', serverContent.outputTranscription.text);
             }
             if (serverContent?.inputTranscription?.text) {
                 updateChatHistory('user', serverContent.inputTranscription.text);
             }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Live Error", err);
            setError("Connection Error. Please retry.");
            setIsConnecting(false);
            cleanup();
          }
        }
      });
      sessionRef.current = session;
    } catch (error) {
      console.error("Connection Failed", error);
      setError("Server Connection Failed");
      setIsConnecting(false);
      cleanup();
    }
  };

  const updateChatHistory = (role: 'user' | 'assistant', text: string) => {
    setChatHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, {
        id: Date.now().toString(),
        role: role,
        text: text,
        timestamp: new Date()
      }];
    });
  };

  const startAudioInput = async (session: any) => {
    try {
      // Ensure context is ready
      if (!audioContextRef.current) {
         initAudioContext();
      }
      if (audioContextRef.current!.state === 'suspended') {
        await audioContextRef.current!.resume();
        setAudioContextSuspended(false);
      }

      const actualSampleRate = audioContextRef.current!.sampleRate;
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        } 
      });
      
      inputSourceRef.current = audioContextRef.current!.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Visualizer data
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolumeLevel(Math.sqrt(sum / inputData.length) * 100);

        const pcm16 = floatTo16BitPCM(inputData);
        const uint8 = new Uint8Array(pcm16);
        
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);

        session.sendRealtimeInput({
          media: {
            mimeType: `audio/pcm;rate=${actualSampleRate}`,
            data: base64Data
          }
        });
      };

      const muteNode = audioContextRef.current!.createGain();
      muteNode.gain.value = 0;

      inputSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(muteNode);
      muteNode.connect(audioContextRef.current!.destination);

    } catch (err) {
      console.error("Audio Input Error", err);
      setError("Microphone Access Failed");
    }
  };

  const handleManualResume = async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.resume();
      setAudioContextSuspended(false);
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      const audioBytes = base64ToUint8Array(base64Audio);
      const dataInt16 = new Int16Array(audioBytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      source.onended = () => {
        sourcesRef.current = sourcesRef.current.filter(s => s !== source);
      };
      
      sourcesRef.current.push(source);

    } catch (err) {
      console.error("Playback error", err);
    }
  };

  const stopAllAudio = () => {
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current = [];
  };

  const cleanup = () => {
    stopAllAudio();
    setIsConnected(false);
    setIsConnecting(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sessionRef.current = null;
    setVolumeLevel(0);
  };

  if (!isOpen) return null;

  const showLoader = !minLoadTimePassed || (isConnecting && !error);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950 border-l border-blue-900/50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {showLoader ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
             <UniversalLoader onComplete={() => {}} message="Initializing Tatiana OS" />
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-slate-900 bg-slate-950/50 backdrop-blur flex justify-between items-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
               <div>
                  <h2 className="text-xl font-bold text-white tracking-widest tech-font flex items-center gap-2">
                    TATIANA <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">V2.5 LIVE</span>
                  </h2>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
                    {error ? 'CONNECTION ERROR' : 'VOICE CHANNEL ACTIVE'}
                  </div>
               </div>
               <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                 <X className="w-6 h-6" />
               </button>
            </div>

            {error && (
               <div className="bg-red-900/20 p-4 border-b border-red-900/50 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-red-300 text-xs">
                   <WifiOff className="w-4 h-4" />
                   <span>{error}</span>
                 </div>
                 <button onClick={() => connectToLive()} className="text-xs text-white underline">Retry</button>
               </div>
            )}

            {audioContextSuspended && !error && (
               <button onClick={handleManualResume} className="bg-blue-900/20 p-4 border-b border-blue-900/50 flex items-center justify-center gap-2 text-blue-300 text-xs hover:bg-blue-900/30 transition-colors w-full animate-pulse">
                 <Play className="w-4 h-4" />
                 <span>TAP TO ACTIVATE AUDIO SPEAKERS</span>
               </button>
            )}

            <div className="h-32 flex items-center justify-center bg-slate-900/30 border-b border-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500 rounded-full blur-[80px]"></div>
                </div>
                <div className="relative z-10 flex items-end gap-1 h-12">
                   {[...Array(20)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${Math.max(10, Math.random() * volumeLevel * 2)}%`,
                          opacity: volumeLevel > 1 ? 1 : 0.3
                        }}
                      ></div>
                   ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-800">
               {chatHistory.length === 0 && (
                 <div className="text-center text-slate-600 text-sm mt-10">
                   <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                   <p>Connecting to Universal Music Servers...</p>
                 </div>
               )}
               {chatHistory.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                       msg.role === 'user' 
                         ? 'bg-blue-600 text-white rounded-br-none' 
                         : msg.role === 'system'
                           ? 'bg-slate-800/50 text-slate-400 text-xs font-mono border border-slate-800 w-full text-center'
                           : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}>
                       {msg.role === 'assistant' && (
                         <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase tracking-wider">Tatiana</div>
                       )}
                       {msg.text}
                    </div>
                 </div>
               ))}
               <div ref={chatEndRef} />
            </div>

            <div className="p-6 bg-slate-950 border-t border-slate-900">
               <div className="flex items-center justify-center gap-6">
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    disabled={!!error}
                    className={`p-4 rounded-full border transition-all ${isMuted ? 'bg-red-900/20 border-red-500 text-red-500' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 shadow-lg'} ${error ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
                  <div className="text-center">
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Status</div>
                     <div className="text-xs text-blue-400 font-mono flex items-center gap-2">
                        {isMuted ? 'MIC MUTED' : 'LISTENING'}
                     </div>
                  </div>
               </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default VoiceAssistant;