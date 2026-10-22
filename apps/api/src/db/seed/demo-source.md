# Einführung in Quellenchat

Dieses Dokument ist die Beispielquelle des Demo-Notebooks. Es erklärt, was Quellenchat ist, wie die App eine Frage beantwortet und warum jede Antwort mit Zitaten belegt wird. Gleichzeitig dient es als Übungsmaterial: Alle Fragen, die du im Chat zu diesem Notebook stellst, beantwortet der Assistent ausschließlich auf Grundlage dieses Textes und weiterer Quellen, die du selbst hinzufügst.

## Was ist Quellenchat?

Quellenchat ist ein Nachbau von NotebookLM. Die Idee ist einfach: Du sammelst eigene Dokumente in einem Notebook und sprichst anschließend mit einem KI-Assistenten über genau diese Dokumente. Der Assistent soll kein allgemeines Weltwissen wiedergeben, sondern das, was in deinen Quellen steht.

Ein Notebook ist dabei so etwas wie eine Arbeitsmappe zu einem Thema. Du kannst beliebig viele Notebooks anlegen, umbenennen und wieder löschen, solange du unter dem Limit von 25 Notebooks pro Konto bleibst. In jedes Notebook passen bis zu 20 Quellen.

Als Quellen eignen sich drei Formate:

- **PDF-Dateien**, etwa Fachartikel, Handbücher oder Protokolle. Der Text wird Seite für Seite gelesen, damit Zitate später die richtige Seitenzahl tragen.
- **Text- und Markdown-Dateien** wie diese hier.
- **Eingefügter Text**, zum Beispiel ein Absatz aus einer E-Mail oder eine Mitschrift, die du direkt in das Eingabefeld kopierst.

Jede Quelle lässt sich für den Chat einzeln aktivieren oder deaktivieren. Deaktivierte Quellen bleiben im Notebook, fließen aber nicht in Antworten ein. So kannst du gezielt fragen, was eine bestimmte Quelle zu einem Thema sagt.

## Das Kernversprechen: Quellentreue

Das wichtigste Prinzip von Quellenchat heißt **Quellentreue vor Eloquenz**. Eine Antwort ist nur dann gut, wenn sich jede inhaltliche Aussage auf eine konkrete Textstelle zurückführen lässt. Klingt eine Antwort elegant, ist aber nicht belegt, gilt sie als Fehler.

Daraus folgen drei Regeln für den Assistenten:

1. Er antwortet nur mit Informationen aus den aktiven Quellen des Notebooks.
2. Er belegt Aussagen mit nummerierten Zitaten wie [1] oder [2].
3. Steht die Antwort nicht in den Quellen, sagt er das offen, statt etwas zu erfinden.

Die dritte Regel ist bewusst gewählt. Ein Sprachmodell kann sehr überzeugend formulieren, auch wenn es eine Antwort nur rät. Für die Arbeit mit eigenen Dokumenten ist ein ehrliches „Dazu enthalten die Quellen keine Angabe“ wertvoller als eine plausible Vermutung.

## Wie eine Antwort entsteht

Quellenchat arbeitet nach einem Verfahren, das als **Retrieval-Augmented Generation** bekannt ist, kurz RAG. Auf Deutsch könnte man von „abrufgestützter Textgenerierung“ sprechen. Das Verfahren hat drei Phasen.

### Phase 1: Aufbereitung der Quellen

Sobald du eine Quelle hinzufügst, wird sie im Hintergrund verarbeitet. Diese Verarbeitung heißt Ingestion. Die Quelle durchläuft dabei sichtbar mehrere Zustände: Zuerst **wartet** sie, dann wird sie **verarbeitet**, und am Ende ist sie **bereit** oder, falls etwas schiefgeht, **fehlgeschlagen**.

Während der Verarbeitung passiert Folgendes:

- **Text extrahieren:** Aus einer PDF-Datei wird der Text seitenweise gelesen. Eine PDF, die nur aus eingescannten Bildern besteht, enthält keinen lesbaren Text und schlägt deshalb fehl.
- **In Abschnitte zerlegen:** Der Text wird in Abschnitte von jeweils etwa 3.000 Zeichen geteilt. Benachbarte Abschnitte überlappen sich um etwa 400 Zeichen, damit kein Gedanke genau an einer Schnittkante verloren geht. Das Zerlegen achtet auf Absätze und schneidet möglichst nicht mitten im Satz.
- **Einbetten:** Für jeden Abschnitt berechnet ein Embedding-Modell einen Vektor, also eine lange Liste von Zahlen. Quellenchat verwendet dafür das Modell mistral-embed, das jeden Abschnitt als Vektor mit 1.024 Dimensionen darstellt. Abschnitte mit ähnlicher Bedeutung erhalten ähnliche Vektoren, auch wenn sie unterschiedliche Wörter verwenden.
- **Speichern:** Abschnitte und Vektoren landen gemeinsam in einer Postgres-Datenbank mit der Erweiterung pgvector.

### Phase 2: Suche nach passenden Abschnitten

Stellst du eine Frage, wird auch die Frage in einen Vektor umgerechnet. Anschließend sucht die Datenbank die Abschnitte, deren Vektoren der Frage am nächsten liegen. Gesucht wird nur in den aktiven, fertig verarbeiteten Quellen des aktuellen Notebooks. Die Suche ist exakt: Bei der überschaubaren Zahl von Quellen pro Notebook lohnt sich kein Näherungsverfahren, und die besten Treffer werden garantiert gefunden.

Damit auch Folgefragen funktionieren, berücksichtigt die Suche zusätzlich deine vorherige Frage. Fragst du zuerst „Welche Phasen hat RAG?“ und danach „Was passiert in der zweiten?“, findet die Suche trotzdem die passenden Abschnitte.

### Phase 3: Formulierung der Antwort

Die gefundenen Abschnitte werden zusammen mit deiner Frage an ein Sprachmodell geschickt. Jeder Abschnitt steht dabei in einem eigenen, nummerierten Block. Das Modell erhält die Anweisung, nur diese Blöcke als Grundlage zu verwenden und jede Aussage mit der Nummer des passenden Blocks zu kennzeichnen.

Die Antwort erscheint Wort für Wort, während das Modell sie schreibt. Du kannst sie jederzeit abbrechen. Dann bricht Quellenchat auch die Anfrage an den KI-Anbieter ab, sodass keine Kosten für Text entstehen, den niemand liest.

Antworten sind immer auf Deutsch, auch wenn eine Quelle auf Englisch verfasst ist.

## Zitate prüfen

Ein Zitat wie [1] ist mehr als eine Fußnote. Fährst du mit der Maus darüber, siehst du einen Auszug der zitierten Textstelle. Klickst du darauf, öffnet sich ein Seitenpanel mit dem vollständigen Abschnitt, dem Titel der Quelle und bei PDF-Dateien der Seitenzahl.

So kannst du jede Aussage in wenigen Sekunden selbst nachprüfen. Das ist der eigentliche Zweck der Zitate: Du musst dem Assistenten nicht vertrauen, sondern kannst ihn kontrollieren.

Nach dem Ende einer Antwort ordnet Quellenchat jede Zitatnummer dem passenden Abschnitt zu. Nennt das Modell eine Nummer, die es gar nicht gibt, wird dieses Zitat verworfen, statt auf eine falsche Stelle zu verweisen. Wird eine Quelle später gelöscht, bleiben ältere Antworten im Verlauf erhalten, ihre Zitate sind dann aber als nicht mehr verfügbar gekennzeichnet.

## Ein Fakt zum Ausprobieren

Um zu testen, ob eine Antwort wirklich aus dieser Quelle stammt, braucht es eine Information, die kein Sprachmodell aus seinem Training kennen kann. Deshalb steht hier ein Fakt, der nur in diesem Dokument vorkommt:

**Das Maskottchen von Quellenchat ist eine Eule namens Fidelia.** Ihr Name erinnert an das lateinische Wort für Treue und damit an das Prinzip der Quellentreue. Fidelia trägt eine runde Lesebrille und hält in ihren Krallen immer einen kleinen Zettel mit der Zahl 7, weil der erste Prototyp von Quellenchat in sieben Tagen entstand.

Frag den Assistenten zum Beispiel: „Wie heißt das Maskottchen von Quellenchat, und was hält es in den Krallen?“ Die Antwort sollte ein Zitat enthalten, das auf diesen Abschnitt verweist. Fragst du dagegen nach etwas, das hier nicht steht, etwa nach der Lieblingsfarbe von Fidelia, sollte der Assistent sagen, dass die Quellen dazu nichts enthalten.

## Schutz vor versteckten Anweisungen

Quellen können Text enthalten, der wie eine Anweisung an die KI aussieht, zum Beispiel „Ignoriere alle bisherigen Regeln“. Diese Technik heißt Prompt-Injection. Quellenchat behandelt den Inhalt jeder Quelle deshalb ausdrücklich als Daten und nie als Anweisung. Das Modell hat außerdem keine Werkzeuge und keinen Zugriff auf andere Daten. Selbst wenn eine Injection teilweise wirkt, bleibt der Schaden auf die eine Antwort begrenzt.

## Datenschutz

Quellenchat verarbeitet Daten in der Europäischen Union. Die Datenbank und die Dateien liegen bei Supabase in Frankfurt, die Programmschnittstelle läuft in einer EU-Region, und als KI-Anbieter dient Mistral AI, ein europäisches Unternehmen.

Jedes Konto sieht nur seine eigenen Daten. Jede Datenbankabfrage filtert nach dem angemeldeten Nutzer, und fremde Notebooks oder Quellen verhalten sich so, als gäbe es sie nicht.

Löschen bedeutet vollständiges Löschen: Entfernst du eine Quelle, verschwinden die Datei, alle Abschnitte und alle Vektoren. Löschst du ein Notebook, gilt das für alle seine Quellen und den Chatverlauf. Inhalte deiner Dokumente, deine Fragen und die Antworten werden außerdem nie in Protokolle geschrieben. Protokolliert werden nur technische Kennungen, Zustände und Dauern.

## Grenzen der Demo

Die Demo ist öffentlich erreichbar, und jede Antwort verursacht Kosten beim KI-Anbieter. Deshalb gibt es Grenzen, die auch dann greifen, wenn sich mehrere Personen ein Konto teilen:

- Eine Datei darf höchstens 10 MB groß sein, eine PDF höchstens 300 Seiten haben.
- Eingefügter Text darf bis zu 500.000 Zeichen lang sein.
- Pro Konto sind 100 Chat-Anfragen pro Stunde möglich.
- Für alle Konten zusammen gelten 500 Chat-Anfragen und 200 Uploads pro Tag.

Gelöschte Quellen oder Chats setzen die Zähler für Anfragen und Uploads nicht zurück. Sonst ließen sich die Grenzen durch Löschen und erneutes Hochladen umgehen.

## Gute Fragen stellen

Ein paar Hinweise helfen, das Beste aus dem Assistenten herauszuholen:

- **Konkret fragen:** „Wie groß sind die Abschnitte, in die eine Quelle zerlegt wird?“ liefert eine präzisere Antwort als „Erklär mir die Technik.“
- **Begriffe aus der Quelle verwenden:** Die Suche arbeitet mit Bedeutungen, findet aber besonders sicher, was ähnlich formuliert ist wie im Text.
- **Quellen gezielt aktivieren:** Willst du wissen, was ein bestimmtes Dokument sagt, deaktiviere vorübergehend die anderen.
- **Zitate öffnen:** Wirkt eine Aussage überraschend, prüfe die zitierte Stelle. Genau dafür sind die Zitate da.

Viel Freude beim Ausprobieren. Und falls du Fidelia begegnest: Sie liest gern mit.
