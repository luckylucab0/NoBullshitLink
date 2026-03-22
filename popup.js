// popup.js – Logik für das Einstellungs-Popup der Extension
// Verwaltet Provider-Auswahl und API-Key-Eingabe.

// DOM-Elemente referenzieren
const eingabeApiKey = document.getElementById("apiKey");
const providerSelect = document.getElementById("provider");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyLink = document.getElementById("apiKeyLink");
const btnSpeichern = document.getElementById("btnSpeichern");
const meldungErfolg = document.getElementById("meldungErfolg");
const meldungFehler = document.getElementById("meldungFehler");
const keyStatus = document.getElementById("keyStatus");
const keyStatusText = document.getElementById("keyStatusText");

// Provider-spezifische Texte und Links
const PROVIDER_CONFIG = {
  anthropic: {
    label: "Anthropic API-Key",
    placeholder: "sk-ant-api03-...",
    linkText: "console.anthropic.com",
    linkHref: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    label: "OpenAI API-Key",
    placeholder: "sk-...",
    linkText: "platform.openai.com",
    linkHref: "https://platform.openai.com/api-keys",
  },
  mistral: {
    label: "Mistral API-Key",
    placeholder: "...",
    linkText: "console.mistral.ai",
    linkHref: "https://console.mistral.ai/api-keys",
  },
  gemini: {
    label: "Google Gemini API-Key",
    placeholder: "AIza...",
    linkText: "aistudio.google.com",
    linkHref: "https://aistudio.google.com/app/apikey",
  },
};

// Aktualisiert Label, Placeholder und Hinweislink passend zum gewählten Provider
function aktualisiereProviderUI(providerId) {
  const config = PROVIDER_CONFIG[providerId];
  if (!config) return;
  apiKeyLabel.textContent = config.label;
  eingabeApiKey.placeholder = config.placeholder;
  apiKeyLink.textContent = config.linkText;
  apiKeyLink.href = config.linkHref;
}

// ============================================================
// Beim Öffnen des Popups: Provider + Key aus Storage laden
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["provider", "apiKey"], (ergebnis) => {
    const savedProvider = ergebnis.provider || "anthropic";
    providerSelect.value = savedProvider;
    aktualisiereProviderUI(savedProvider);

    if (ergebnis.apiKey && ergebnis.apiKey.trim() !== "") {
      keyStatus.classList.add("gesetzt");
      keyStatusText.textContent = "API-Key ist gespeichert ✓";
      const letzteZeichen = ergebnis.apiKey.slice(-4);
      eingabeApiKey.placeholder = `...${letzteZeichen} (gespeichert)`;
    } else {
      keyStatus.classList.remove("gesetzt");
      keyStatusText.textContent = "Kein API-Key gespeichert";
    }
  });
});

// Bei Provider-Wechsel: UI anpassen und Key-Feld leeren (Keys sind nicht übertragbar)
providerSelect.addEventListener("change", () => {
  const newProvider = providerSelect.value;
  aktualisiereProviderUI(newProvider);
  eingabeApiKey.value = "";
  keyStatus.classList.remove("gesetzt");
  keyStatusText.textContent = "Kein API-Key gespeichert";
});

// ============================================================
// Speichern-Button: Provider + API-Key in Storage schreiben
// ============================================================
btnSpeichern.addEventListener("click", () => {
  const apiKey = eingabeApiKey.value.trim();
  const provider = providerSelect.value;

  if (!apiKey) {
    zeigeMeldung("fehler");
    return;
  }

  // Provider + Key gemeinsam speichern
  chrome.storage.local.set({ provider, apiKey }, () => {
    eingabeApiKey.value = "";
    eingabeApiKey.placeholder = `...${apiKey.slice(-4)} (gespeichert)`;
    keyStatus.classList.add("gesetzt");
    keyStatusText.textContent = "API-Key ist gespeichert ✓";
    zeigeMeldung("erfolg");
  });
});

// Enter-Taste im Input-Feld löst ebenfalls das Speichern aus
eingabeApiKey.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    btnSpeichern.click();
  }
});

// ============================================================
// Hilfsfunktion: Zeigt Erfolgs- oder Fehlermeldung kurz an
// ============================================================
function zeigeMeldung(typ) {
  meldungErfolg.classList.remove("sichtbar");
  meldungFehler.classList.remove("sichtbar");

  if (typ === "erfolg") {
    meldungErfolg.classList.add("sichtbar");
  } else {
    meldungFehler.classList.add("sichtbar");
  }

  setTimeout(() => {
    meldungErfolg.classList.remove("sichtbar");
    meldungFehler.classList.remove("sichtbar");
  }, 3000);
}
