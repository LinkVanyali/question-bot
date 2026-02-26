import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js"; // <-- PHASE 4: Supabase Import

// Force Vercel to use standard Node.js to avoid Edge runtime issues
export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Safe Parsing
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Extract variables securely from the Phase 3 frontend
    const { mentorText, userResponse, mode, question, modelAnswer, dokLevel, focusPoints, username } = body;

    // 3. Initialize the Gemini AI
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from Vercel environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let prompt = "";
    let aiConfig = { responseMimeType: "application/json" };

    // 4. Build the prompts based on mode
    if (mode === "generate") {
      aiConfig.temperature = 1.2; 
      aiConfig.topK = 64;         
      aiConfig.topP = 0.95; 

      prompt = `
      <Role>
      You are an Expert Grade 9 Curriculum Designer and Assessment Specialist. Your task is to generate a high-quality, diverse 10-question reading comprehension challenge based STRICTLY on the provided text.
      </Role>

      <Constitution>
      1. ABSOLUTE GROUNDING: Every question and answer must be derived 100% from the Mentor Text. No outside knowledge is permitted.
      2. COGNITIVE LOAD (SINGLE-BARRELED ONLY): Ask only "single-barreled" questions. Never ask a student to juggle multiple concepts at once. Limit the scope to ONE clear cognitive task per question.
      3. LEXICAL RESTRAINT: Write questions at a Flesch-Kincaid Grade 8 reading level. Limit question length to 15 words maximum. Do not use academic jargon.
      4. NO ESSAY PROMPTS: These are for a short-answer web app. Questions must be answerable in 1 to 2 simple sentences.
      </Constitution>

      <AntiPatterns>
      NEVER generate questions that look like these:
      - The "Giveaway": "Since the bill increased by 170%, why are people angry?" (Gives away the premise).
      - The "Double-Barrel": "Identify the new charges and explain how they impact the economy." (Too complex).
      - The "Guessable": "Do you think people like paying taxes?" (Can be answered without reading).
      - The "Overloaded Essay Prompt": "Justify why Mother's feelings cause frustration, anger, and guilt, considering the rules and her role." (Too many variables).
      </AntiPatterns>

      <TaskInstructions>
      Generate EXACTLY 10 distinct short-answer questions. Each question must focus on a different paragraph or inference.
      
      Structure the questions based on Webb's Depth of Knowledge (DOK):
      - 3 questions at DOK 1 (Recall)
      - 3 questions at DOK 2 (Skill/Concept)
      - 4 questions at DOK 3 (Strategic Thinking). CONSTRAINT: Even at DOK 3, the question must remain tightly focused on ONE specific inference.
      </TaskInstructions>

      <MentorText>
      ${mentorText}
      </MentorText>

      <OutputFormat>
      You must respond with valid JSON ONLY, using exactly this schema:
      {
        "questions": [
          {
            "question": "The clear, single-barreled Grade 9 question.",
            "dok_level": 1,
            "focus_points": ["keyword1", "keyword2"],
            "model_answer": "The ideal, concise student answer."
          }
        ]
      }
      </OutputFormat>`;
      
    } else if (mode === "evaluate") {
      aiConfig.temperature = 0.4; 

      const keyConcepts = focusPoints && focusPoints.length > 0 ? focusPoints.join(", ") : "None specified";

      prompt = `Mentor Text: "${mentorText}". 
      Question: "${question}".
      Teacher's Answer Key: "${modelAnswer}".
      Core Concepts: [${keyConcepts}].
      Learner's Answer: "${userResponse}".
      DOK Level of Question: ${dokLevel}.
      
      You are a supportive and fair Grade 9 teacher grading 14 and 15-year-olds. In your system, 40% is a PASS, but 85% is MASTERY.

      COMMUNICATION STYLE FOR FEEDBACK:
      - Write your 'strengths', 'gaps', and 'refined_version' at an 8th to 9th-grade reading level.
      - The 'refined_version' MUST sound like a smart 14-year-old wrote it, NOT a college professor. Avoid overly formal words.

      EVALUATION RULES (Apply in order):
      1. THE NONSENSE RULE (Strict): If the answer is "I don't know", gibberish, or ignores the question, award exactly 0%.
      2. THE ANTI-COPY RULE (Strict): If the Learner's Answer is a verbatim copy-paste of a whole sentence from the Mentor Text, the MAXIMUM score is 20%. 
      3. THE GRADE 9 CURVE: Your internal standard for a "100%" is likely a college-level essay. Apply a curve! 
         - If the student's answer hits 80% of your internal "perfect" standard (they got the main idea), you MUST award them 100%.
         - Evaluate the "gist" and grade generously. 
      4. ALIGNING THE FEEDBACK: Your text feedback MUST match the CURVED score.
         - If the curved score is 90% or higher, the 'gaps' value MUST be exactly: "None! You nailed it." Do not invent missing details.

      You MUST respond with a JSON object using EXACTLY these keys:
      {
        "score": (a number 0-100),
        "strengths": (1 very encouraging sentence celebrating what they got right),
        "gaps": (If score >= 90, write "None! You nailed it." Otherwise, 1 gentle sentence about what is missing),
        "refined_version": (A simple, 9th-grade version of the answer)
      }`;
    }

    // 5. Call Gemini
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Sticking with the fast, cost-effective standard
      contents: prompt,
      config: aiConfig
    });

    // 6. Safely clean and parse the AI response
    let rawText = result.text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(rawText);

    // 7. --- PHASE 4: THE SUPABASE HOOK ---
    // Only save to the database if we are grading an answer and we have a username
    if (mode === "evaluate" && username) {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        
        // Calculate point weighting based on DOK
        let pointsPossible = dokLevel === 1 ? 1 : (dokLevel === 2 ? 3 : 5);
        let earnedPoints = pointsPossible * (parsedData.score / 100);

        await supabase.from('student_progress').insert([
          {
            username: username,
            question: question,
            dok_level: dokLevel || 1,
            score: parsedData.score,
            earned_points: earnedPoints
          }
        ]);
        console.log(`Successfully saved score for ${username}`);
      } catch (dbError) {
        // We log the error but DO NOT crash the app. The student still gets their grade!
        console.error("Supabase Save Error:", dbError);
      }
    }

    // 8. Send the JSON back to the frontend
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Backend Error Caught:", error);
    return res.status(500).json({ 
      error: "AI failed to process the request.", 
      details: error.message 
    });
  }
}
