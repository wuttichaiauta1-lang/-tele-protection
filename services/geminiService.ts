/// <reference types="vite/client" />
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIResponseSection } from "../types";

// Schema definitions using the new SDK standard
const checklistSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "ชื่อหมวดหมู่การตรวจสอบ (เช่น การติดตั้งตู้, ระบบสายสัญญาณ, ระบบกราวด์)",
      },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: {
                type: Type.STRING,
                description: "รายการที่ต้องตรวจสอบ (Inspection Item)",
            },
            standard: {
                type: Type.STRING,
                description: "เกณฑ์มาตรฐานที่ยอมรับได้ (Acceptance Criteria) ระบุค่าทางเทคนิคถ้ามี",
            }
          },
          required: ["description", "standard"]
        },
      },
    },
    required: ["title", "items"],
  },
};

export const generateChecklistFromAI = async (
  equipment: string, 
  context: string
): Promise<AIResponseSection[]> => {
  // Use VITE_ prefix for environment variables in Vite
  const apiKey = import.meta.env.VITE_API_KEY;

  if (!apiKey) {
    console.error("API Key missing");
    throw new Error("API Key not found. Please checks env_example.txt and ensure VITE_API_KEY is set.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Engineer-focused prompt
  const prompt = `
    Role: Senior Telecommunications Engineer (Quality Control)
    Task: Create a rigorous Installation Inspection Checklist for: "${equipment}"
    Context/Specific Requirements: "${context}"
    
    Guidelines:
    1. Group items into logical engineering categories (e.g., Mechanical Installation, Electrical/Power wiring, Grounding/Bonding, Fiber Optic/Cabling, System Configuration).
    2. Items must be specific and verifiable.
    3. **Crucial:** For each item, provide a "Standard Criteria" (Acceptance Criteria). For example:
       - Item: "Check DC Voltage" -> Standard: "Must be within -48VDC ± 10%"
       - Item: "Fiber Patch Cord Labeling" -> Standard: "Must match schematic, legible, industrial grade label"
    4. Include safety checks relevant to high-voltage environments if applicable (Tele-protection).
    5. Language: Thai (Formal Engineering terms).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: checklistSchema,
      },
    });

    if (response.text) {
        return JSON.parse(response.text) as AIResponseSection[];
    }
    return [];

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("ไม่สามารถสร้าง Checklist ได้ กรุณาตรวจสอบ API Key หรือลองใหม่อีกครั้ง");
  }
};