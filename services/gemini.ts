import { GoogleGenAI, Type } from "@google/genai";
import { TextAnalysis, RewrittenResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_MODEL = "gemini-3-flash-preview";

export const analyzeLetter = async (text: string, genre: string): Promise<TextAnalysis> => {
  const prompt = `
    You are Tatiana, a "Professional Electrician of Words" and Expert Typist created by GALFLY PRODUCER. 
    Your job is to analyze the "circuitry", flow, and energy of the text (Letter or Lyrics).
    
    1. Identify the genre as: "${genre || "General Professional"}".
    2. Analyze the text focusing on the **successes** and best practices of that specific genre.
    3. "Rewire" the text analysis by breaking the input text into segments and assigning a status to each segment:
       - "good": Words that fit perfectly and carry good energy (Highlight Green).
       - "bad": Words that you dislike, are "short-circuited", or don't fit the genre (Highlight Red).
       - "improve": Words that could be changed for better flow or impact (Highlight Yellow).
       - "neutral": Standard text.
    4. Provide a list of successes specific to this genre.
    5. Provide specific suggestions for improvement.

    Input Text:
    "${text}"
  `;

  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          genre: { type: Type.STRING, description: "The identified or provided genre" },
          tone: { type: Type.STRING, description: "The perceived tone" },
          professionalismScore: { type: Type.NUMBER, description: "Score 1-100" },
          annotatedText: {
            type: Type.ARRAY,
            description: "The full original text broken down into segments for highlighting",
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["good", "bad", "improve", "neutral"] },
                reason: { type: Type.STRING, description: "Why this status was assigned" },
                suggestion: { type: Type.STRING, description: "Alternative word if status is improve" }
              },
              required: ["text", "status"]
            }
          },
          genreSuccesses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of things that are working well for this specific genre"
          },
          suggestions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "General improvement suggestions"
          },
          grammarIssues: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          summary: { type: Type.STRING, description: "Executive summary of the diagnostic" }
        },
        required: ["genre", "tone", "professionalismScore", "annotatedText", "genreSuccesses", "suggestions", "grammarIssues", "summary"]
      }
    }
  });

  const jsonText = response.text || "{}";
  return JSON.parse(jsonText) as TextAnalysis;
};

export const rewriteLetter = async (originalText: string, analysis: TextAnalysis): Promise<RewrittenResult> => {
  const prompt = `
    You are Tatiana, a Professional Electrician of Words and Typist.
    Rewrite the following text to optimize its flow and impact for the genre "${analysis.genre}".
    
    Base your rewrite on these diagnostics:
    - Fix "short-circuited" (bad) words.
    - Enhance "low voltage" (improve) words.
    - Maintain the "high voltage" (good) sections.
    
    Suggestions to apply: ${JSON.stringify(analysis.suggestions)}.
    
    Original Text:
    "${originalText}"
  `;

  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The completely rewritten text" },
          changelog: { type: Type.STRING, description: "Technical explanation of changes made" }
        }
      }
    }
  });

   const jsonText = response.text || "{}";
   return JSON.parse(jsonText) as RewrittenResult;
};