const GROQ_API_URL = "https://api.groq.com/openai/v1";

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    const response = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.text;
}

export async function enrichText(text: string, apiKey: string, systemPrompt: string): Promise<string> {
    return enrichWithHistory([{ role: "user", content: text }], apiKey, systemPrompt);
}

export async function enrichWithHistory(messages: ChatMessage[], apiKey: string, systemPrompt: string): Promise<string> {
    // Ensure system prompt is first, if not present
    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.filter(m => m.role !== "system")
    ];

    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messages: apiMessages,
            model: "llama-3.3-70b-versatile",
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Enrichment failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
}
