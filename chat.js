import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // 1. Only allow POST requests (data being sent to us)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mentorText, userResponse, mode } = JSON.parse(req.body);

  // 2. Initialize the Gemini AI with your secret Key
  // Note: 'GEMINI_API_KEY' will be set in your Vercel Dashboard later
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash", // Using the fast, cost-effective 2026 model
    generationConfig: { responseMimeType: "application/json" } 
  });

  try {
    let prompt = "";

    if (mode === "generate") {
      prompt = `Analyze this text: "${mentorText}". 
      Generate a JSON object with: 
      "question" (a deep thinking question), 
      "model_answer" (a 3-sentence ideal response), 
      "focus_points" (array of 3 key facts).`;
    } else {
      prompt = `Mentor Text: "${mentorText}". 
      Question: "${req.body.question}".
      Model Answer: "${req.body.modelAnswer}".
      Learner's Answer: "${userResponse}".
      Provide feedback in JSON: "score" (0-100), "strengths", "gaps", and "refined_version".`;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Send the AI's JSON back to your frontend
    return res.status(200).json(JSON.parse(responseText));

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "AI failed to process the request." });
  }
}
