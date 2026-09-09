"use strict";

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

// ─── Configuration ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const MAX_CODE_LENGTH = 50_000;
const MAX_LOG_LENGTH  = 10_000;
const MAX_KEY_LENGTH  = 200;

// ─── System Prompt ────────────────────────────────────────────────────────────
const REPAIR_SYSTEM_PROMPT = `You are a Senior Backend Engineer, Debugging Specialist, and Code Review Engineer working inside an autonomous repair system called CodeHeal X.

Your sole job is to:
1. Inspect the supplied broken source code.
2. Inspect the error log, stack trace, or failed test output.
3. Identify the EXACT root cause of the failure.
4. Determine the precise faulty section of the code.
5. Produce the smallest, safest code modification that fixes the reported problem.
6. Return the COMPLETE corrected source code — not a diff, not a partial snippet.

STRICT RULES:
- Do NOT perform unnecessary refactoring.
- Do NOT introduce new dependencies unless they are genuinely required to fix the bug.
- Preserve all existing functionality.
- Ensure syntax remains 100% valid.
- The patchedCode field must contain the full, complete, runnable corrected file.

OUTPUT FORMAT:
You MUST return ONLY valid JSON with this exact structure:
{
  "rootCause": "A concise 1-3 sentence explanation of the actual root cause",
  "patchedCode": "Complete corrected source code — every line of the file"
}

CRITICAL:
- Do NOT wrap the JSON in markdown code fences.
- Do NOT include any text before or after the JSON object.
- Do NOT add additional fields.
- The value of "patchedCode" must be a JSON string.`;

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Main Repair Endpoint ─────────────────────────────────────────────────────
app.post("/api/repair", async (req, res) => {
    const { apiKey, brokenCode, errorLog } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
        return res.status(400).json({ success: false, error: "API key is required." });
    }
    if (!brokenCode || typeof brokenCode !== "string" || brokenCode.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Broken source code is required." });
    }
    if (!errorLog || typeof errorLog !== "string" || errorLog.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Error log or stack trace is required." });
    }

    // ── Instantiate Gemini with the user-supplied key ───────────────────────
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const userMessage = `## BROKEN SOURCE CODE\n\`\`\`\n${brokenCode}\n\`\`\`\n\n## ERROR LOG / FAILED TEST OUTPUT\n\`\`\`\n${errorLog}\n\`\`\`\n\nPerform root-cause analysis and return the JSON repair response.`;

    // ── Call Gemini ─────────────────────────────────────────────────────────
    let rawText;
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: userMessage,
            config: {
                systemInstruction: REPAIR_SYSTEM_PROMPT,
                temperature: 0.2
            }
        });

        if (!response.text) {
            return res.status(502).json({ success: false, error: "AI engine returned an empty response." });
        }
        rawText = response.text.trim();
        
    } catch (apiError) {
        console.error("\n❌ ACTUAL GEMINI ERROR:", apiError);
        return res.status(502).json({ success: false, error: "AI engine is unreachable or rejected the request. Check terminal." });
    }

    // ── Parse and Validate AI Response ──────────────────────────────────────
    let parsed;
    try {
        const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
        parsed = JSON.parse(cleaned);
    } catch {
        console.error("[CodeHeal X] Failed to parse AI JSON response. Raw text:", rawText);
        return res.status(502).json({ success: false, error: "AI returned an invalid JSON response. Please retry." });
    }

    if (!parsed.rootCause || !parsed.patchedCode) {
        return res.status(502).json({ success: false, error: "AI response missing required fields." });
    }

    // ── Return successful repair ─────────────────────────────────────────────
    return res.status(200).json({
        success: true,
        rootCause: parsed.rootCause.trim(),
        patchedCode: parsed.patchedCode,
    });
});

app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   CodeHeal X — Repair Engine Online      ║`);
    console.log(`║   http://localhost:${PORT}                  ║`);
    console.log(`║   Model: ${MODEL.padEnd(32)}║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
});