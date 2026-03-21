// background.js – Service Worker der Extension
// Dieser Hintergrundprozess übernimmt die API-Kommunikation mit Anthropic.
// Warum hier statt im content.js? Browser erlauben keine direkten API-Aufrufe
// von Content Scripts an externe Dienste (CORS-Beschränkung). Der Service Worker
// hat diese Einschränkung nicht.

// System-Prompt: Gibt Claude genaue Anweisungen, wie LinkedIn-Posts zu übersetzen sind
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


// Anthropic API-Endpunkt
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

// Hauptfunktion: Holt den API-Key und sendet den Post an Claude
async function handleCleanPost(postText) {
  // API-Key aus dem lokalen Speicher laden (vom Nutzer in popup.js eingetragen)
  const stored = await chrome.storage.local.get("apiKey");
  const apiKey = stored.apiKey;

  // Fehler wenn kein API-Key vorhanden
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("KEIN_API_KEY");
  }

  // API-Anfrage zusammenbauen
  const requestBody = {
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: postText,
      },
    ],
  };

  // API-Aufruf an Anthropic
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(requestBody),
  });

  // Fehler bei HTTP-Fehlercodes (z.B. 401 Unauthorized, 429 Rate Limit)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`API_FEHLER: ${errorMsg}`);
  }

  // Antwort parsen und den Text extrahieren
  const data = await response.json();
  const cleanedText = data?.content?.[0]?.text;

  if (!cleanedText) {
    throw new Error("Leere Antwort von der API erhalten.");
  }

  return cleanedText;
}
