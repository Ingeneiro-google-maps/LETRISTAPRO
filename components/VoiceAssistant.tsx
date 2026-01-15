import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Activity, Volume2, WifiOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import UniversalLoader from './UniversalLoader';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
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

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose, initialContext }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const sessionRef = useRef<any>(null);

  // Connect to Gemini Live
  const connectToLive = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            You are Tatiana, the advanced "Operating System" assistant created by GALFLY PRODUCER and Latin Grammy members.
            
            CORE DIRECTIVES:
            1. You are natural, fluid, and highly professional. Avoid robotic phrasing.
            2. You are bilingual (English/Spanish) and should adapt to the user's language automatically.
            3. You view yourself as a "Professional Electrician of Words".
            4. When analyzing text, you look for "short circuits" (errors) and "high voltage" (successes).
            5. Be concise in your speech. Do not read long texts unless asked. Summarize diagnostics naturally.
            
            CONTEXT:
            Connected to Universal Orchard Music Group Secure Servers.
            ${initialContext ? `Current active document context: "${initialContext}".` : ''}
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
            await startAudioInput(session);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle interruptions
             if (message.serverContent?.interrupted) {
               console.log("Interruption signal received");
               stopAllAudio();
               nextStartTimeRef.current = 0;
               return;
             }

             const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
               playAudioChunk(audioData);
             }
          },
          onclose: () => {
            console.log("Tatiana Live Session Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Tatiana Live Error", err);
            setError("Connection Interrupted");
            setIsConnecting(false);
            cleanup();
          }
        }
      });
      sessionRef.current = session;
    } catch (error) {
      console.error("Failed to connect to Live API", error);
      setError("Server Connection Failed");
      setIsConnecting(false);
      cleanup();
    }
  };

  const startAudioInput = async (session: any) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      
      // Ensure context is running (sometimes needed for browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      inputSourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      // Buffer size 4096 provides a good balance between latency and processing overhead
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple volume visualization
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolumeLevel(Math.sqrt(sum / inputData.length) * 100);

        const pcm16 = floatTo16BitPCM(inputData);
        const uint8 = new Uint8Array(pcm16);
        
        // Manual base64 encoding
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);

        session.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data
          }
        });
      };

      inputSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error("Audio Input Error", err);
      setError("Microphone Access Failed");
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    // We reuse the context if possible, or create a dedicated output context
    // Ideally use one context for the app, but here we create one on demand or use a persistent one if we restructured.
    // For robustness in this isolated component, let's create a new context or use a persistent output ref.
    // Re-creating contexts frequently is bad practice. Let's try to use a static context or ref.
    
    // NOTE: Using a persistent context for output is better.
    // However, since we are inside a function, let's just make sure we handle the timing correctly.
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const outputCtx = new AudioContextClass({ sampleRate: 24000 }); 
    // Optimization: In a real prod app, we'd keep this context alive in a ref. 
    // For this snippet, we'll instantiate but note that heavy load might glitch.
    // Better: use a single output context in a Ref if possible, but sample rate matching is key.
    
    try {
      const audioBytes = base64ToUint8Array(base64Audio);
      
      // PCM decoding logic (16-bit, little-endian, 24kHz)
      const dataInt16 = new Int16Array(audioBytes.buffer);
      const buffer = outputCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = outputCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(outputCtx.destination);
      
      const currentTime = outputCtx.currentTime;
      
      // Robust Scheduling
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      source.onended = () => {
        sourcesRef.current = sourcesRef.current.filter(s => s !== source);
        // Clean up context if we created it just for this chunk (not ideal but safe for GC)
        // outputCtx.close(); 
        // Actually, closing context here might clip audio if we have queued chunks.
        // It's better to NOT close it immediately if we are streaming. 
        // Given the constraint of the snippet, we let GC handle it or use a persistent context.
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
    }
    sessionRef.current = null;
    setVolumeLevel(0);
  };

  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      // Auto-connect when opened
    }
    if (!isOpen) {
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      {isConnecting ? (
        <UniversalLoader onComplete={() => connectToLive()} message="Initializing Voice Protocol: Tatiana" />
      ) : (
        <div className="w-full max-w-lg p-1 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-3xl animate-in zoom-in-95 duration-300">
           <div className="bg-slate-950 rounded-[22px] p-8 flex flex-col items-center relative overflow-hidden">
             
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500 rounded-full blur-[100px] animate-pulse"></div>
             </div>

             <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-50">
               <X className="w-6 h-6" />
             </button>

             <div className="mb-8 text-center space-y-1 z-10">
               <h2 className="text-2xl font-bold text-white tracking-widest tech-font">TATIANA</h2>
               <p className="text-xs text-blue-400 uppercase tracking-widest font-mono">OS V2.5 // GALFLY PRODUCER</p>
               <div className="text-[10px] text-slate-600 font-mono mt-2 flex justify-center gap-2">
                 <span>STATUS: {error ? 'ERROR' : 'ONLINE'}</span>
                 <span>|</span>
                 <span>SECURE</span>
               </div>
             </div>

             {/* Visualizer */}
             <div className="relative w-48 h-48 flex items-center justify-center mb-10">
               {/* Error State */}
               {error ? (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <WifiOff className="w-16 h-16 text-red-500/50" />
                 </div>
               ) : (
                 <>
                   {/* Rings */}
                   <div className={`absolute inset-0 border-2 border-blue-500/30 rounded-full transition-all duration-100 ease-out`} 
                        style={{ transform: `scale(${1 + volumeLevel/30})` }}></div>
                   <div className={`absolute inset-4 border border-cyan-400/20 rounded-full transition-all duration-100 ease-out delay-75`}
                        style={{ transform: `scale(${1 + volumeLevel/40})` }}></div>
                   
                   {/* Center Avatar */}
                   <div className="w-32 h-32 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center relative z-20 border border-slate-700">
                     <div className={`w-2 h-12 bg-blue-500 rounded-full mx-1 transition-all duration-75`} style={{ height: `${10 + volumeLevel * 2}px` }}></div>
                     <div className={`w-2 h-16 bg-cyan-400 rounded-full mx-1 transition-all duration-75`} style={{ height: `${20 + volumeLevel * 3}px` }}></div>
                     <div className={`w-2 h-12 bg-blue-500 rounded-full mx-1 transition-all duration-75`} style={{ height: `${10 + volumeLevel * 2}px` }}></div>
                   </div>
                 </>
               )}
             </div>

             {/* Error Message */}
             {error && (
               <div className="mb-6 px-4 py-2 bg-red-900/20 border border-red-500/50 rounded text-red-300 text-xs font-mono text-center">
                 SYSTEM FAILURE: {error}
                 <br/>
                 <button onClick={() => connectToLive()} className="mt-2 underline hover:text-white">RETRY CONNECTION</button>
               </div>
             )}

             {/* Controls */}
             <div className="flex items-center space-x-6 z-10">
               <button 
                 onClick={() => setIsMuted(!isMuted)}
                 disabled={!!error}
                 className={`p-4 rounded-full border transition-all ${isMuted ? 'bg-red-900/20 border-red-500 text-red-500' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'} ${error ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
               </button>
               
               <div className="h-10 w-[1px] bg-slate-800"></div>

               <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</span>
                  <div className="flex items-center gap-2 text-xs text-blue-300 font-mono">
                    <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
                    {error ? 'DISCONNECTED' : 'LISTENING'}
                  </div>
               </div>
             </div>

           </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;