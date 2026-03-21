// background.js – Service Worker der Extension
// Dieser Hintergrundprozess übernimmt die API-Kommunikation mit Anthropic.
// Warum hier statt im content.js? Browser erlauben keine direkten API-Aufrufe
// von Content Scripts an externe Dienste (CORS-Beschränkung). Der Service Worker
// hat diese Einschränkung nicht.

// System-Prompt: Gibt Claude genaue Anweisungen, wie LinkedIn-Posts zu übersetzen sind
const SYSTEM_PROMPT = `Du bist ein sarkastischer aber hilfreicher Übersetzer von LinkedIn-Sprache.

Deine Aufgabe: Extrahiere den eigentlichen Informationsgehalt eines LinkedIn-Posts und formuliere ihn als kurzen, ehrlichen deutschen Satz (oder wenige Sätze). Keine Emojis. Kein Pathos. Keine Hashtags. Keine Buzzwords.

Regeln:
- Fasse zusammen, was die Person WIRKLICH sagt (nicht was sie klingen lassen will)
- Maximal 2-3 kurze, direkte Sätze
- Ton: sachlich, leicht trocken – wie ein Kollege, der die Situation nüchtern beschreibt
- Falls der Post buchstäblich keinen Inhalt hat (reine Selbstdarstellung ohne Information): schreib genau das, z.B. "Dieser Post enthält keine verwertbare Information."
- Antworte NUR mit dem übersetzten Text, ohne Einleitung oder Erklärung

Beispiel Input:
"I'm incredibly humbled and grateful to announce that after an amazing journey of growth and self-discovery, I'm thrilled to share that I've officially joined XYZ Corp as Senior Innovation Enabler! 🚀🙏 Huge thanks to my mentors, my family, my dog, and the universe. #Blessed #NewChapter #Grateful"

Beispiel Output:
"Ich habe einen neuen Job bei XYZ Corp als Senior Innovation Enabler."`;

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
