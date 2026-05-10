import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AdherenceRisk {
  medicineName: string;
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
  suggestion: string;
}

export async function parsePrescription(imageData: string): Promise<any[]> {
  const prompt = "Extract medication details from this prescription image. Return JSON array: [{name, dosage, times: ['HH:mm'], frequency}].";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: imageData } }] }
      ],
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Parse Error:", error);
    return [];
  }
}

export async function getAdherenceInsights(logs: any[], medicines: any[]): Promise<string> {
  const prompt = `Analyze logs for adherence patterns. Logs: ${JSON.stringify(logs.slice(0, 10))}. Meds: ${JSON.stringify(medicines)}. Provide a 2-sentence empathetic clinical brief for a caregiver.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text || "Continue regular monitoring.";
  } catch (error) {
     return "Clinical insights unavailable.";
  }
}

export async function getScheduleOptimization(
  patientLogs: any[], 
  medicines: any[]
): Promise<{ optimization: string; risks: AdherenceRisk[] }> {
  // Gracefully handle empty states
  if (medicines.length === 0) {
    return { optimization: "Add medicines to get AI-powered schedule optimization.", risks: [] };
  }

  const prompt = `
    Analyze this patient's medication intake history and schedule.
    
    Medicines: ${JSON.stringify(medicines)}
    Logs (Last 30 days): ${JSON.stringify(patientLogs.slice(0, 50))}

    Task:
    1. Identify patterns in missed doses.
    2. Suggest a more optimal schedule based on actual intake times (e.g., if they consistently take a 9 AM med at 10 AM, suggest moving it).
    3. Identify high-risk medications (those frequently missed).

    Provide the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimization: { 
              type: Type.STRING, 
              description: "A summary of the optimized schedule suggestion." 
            },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  medicineName: { type: Type.STRING },
                  riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                  reason: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                },
                required: ["medicineName", "riskLevel", "reason", "suggestion"]
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      optimization: result.optimization || "No specific optimization patterns found yet.",
      risks: result.risks || []
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { 
      optimization: "Unable to analyze patterns at this time.", 
      risks: [] 
    };
  }
}
