import React, { useState } from 'react';
import { Mic, Music, Play, Layers } from 'lucide-react';
import TypistInterface from './components/TypistInterface';
import VoiceAssistant from './components/VoiceAssistant';

const App: React.FC = () => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceContext, setVoiceContext] = useState<string>('');

  const activateVoice = (context: string) => {
    setVoiceContext(context);
    setIsVoiceActive(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-x-hidden selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/20 to-transparent opacity-50"></div>
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
               <Layers className="text-white w-5 h-5" />
             </div>
             <div>
               <h1 className="text-lg font-bold text-white tracking-widest futuristic-font leading-none">TATIANA</h1>
               <p className="text-[9px] text-blue-400 tracking-[0.2em] font-mono">LATIN GRAMMY & GALFLY PRODUCER</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              UNIVERSAL ORCHARD SERVERS: CONNECTED
            </div>
            <button 
              onClick={() => activateVoice('')}
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-5 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Activate Tatiana
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 mb-8 text-center">
           <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 futuristic-font tracking-tight">
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Professional Typist</span> 
             <span className="block text-blue-500 mt-2">Assistant System</span>
           </h2>
           <p className="max-w-2xl mx-auto text-slate-400 font-light text-sm md:text-base">
             Advanced letter analysis and drafting powered by neural networks. 
             Created by Latin Grammy members & GALFLY PRODUCER for Universal Orchard Music Group workflows.
           </p>
        </div>

        <TypistInterface onActivateVoice={activateVoice} />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
             <Music className="w-3 h-3" />
             <span>POWERED BY UNIVERSAL ORCHARD MUSIC GROUP INFRASTRUCTURE</span>
           </div>
           <div className="text-[10px] text-slate-600 uppercase tracking-widest">
             © 2025 Latin Grammy Creative Labs & GALFLY PRODUCER. System Tatiana v2.5
           </div>
        </div>
      </footer>

      {/* Voice Overlay */}
      <VoiceAssistant 
        isOpen={isVoiceActive} 
        onClose={() => setIsVoiceActive(false)} 
        initialContext={voiceContext}
      />
    </div>
  );
};

export default App;