// popup.js – Logik für das Einstellungs-Popup der Extension
// Dieser Code verwaltet die Eingabe und Speicherung des Anthropic API-Keys.

// DOM-Elemente referenzieren
const eingabeApiKey = document.getElementById("apiKey");
const btnSpeichern = document.getElementById("btnSpeichern");
const meldungErfolg = document.getElementById("meldungErfolg");
const meldungFehler = document.getElementById("meldungFehler");
const keyStatus = document.getElementById("keyStatus");
const keyStatusText = document.getElementById("keyStatusText");

// ============================================================
// Beim Öffnen des Popups: Prüfen ob bereits ein Key gespeichert ist
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("apiKey", (ergebnis) => {
    if (ergebnis.apiKey && ergebnis.apiKey.trim() !== "") {
      // Key vorhanden: Status-Anzeige grün färben
      keyStatus.classList.add("gesetzt");
      keyStatusText.textContent = "API-Key ist gespeichert ✓";

      // Zur Sicherheit: nur die letzten 4 Zeichen des Keys anzeigen
      const letzteZeichen = ergebnis.apiKey.slice(-4);
      eingabeApiKey.placeholder = `...${letzteZeichen} (gespeichert)`;
    } else {
      keyStatus.classList.remove("gesetzt");
      keyStatusText.textContent = "Kein API-Key gespeichert";
    }
  });
});

// ============================================================
// Speichern-Button: API-Key validieren und in Storage speichern
// ============================================================
btnSpeichern.addEventListener("click", () => {
  const apiKey = eingabeApiKey.value.trim();

  // Einfache Validierung: Anthropic API-Keys beginnen mit "sk-ant-"
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    zeigeMeldung("fehler");
    return;
  }

  // Key im lokalen Browser-Storage speichern
  chrome.storage.local.set({ apiKey: apiKey }, () => {
    // Eingabefeld leeren (Key nicht sichtbar lassen)
    eingabeApiKey.value = "";
    eingabeApiKey.placeholder = `...${apiKey.slice(-4)} (gespeichert)`;

    // Status-Anzeige aktualisieren
    keyStatus.classList.add("gesetzt");
    keyStatusText.textContent = "API-Key ist gespeichert ✓";

    // Erfolgsmeldung anzeigen
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
// Nach 3 Sekunden wird die Meldung wieder ausgeblendet
// ============================================================
function zeigeMeldung(typ) {
  // Alle Meldungen zurücksetzen
  meldungErfolg.classList.remove("sichtbar");
  meldungFehler.classList.remove("sichtbar");

  // Passende Meldung einblenden
  if (typ === "erfolg") {
    meldungErfolg.classList.add("sichtbar");
  } else {
    meldungFehler.classList.add("sichtbar");
  }

  // Nach 3 Sekunden automatisch ausblenden
  setTimeout(() => {
    meldungErfolg.classList.remove("sichtbar");
    meldungFehler.classList.remove("sichtbar");
  }, 3000);
}
