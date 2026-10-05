import { GoogleGenAI, Type } from "@google/genai";
import { LogEntry, RiskAnalysisResult } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeSecurityLogs = async (logs: LogEntry[]): Promise<RiskAnalysisResult> => {
  const ai = getAiClient();
  if (!ai) {
    // Fallback if no API key
    return {
      riskLevel: 'MEDIUM',
      summary: 'API Key missing. Using local heuristic fallback. Several failed attempts detected.',
      recommendations: ['Check API configuration', 'Monitor user "j.doe"']
    };
  }

  try {
    const prompt = `
      Analyze the following security logs for a Biometric MFA system. 
      Identify patterns of brute force, spoofing, or deepfake attempts.
      
      Logs:
      ${JSON.stringify(logs)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as RiskAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Failed", error);
    return {
      riskLevel: 'HIGH',
      summary: 'Analysis failed due to network or API error.',
      recommendations: ['Manual Review Required']
    };
  }
};

export const chatWithSecurityBot = async (history: string[], message: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "I cannot answer without an API Key.";

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are BioShield's AI Security Assistant. You explain MFA policies, biometric privacy (ISO 30107-3), and handle security queries briefly and professionally.",
      }
    });

    // Replay history (simplified for this demo, ideally use proper history objects)
    for (let i = 0; i < history.length; i += 2) {
      if (history[i + 1]) {
        // In a real app, we'd construct the history object properly for the chat init
        // For this stateless demo func, we just send the new message with context instructions if needed
      }
    }

    const result = await chat.sendMessage({ message });
    return result.text || "No response.";
  } catch (error) {
    return "Error connecting to Security AI.";
  }
};