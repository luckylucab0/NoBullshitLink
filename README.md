# NoBullshitLink 🧹

Eine Browser-Extension, die aufgeblasenes LinkedIn-Sprech in ehrlichen Klartext übersetzt.

> *"I'm excited to share that I'm starting a new chapter!"*
> → **"Ich wurde gefeuert."**

---

## Was es macht

Unter jedem LinkedIn-Post erscheint ein **🧹 Aufräumen**-Button. Ein Klick schickt den Post an ein KI-Modell deiner Wahl – zurück kommt das, was die Person ihrem besten Freund per WhatsApp geschrieben hätte. Kurz, direkt, ohne Verpackung.

---

## Installation

Da die Extension nicht im Chrome Web Store ist, muss sie manuell geladen werden:

1. Repo herunterladen (ZIP via GitHub oder `git clone`)
2. In Chrome: `chrome://extensions` öffnen
3. **Entwicklermodus** oben rechts aktivieren
4. **"Entpackte Erweiterung laden"** → den Ordner auswählen
5. Extension-Icon in der Toolbar anklicken → API-Key eintragen

---

## Unterstützte KI-Anbieter

| Anbieter | Modell | API-Key holen |
|---|---|---|
| Anthropic (Claude) | claude-sonnet-4-5 | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI (GPT) | gpt-4o-mini | [platform.openai.com](https://platform.openai.com/api-keys) |
| Mistral AI | mistral-small-latest | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| Google (Gemini) | gemini-2.0-flash | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

Der API-Key wird ausschließlich lokal im Browser gespeichert (`chrome.storage.local`). Es werden keine Daten an eigene Server gesendet.

---

## Updates

Im Popup unten: **"Nach Update suchen"** vergleicht die installierte Version mit dem letzten GitHub Release und zeigt einen Download-Link an, falls eine neuere Version verfügbar ist.

---

## Technisches

- Chrome Extension Manifest V3
- Kein Build-Schritt, kein Framework, kein Node
- `content.js` injiziert den Button in den LinkedIn-Feed via `MutationObserver`
- `background.js` (Service Worker) übernimmt alle API-Aufrufe (CORS-Umgehung)
- `popup.js` verwaltet Einstellungen und Update-Check

---

## Lizenz

GPL v3 – abgeleitete Projekte müssen ebenfalls Open Source bleiben.
