import React, { useState, useEffect } from 'react';
import { Type, FileText, Activity, CheckCircle, RefreshCw, AlertCircle, Copy, ArrowRight, Zap, Music, ThumbsUp, XCircle, AlertTriangle } from 'lucide-react';
import { analyzeLetter, rewriteLetter } from '../services/gemini';
import { TextAnalysis, RewrittenResult, AnnotatedSegment } from '../types';
import UniversalLoader from './UniversalLoader';

interface TypistInterfaceProps {
  onActivateVoice: (context: string) => void;
  externalText: string;
  onExternalTextChange: (text: string) => void;
}

const TypistInterface: React.FC<TypistInterfaceProps> = ({ onActivateVoice, externalText, onExternalTextChange }) => {
  // Use external text as the source of truth if provided, otherwise local state (though we are pushing to lift state up)
  // To keep it simple, we sync props to state or just use props.
  // Let's use the props directly for the main text area to allow real-time updates from voice.
  
  const [genre, setGenre] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritten, setRewritten] = useState<RewrittenResult | null>(null);
  const [showLoader, setShowLoader] = useState(false);

  const handleAnalyze = () => {
    if (!externalText.trim()) return;
    setShowLoader(true);
  };

  const executeAnalysis = async () => {
    setShowLoader(false);
    setIsAnalyzing(true);
    try {
      // Use "General" if no genre specified, but we encourage it.
      const targetGenre = genre.trim() || "General Professional";
      const result = await analyzeLetter(externalText, targetGenre);
      setAnalysis(result);
      setRewritten(null); // Reset previous rewrites
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async () => {
    if (!externalText || !analysis) return;
    setIsRewriting(true);
    try {
      const result = await rewriteLetter(externalText, analysis);
      setRewritten(result);
    } catch (error) {
      console.error("Rewrite failed", error);
    } finally {
      setIsRewriting(false);
    }
  };

  const renderHighlightedText = (segments: AnnotatedSegment[]) => {
    return (
      <div className="bg-slate-900/50 p-6 rounded-lg font-light leading-relaxed whitespace-pre-wrap border border-slate-800">
        {segments.map((segment, idx) => {
          if (segment.status === 'good') {
            return (
              <span key={idx} className="bg-green-500/20 text-green-200 border-b-2 border-green-500 mx-0.5 px-1 rounded-sm relative group cursor-help">
                {segment.text}
                {segment.reason && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-green-500 text-[10px] text-green-400 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {segment.reason}
                  </span>
                )}
              </span>
            );
          }
          if (segment.status === 'bad') {
            return (
               <span key={idx} className="bg-red-500/20 text-red-200 border-b-2 border-red-500 mx-0.5 px-1 rounded-sm relative group cursor-help">
                {segment.text}
                 {segment.reason && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-red-500 text-[10px] text-red-400 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    DISLIKE: {segment.reason}
                  </span>
                )}
              </span>
            );
          }
          if (segment.status === 'improve') {
            return (
               <span key={idx} className="bg-amber-500/20 text-amber-200 border-b-2 border-amber-500 mx-0.5 px-1 rounded-sm relative group cursor-help">
                {segment.text}
                {(segment.suggestion || segment.reason) && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-amber-500 text-[10px] text-amber-400 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {segment.suggestion ? `TRY: ${segment.suggestion}` : segment.reason}
                  </span>
                )}
              </span>
            );
          }
          return <span key={idx}>{segment.text}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {showLoader && <UniversalLoader onComplete={executeAnalysis} message="Connecting to Universal Orchard Music Group" />}

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4 flex flex-col h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-blue-400 font-semibold flex items-center gap-2 tech-font tracking-wide">
              <FileText className="w-5 h-5" /> SOURCE DOCUMENT
            </h2>
            <div className="text-xs text-slate-500 font-mono">STATUS: {externalText.length > 0 ? 'DRAFTING' : 'IDLE'}</div>
          </div>
          
          <div className="glass-panel p-1 rounded-xl flex-grow flex flex-col min-h-[500px]">
            {/* Genre Input */}
            <div className="bg-slate-900/80 p-3 border-b border-slate-800">
               <div className="flex items-center gap-2 bg-slate-800/50 rounded-md px-3 py-2 border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
                  <Music className="w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Enter Genre (e.g., Pop, Reggaeton, Ballad, Corporate Letter)..."
                    className="bg-transparent border-none focus:outline-none text-sm text-slate-200 w-full placeholder:text-slate-600 font-mono"
                  />
               </div>
            </div>

            <textarea
              className="w-full h-full bg-slate-900/50 text-slate-200 p-6 resize-none focus:outline-none font-light leading-relaxed scrollbar-thin transition-all"
              placeholder="Paste your letter or lyrics here for diagnostics..."
              value={externalText}
              onChange={(e) => onExternalTextChange(e.target.value)}
            />
            <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex justify-between items-center rounded-b-lg">
              <span className="text-xs text-slate-400 font-mono">{externalText.length} CHARS</span>
              <div className="flex space-x-3">
                 <button 
                  onClick={() => onActivateVoice(externalText)}
                  className="px-4 py-2 text-xs font-bold text-blue-300 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Discuss with Tatiana
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!externalText.trim() || isAnalyzing}
                  className={`px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 uppercase tracking-wider ${(!externalText.trim() || isAnalyzing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  DIAGNOSE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4 flex flex-col h-full">
          {!analysis ? (
             <div className="h-full min-h-[500px] glass-panel rounded-xl flex items-center justify-center flex-col text-slate-500 space-y-4 border-dashed border-slate-800">
                <Zap className="w-16 h-16 opacity-20" />
                <p className="text-sm font-mono uppercase tracking-widest opacity-50">Awaiting Circuit Analysis</p>
             </div>
          ) : (
            <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* Analysis Card */}
              <div className="glass-panel p-6 rounded-xl border-l-4 border-l-blue-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Activity className="w-24 h-24" />
                </div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <h2 className="text-lg font-bold text-white tech-font flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    DIAGNOSTIC REPORT
                  </h2>
                  <div className="flex flex-col items-end">
                    <span className="text-3xl font-bold text-blue-400 font-mono">{analysis.professionalismScore}%</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Circuit Efficiency</span>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  
                  {/* Genre Successes */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/50">
                    <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                      <ThumbsUp className="w-3 h-3" />
                      Successes in {analysis.genre}
                    </h4>
                    <ul className="space-y-2">
                       {analysis.genreSuccesses && analysis.genreSuccesses.length > 0 ? (
                         analysis.genreSuccesses.map((s, i) => (
                           <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                             <CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                             {s}
                           </li>
                         ))
                       ) : (
                         <li className="text-xs text-slate-500 italic">No specific genre successes detected.</li>
                       )}
                    </ul>
                  </div>

                  {/* Annotated Text */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Visual Circuit Analysis</h4>
                    <div className="flex gap-4 mb-2 text-[10px] font-mono">
                      <span className="flex items-center gap-1 text-green-400"><div className="w-2 h-2 bg-green-500 rounded-full"></div> HIGH VOLTAGE (Keep)</span>
                      <span className="flex items-center gap-1 text-red-400"><div className="w-2 h-2 bg-red-500 rounded-full"></div> SHORT CIRCUIT (Dislike)</span>
                      <span className="flex items-center gap-1 text-amber-400"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> LOW VOLTAGE (Improve)</span>
                    </div>
                    {renderHighlightedText(analysis.annotatedText)}
                  </div>

                  {/* Key Suggestions */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Technical Recommendations</h4>
                    <ul className="space-y-2">
                      {analysis.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                   <button
                    onClick={handleRewrite}
                    disabled={isRewriting}
                    className="flex items-center gap-2 text-sm text-white bg-blue-900/50 hover:bg-blue-800 px-4 py-2 rounded border border-blue-500/30 transition-all"
                   >
                     {isRewriting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                     Generate Optimized Version
                   </button>
                </div>
              </div>

              {/* Rewritten Result */}
              {rewritten && (
                <div className="glass-panel rounded-xl flex-grow flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                  <div className="bg-blue-950/50 p-3 border-b border-blue-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2 uppercase tracking-wide">
                      <ArrowRight className="w-4 h-4" /> Optimized Output
                    </h3>
                    <button 
                      onClick={() => navigator.clipboard.writeText(rewritten.text)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[300px] scrollbar-thin">
                    <p className="whitespace-pre-wrap text-slate-200 font-light leading-relaxed">
                      {rewritten.text}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 text-xs text-slate-500 font-mono border-t border-slate-900">
                    CHANGELOG: {rewritten.changelog}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TypistInterface;