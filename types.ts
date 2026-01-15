export interface AnnotatedSegment {
  text: string;
  status: 'good' | 'bad' | 'improve' | 'neutral';
  reason?: string;
  suggestion?: string;
}

export interface TextAnalysis {
  genre: string;
  tone: string;
  professionalismScore: number;
  annotatedText: AnnotatedSegment[];
  genreSuccesses: string[];
  suggestions: string[];
  grammarIssues: string[];
  summary: string;
}

export interface RewrittenResult {
  text: string;
  changelog: string;
}

export enum AppMode {
  EDITOR = 'EDITOR',
  VOICE = 'VOICE'
}