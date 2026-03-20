// content.js – Läuft direkt auf der LinkedIn-Seite
// Dieser Code wird von Chrome in jede linkedin.com/feed Seite injiziert und
// manipuliert das DOM, um den "Aufräumen"-Button zu jedem Post hinzuzufügen.

// ============================================================
// SELEKTOREN – hier anpassen, wenn LinkedIn sein DOM ändert
// LinkedIn aktualisiert regelmäßig seine CSS-Klassen und Struktur.
// Alle Selektoren an einem Ort zu halten, erleichtert spätere Anpassungen.
// ============================================================
const SELEKTOREN = {
  // Container für einzelne Feed-Posts
  postContainer: [
    ".feed-shared-update-v2",
    "[data-urn]",
    ".occludable-update",
  ],

  // Wo der eigentliche Text des Posts steht
  postText: [
    ".feed-shared-update-v2__description",
    ".feed-shared-text",
    ".update-components-text",
    "[data-test-id='main-feed-activity-card__commentary']",
    ".feed-shared-inline-show-more-text",
    ".attributed-text-segment-list__content",
  ],

  // Die Aktionsleiste unter einem Post (Gefällt mir, Kommentieren, etc.)
  aktionsleiste: [
    ".feed-shared-social-action-bar",
    ".social-actions-bar",
    ".feed-shared-update-v2__social-actions",
    ".update-v2-social-activity",
  ],
};

// Markierung, die wir an bereits verarbeitete Posts hängen
// damit wir sie nicht doppelt verarbeiten
const VERARBEITET_MARKER = "linkedin-cleaner-verarbeitet";

// ============================================================
// Hilfsfunktion: Findet ein Element innerhalb eines Containers
// anhand einer Liste von möglichen Selektoren (Fallback-Kette)
// ============================================================
function findeElement(container, selektorListe) {
  for (const selektor of selektorListe) {
    const element = container.querySelector(selektor);
    if (element) return element;
  }
  return null;
}

// ============================================================
// Post-Text extrahieren: Holt den reinen Text aus einem Post-Container
// ============================================================
function extrahierePostText(postContainer) {
  const textElement = findeElement(postContainer, SELEKTOREN.postText);
  if (!textElement) return null;

  // Inneren Text nehmen und mehrfache Leerzeichen/Zeilenumbrüche bereinigen
  return textElement.innerText?.trim().replace(/\n{3,}/g, "\n\n") || null;
}

// ============================================================
// Button erstellen: Erzeugt den "🧹 Aufräumen"-Button
// ============================================================
function erstelleButton() {
  const button = document.createElement("button");
  button.className = "linkedin-cleaner-btn";
  button.innerHTML = "🧹 Aufräumen";
  button.title = "LinkedIn-Speak in klares Deutsch übersetzen";
  return button;
}

// ============================================================
// Ergebniskarte erstellen: Zeigt den bereinigten Text an
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

// Sicherheitsfunktion: HTML-Sonderzeichen escapen um XSS zu verhindern
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ============================================================
// Hauptfunktion: Verarbeitet einen einzelnen Post-Container
// Fügt den Button hinzu und verdrahtet die Logik
// ============================================================
function verarbeitePost(postContainer) {
  // Nicht doppelt verarbeiten
  if (postContainer.dataset[VERARBEITET_MARKER]) return;
  postContainer.dataset[VERARBEITET_MARKER] = "true";

  // Aktionsleiste finden (wo wir den Button einhängen)
  const aktionsleiste = findeElement(postContainer, SELEKTOREN.aktionsleiste);
  if (!aktionsleiste) return; // Ohne Aktionsleiste kein guter Platz für den Button

  // Button-Wrapper erstellen und Button einhängen
  const buttonWrapper = document.createElement("div");
  buttonWrapper.className = "linkedin-cleaner-btn-wrapper";
  const button = erstelleButton();
  buttonWrapper.appendChild(button);
  aktionsleiste.appendChild(buttonWrapper);

  // Zustandsvariablen für diesen Post
  let karte = null;      // Die eingeblendete Ergebniskarte
  let laedt = false;    // Verhindert Doppelklicks während des Ladens

  // Klick-Handler für den Button
  button.addEventListener("click", async () => {
    // Wenn Karte bereits sichtbar: ausblenden (Toggle)
    if (karte) {
      karte.remove();
      karte = null;
      button.innerHTML = "🧹 Aufräumen";
      button.disabled = false;
      return;
    }

    // Doppelklick verhindern
    if (laedt) return;
    laedt = true;
    button.innerHTML = "⏳ Übersetze...";
    button.disabled = true;

    // Post-Text extrahieren
    const postText = extrahierePostText(postContainer);
    if (!postText) {
      zeigeFehler(postContainer, "Kein Text im Post gefunden.");
      button.innerHTML = "🧹 Aufräumen";
      button.disabled = false;
      laedt = false;
      return;
    }

    // Anfrage an background.js senden (der macht den API-Call)
    chrome.runtime.sendMessage(
      { action: "cleanPost", postText: postText },
      (antwort) => {
        laedt = false;
        button.disabled = false;

        // Verbindungsfehler zur Extension
        if (chrome.runtime.lastError) {
          button.innerHTML = "🧹 Aufräumen";
          zeigeFehler(postContainer, "Verbindung zur Extension unterbrochen.");
          return;
        }

        if (antwort.success) {
          // Erfolg: Ergebniskarte einblenden
          button.innerHTML = "✕ Schließen";
          karte = erstelleErgebniskarte(antwort.text);
          // Karte wird nach dem Post-Container eingefügt
          postContainer.after(karte);
        } else {
          button.innerHTML = "🧹 Aufräumen";
          // Fehlermeldung je nach Fehlertyp anpassen
          if (antwort.error === "KEIN_API_KEY") {
            zeigeFehler(
              postContainer,
              "Bitte API-Key in den Einstellungen eintragen (Klick auf das Extension-Symbol)."
            );
          } else {
            zeigeFehler(
              postContainer,
              "Übersetzung fehlgeschlagen – bitte erneut versuchen."
            );
          }
        }
      }
    );
  });
}

// ============================================================
// Fehlermeldung anzeigen: Zeigt eine temporäre Fehlerkarte
// Die Karte verschwindet nach 5 Sekunden automatisch
// ============================================================
function zeigeFehler(postContainer, nachricht) {
  const fehlerKarte = document.createElement("div");
  fehlerKarte.className = "linkedin-cleaner-karte linkedin-cleaner-fehler";
  fehlerKarte.innerHTML = `<p class="linkedin-cleaner-text">⚠️ ${escapeHtml(nachricht)}</p>`;
  postContainer.after(fehlerKarte);

  // Nach 5 Sekunden automatisch ausblenden
  setTimeout(() => fehlerKarte.remove(), 5000);
}

// ============================================================
// MutationObserver: Beobachtet den Feed auf neu geladene Posts
// LinkedIn lädt Posts dynamisch nach (Infinite Scroll), daher
// reicht es nicht, einmalig beim Laden der Seite zu scannen.
// ============================================================
function starteMutationObserver() {
  const observer = new MutationObserver((mutationen) => {
    for (const mutation of mutationen) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Prüfen ob der neue Node selbst ein Post-Container ist
        for (const selektor of SELEKTOREN.postContainer) {
          if (node.matches && node.matches(selektor)) {
            verarbeitePost(node);
            break;
          }
        }

        // Auch nach Post-Containern innerhalb des neuen Nodes suchen
        for (const selektor of SELEKTOREN.postContainer) {
          const posts = node.querySelectorAll(selektor);
          posts.forEach(verarbeitePost);
        }
      }
    }
  });

  // Den gesamten Body beobachten auf neue Kindelemente
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ============================================================
// Initialisierung: Beim ersten Laden der Seite bestehende Posts
// verarbeiten und dann den Observer starten
// ============================================================
function initialisiere() {
  // Bereits vorhandene Posts verarbeiten
  for (const selektor of SELEKTOREN.postContainer) {
    document.querySelectorAll(selektor).forEach(verarbeitePost);
  }

  // Observer starten für dynamisch nachgeladene Posts
  starteMutationObserver();
}

// Starten sobald das DOM bereit ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialisiere);
} else {
  initialisiere();
}
