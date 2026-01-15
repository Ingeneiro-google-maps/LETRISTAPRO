import React, { useEffect, useState } from 'react';
import { Server, Wifi, Globe, Lock } from 'lucide-react';

interface UniversalLoaderProps {
  onComplete: () => void;
  message?: string;
}

const UniversalLoader: React.FC<UniversalLoaderProps> = ({ onComplete, message = "Establishing Secure Connection" }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Authenticating GALFLY PRODUCER Credentials...");

  useEffect(() => {
    const duration = 2500; // 2.5 seconds total load time
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / steps) * 100, 100);
      setProgress(newProgress);

      if (newProgress > 30 && newProgress < 60) {
        setStage("Routing to Universal Orchard Music Group Servers...");
      } else if (newProgress >= 60 && newProgress < 90) {
        setStage("Analyzing Data Packets...");
      } else if (newProgress >= 90) {
        setStage("Connection Established.");
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(onComplete, 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
      <div className="w-full max-w-md p-8 border border-blue-900/50 rounded-2xl bg-slate-900 shadow-2xl relative overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: 'linear-gradient(#1e3a8a 1px, transparent 1px), linear-gradient(90deg, #1e3a8a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
            <div className="h-16 w-16 bg-slate-950 border-2 border-blue-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
               <Globe className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-widest tech-font uppercase">{message}</h3>
            <div className="flex items-center justify-center space-x-2 text-xs text-blue-300 font-mono">
              <Lock className="w-3 h-3" />
              <span>{stage}</span>
            </div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
            <div 
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between w-full text-[10px] text-slate-500 uppercase tracking-wider">
            <span>Server: ORCHARD-GRP-01</span>
            <span>Latency: 12ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalLoader;