// background.js – Service Worker der Extension
// Dieser Hintergrundprozess übernimmt die API-Kommunikation mit dem gewählten Anbieter.
// Warum hier statt im content.js? Browser erlauben keine direkten API-Aufrufe
// von Content Scripts an externe Dienste (CORS-Beschränkung). Der Service Worker
// hat diese Einschränkung nicht.

// System-Prompt: Gibt dem Modell genaue Anweisungen, wie LinkedIn-Posts zu übersetzen sind
const SYSTEM_PROMPT = `Du übersetzt LinkedIn-Posts zurück in das, was die Person ihrem besten Freund per WhatsApp geschrieben hätte.

Dein Output ist immer: eine kurze, direkte, unverpackte Aussage – so wie man es wirklich sagen würde, ohne Publikum, ohne persönliche Marke, ohne Netzwerk das zuhört.

Regeln:
- 1-2 Sätze. Nicht mehr.
- Kein Weichspülen. Nenn die Dinge beim Namen.
- Kein Deutsch-Englisch-Mix, kein Corporate-Jargon, keine Hashtags, keine Emojis.
- Falls jemand gefeuert wurde und es als eigene Entscheidung verkauft: sag dass er gefeuert wurde.
- Falls jemand krank ist und es als "Wellbeing-Investition" rahmt: sag dass er krank ist.
- Falls ein Post keine Information enthält: sag das in einem Satz, trocken.
- Antworte NUR mit der Übersetzung. Keine Einleitung, kein Kommentar.

Beispiele:

Input: "I'm taking some much-needed time to prioritize my well-being and recharge so I can return with even more focus and continue delivering high-impact results for my team and partners."
Output: "Ich bin krank."

Input: "I'm excited to share that I'm starting a new chapter! After a period of mutual reflection, I've decided to move on from my current role to pursue new challenges and growth opportunities. I'm incredibly grateful for the experiences I've had and am now looking forward to bringing my skills to a new team. #NewBeginnings #CareerGrowth #OpenToWork"
Output: "Ich wurde gefeuert. Ich nenne es trotzdem meine eigene Entscheidung."

Input: "Failure is not the opposite of success. It's part of the journey. 💪 #GrowthMindset"
Output: "Irgendwas ist schiefgelaufen. Ich sage aber nicht was."

Input: "I'm incredibly humbled and grateful to announce I've joined XYZ Corp as Senior Innovation Enabler! 🚀🙏 #Blessed #NewChapter"
Output: "Ich habe einen neuen Job."`;


// Provider-Konfigurationen: Jeder Eintrag beschreibt wie ein API-Anbieter angesprochen wird
const PROVIDERS = {
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    }),
    buildBody: (text) => ({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
    extractText: (data) => data?.content?.[0]?.text,
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: (text) => ({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content,
  },
  mistral: {
    url: "https://api.mistral.ai/v1/chat/completions",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: (text) => ({
      model: "mistral-small-latest",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content,
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    }),
    buildBody: (text) => ({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: { maxOutputTokens: 300 },
    }),
    extractText: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text,
  },
};

// Nachrichtenempfänger: Hört auf Anfragen aus content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Nur "cleanPost"-Anfragen verarbeiten
  if (request.action !== "cleanPost") return;

  // Asynchrone Verarbeitung starten (sendResponse muss synchron aufgerufen werden,
  // daher geben wir true zurück, um den Kanal offen zu halten)
  handleCleanPost(request.postText)
    .then((result) => sendResponse({ success: true, text: result }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // Hält den Nachrichtenkanal offen für die asynchrone Antwort
});

// Hauptfunktion: Holt Provider + API-Key aus Storage und sendet den Post an die API
async function handleCleanPost(postText) {
  // Provider und API-Key aus dem lokalen Speicher laden
  const stored = await chrome.storage.local.get(["provider", "apiKey"]);
  const providerId = stored.provider || "anthropic";
  const apiKey = stored.apiKey;

  // Fehler wenn kein API-Key vorhanden
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("KEIN_API_KEY");
  }

  // Provider-Config holen
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`Unbekannter Provider: ${providerId}`);
  }

  // API-Aufruf mit Provider-spezifischen Headern und Body
  const response = await fetch(provider.url, {
    method: "POST",
    headers: provider.buildHeaders(apiKey),
    body: JSON.stringify(provider.buildBody(postText)),
  });

  // Fehler bei HTTP-Fehlercodes (z.B. 401 Unauthorized, 429 Rate Limit)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`API_FEHLER: ${errorMsg}`);
  }

  // Antwort parsen und den Text extrahieren (provider-spezifisch)
  const data = await response.json();
  const cleanedText = provider.extractText(data);

  if (!cleanedText) {
    throw new Error("Leere Antwort von der API erhalten.");
  }

  return cleanedText;
}
