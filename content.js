// content.js – Läuft direkt auf der LinkedIn-Seite
// Dieser Code wird von Chrome in jede linkedin.com/feed Seite injiziert und
// manipuliert das DOM, um den "Aufräumen"-Button zu jedem Post hinzuzufügen.

// ============================================================
// SELEKTOREN – hier anpassen, wenn LinkedIn sein DOM ändert
// Reihenfolge: spezifischste/neueste zuerst, ältere als Fallback
// ============================================================
const SELEKTOREN = {
  // Container für einzelne Feed-Posts
  // [data-urn*="activity"] trifft LinkedIn-Posts zuverlässig anhand der URN
  postContainer: [
    "[data-urn*='urn:li:activity']",
    "[data-urn*='urn:li:share']",
    "[data-urn*='urn:li:ugcPost']",
    ".feed-shared-update-v2",
    ".occludable-update",
  ],

  // Wo der eigentliche Text des Posts steht
  postText: [
    ".update-components-text",
    ".feed-shared-text",
    ".attributed-text-segment-list__content",
    ".feed-shared-update-v2__description",
    ".feed-shared-inline-show-more-text",
    "[data-test-id='main-feed-activity-card__commentary']",
    ".break-words",           // neuerer LinkedIn-Selektor
    ".feed-shared-text-view", // weiterer Fallback
  ],

  // Die Aktionsleiste unter einem Post (Gefällt mir, Kommentieren, etc.)
  aktionsleiste: [
    ".feed-shared-social-action-bar",
    ".social-actions-bar",
    ".update-v2-social-activity",
    ".feed-shared-update-v2__social-actions",
    "[data-test-id='social-actions-bar']",
    // Neuere LinkedIn-Struktur: Elemente mit Reaktions-Buttons
    ".feed-shared-footer",
    ".update-components-footer",
  ],
};

// Markierung, die wir an bereits verarbeitete Posts hängen
const VERARBEITET_MARKER = "linkedinCleaner";

// ============================================================
// Hilfsfunktion: Findet ein Element anhand einer Fallback-Kette
// ============================================================
function findeElement(container, selektorListe) {
  for (const selektor of selektorListe) {
    try {
      const element = container.querySelector(selektor);
      if (element) return element;
    } catch (e) {
      // Ungültiger Selektor – überspringen
    }
  }
  return null;
}

// ============================================================
// Post-Text extrahieren
// ============================================================
function extrahierePostText(postContainer) {
  const textElement = findeElement(postContainer, SELEKTOREN.postText);
  if (!textElement) return null;
  return textElement.innerText?.trim().replace(/\n{3,}/g, "\n\n") || null;
}

// ============================================================
// Button erstellen
// ============================================================
function erstelleButton() {
  const button = document.createElement("button");
  button.className = "linkedin-cleaner-btn";
  button.innerHTML = "🧹 Aufräumen";
  button.title = "LinkedIn-Speak in klares Deutsch übersetzen";
  return button;
}

// ============================================================
// Ergebniskarte erstellen
// ============================================================
function erstelleErgebniskarte(text) {
  const karte = document.createElement("div");
  karte.className = "linkedin-cleaner-karte";
  karte.innerHTML = `
    <span class="linkedin-cleaner-label">🧹 Bereinigt:</span>
    <p class="linkedin-cleaner-text">${escapeHtml(text)}</p>
  `;
  return karte;
}

// XSS-Schutz: HTML-Sonderzeichen escapen
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ============================================================
// Hauptfunktion: Verarbeitet einen einzelnen Post-Container
// ============================================================
function verarbeitePost(postContainer) {
  // Nicht doppelt verarbeiten
  if (postContainer.dataset[VERARBEITET_MARKER]) return;

  postContainer.dataset[VERARBEITET_MARKER] = "true";

  // Button-Wrapper erstellen
  const buttonWrapper = document.createElement("div");
  buttonWrapper.className = "linkedin-cleaner-btn-wrapper";
  const button = erstelleButton();
  buttonWrapper.appendChild(button);

  // Versuch 1: Button in die Aktionsleiste hängen
  const aktionsleiste = findeElement(postContainer, SELEKTOREN.aktionsleiste);
  if (aktionsleiste) {
    aktionsleiste.appendChild(buttonWrapper);
  } else {
    // Fallback: Button direkt unten am Post-Container anhängen
    buttonWrapper.classList.add("linkedin-cleaner-btn-wrapper--fallback");
    postContainer.appendChild(buttonWrapper);
  }

  // Zustandsvariablen für diesen Post
  let karte = null;
  let laedt = false;

  // Klick-Handler
  button.addEventListener("click", async () => {
    // Toggle: Karte ausblenden wenn bereits sichtbar
    if (karte) {
      karte.remove();
      karte = null;
      button.innerHTML = "🧹 Aufräumen";
      button.disabled = false;
      return;
    }

    if (laedt) return;
    laedt = true;
    button.innerHTML = "⏳ Übersetze...";
    button.disabled = true;

    const postText = extrahierePostText(postContainer);
    if (!postText) {
      zeigeFehler(postContainer, "Kein Text im Post gefunden.");
      button.innerHTML = "🧹 Aufräumen";
      button.disabled = false;
      laedt = false;
      return;
    }

    chrome.runtime.sendMessage(
      { action: "cleanPost", postText },
      (antwort) => {
        laedt = false;
        button.disabled = false;

        if (chrome.runtime.lastError) {
          button.innerHTML = "🧹 Aufräumen";
          zeigeFehler(postContainer, "Verbindung zur Extension unterbrochen.");
          return;
        }

        if (antwort.success) {
          button.innerHTML = "✕ Schließen";
          karte = erstelleErgebniskarte(antwort.text);
          postContainer.after(karte);
        } else {
          button.innerHTML = "🧹 Aufräumen";
          if (antwort.error === "KEIN_API_KEY") {
            zeigeFehler(
              postContainer,
              "Bitte API-Key in den Einstellungen eintragen (Klick auf das Extension-Symbol)."
            );
          } else {
            zeigeFehler(
              postContainer,
              "Übersetzung fehlgeschlagen: " + (antwort.error || "Unbekannter Fehler")
            );
          }
        }
      }
    );
  });
}

// ============================================================
// Fehlermeldung anzeigen (verschwindet nach 5 Sekunden)
// ============================================================
function zeigeFehler(postContainer, nachricht) {
  const fehlerKarte = document.createElement("div");
  fehlerKarte.className = "linkedin-cleaner-karte linkedin-cleaner-fehler";
  fehlerKarte.innerHTML = `<p class="linkedin-cleaner-text">⚠️ ${escapeHtml(nachricht)}</p>`;
  postContainer.after(fehlerKarte);
  setTimeout(() => fehlerKarte.remove(), 5000);
}

// ============================================================
// Alle vorhandenen Posts scannen und verarbeiten
// ============================================================
function scanneSeite() {
  for (const selektor of SELEKTOREN.postContainer) {
    try {
      document.querySelectorAll(selektor).forEach(verarbeitePost);
    } catch (e) {
      // Ungültiger Selektor – überspringen
    }
  }
}

// ============================================================
// MutationObserver: Reagiert auf dynamisch nachgeladene Posts
// ============================================================
function starteMutationObserver() {
  let scanTimeout = null;

  const observer = new MutationObserver(() => {
    // Statt jeden einzelnen Node sofort zu prüfen, kurz warten
    // und dann die ganze Seite scannen (robuster bei komplexen DOM-Updates)
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanneSeite, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ============================================================
// Initialisierung
// ============================================================
function initialisiere() {
  scanneSeite();
  starteMutationObserver();

  // Zweiter Scan nach 2 Sekunden als Sicherheitsnetz,
  // falls LinkedIn den Feed verzögert rendert
  setTimeout(scanneSeite, 2000);
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialisiere);
  } else {
    initialisiere();
  }
} catch (e) {
  console.error("[LinkedIn Cleaner] Initialisierungsfehler:", e);
}
