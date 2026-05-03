import { GoogleGenAI } from "@google/genai";
import { IntakeLog, Medicine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAdherenceInsights(logs: IntakeLog[], medicines: Medicine[]) {
  if (!process.env.GEMINI_API_KEY) return "AI insights are unavailable without an API key.";

  const prompt = `
    As a health assistant, analyze the following medicine intake logs and schedules for a patient.
    Medicines: ${JSON.stringify(medicines)}
    Logs: ${JSON.stringify(logs)}
    
    Provide a brief, encouraging insight (max 2 sentences) about their adherence patterns and one specific suggestion to improve (e.g., "I noticed you missed your morning meds twice this week, maybe move the box to the breakfast table?").
    Format: Return as plain text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    return response.text || "Unable to generate insights.";
  } catch (error) {
    console.error("Gemini failed:", error);
    return "Unable to generate insights at this moment.";
  }
}

export async function parsePrescription(imageData: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error("API Key missing");

  const prompt = `
    Analyze this prescription image and extract a list of medicines. 
    Convert abbreviations: OD -> once daily, BD -> twice daily, TDS -> three times daily, QDS -> four times daily.
    
    Return a structured JSON array of objects with these keys:
    - name (string)
    - dosage (string, e.g. "500mg")
    - frequency (string, e.g. "twice daily")
    - times (array of strings in HH:mm format, e.g. ["08:00", "20:00"])
    - duration (string, e.g. "7 days")
    - notes (string, e.g. "take after food")
    - isUncertain (boolean, true if the text was blurry or handwriting was unclear)

    Rules:
    1. If a field is missing, use an empty string or empty array.
    2. Do NOT hallucinate data.
    3. Return ONLY the JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } }
        ]
      },
    });
    
    const text = response.text || "[]";
    const jsonMatch = text.match(/\[.*\]/s);
    return JSON.parse(jsonMatch ? jsonMatch[0] : "[]");
  } catch (error) {
    console.error("Prescription parsing failed:", error);
    throw error;
  }
}
