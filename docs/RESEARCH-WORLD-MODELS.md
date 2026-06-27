# World Models in der KI – und ob XDAB eine begehbare Interior-Design-App bauen sollte

## TL;DR
- **World Models sind die heißeste KI-Wette nach den LLMs**: Yann LeCun verließ Meta im November 2025 und sammelte mit AMI Labs im März 2026 1,03 Mrd. $ ein, Fei-Fei Lis World Labs liegt bei über 1,2 Mrd. $ Finanzierung – beide bauen "Weltmodelle" statt LLMs. Das Konzept selbst geht auf Schmidhubers Arbeit von 1990 und das Ha-&-Schmidhuber-Paper von 2018 zurück.
- **Eine begehbare "Raum-aus-Foto"-App ist heute technisch machbar – aber nicht über ein selbst trainiertes World Model**, sondern durch Kombination einer fertigen API (World Labs Marble, ab 20 $/Monat, Export als Gaussian Splats + Collider-Mesh) oder Open-Source (Tencent HunyuanWorld) mit einem Web-Viewer (three.js + Gaussian-Splatting). Ein erster Prototyp ist in Wochen, nicht Jahren, baubar.
- **Für XDAB lautet die Empfehlung: als optionales "Wow"-Feature ja, als DSGVO-Kernversprechen nein.** Die besten Generierungsmodelle laufen in den USA; echte EU-/Self-Hosting-Konformität erfordert Open-Source-Modelle auf eigener GPU-Infrastruktur. Pragmatisch: zuerst mit Marble-API einen Prototyp validieren, parallel HunyuanWorld self-hosted für die DSGVO-Variante evaluieren.

## Key Findings

1. **Zwei Begriffe, ein Name.** "World Model" bezeichnet zwei verschiedene Dinge: (a) ein *internes, prädiktives* Modell, das ein Agent nutzt, um Konsequenzen von Handlungen vorherzusagen (Schmidhuber 1990, LeCun/JEPA) und (b) ein *generatives* Modell, das eine *externe* 3D-Umgebung erzeugt, in der man sich bewegen kann (World Labs Marble, DeepMind Genie 3). Für die Interior-App ist nur (b) relevant.

2. **LeCun und Schmidhuber sind sich einig, dass LLMs nicht der Weg zu menschenähnlicher KI sind – und streiten um Urheberschaft.** Beide setzen auf Weltmodelle. Schmidhuber reklamiert die Erfindung für sich (1990), LeCun hat das Thema mit JEPA (2022) und V-JEPA 2 (2025) populär gemacht.

3. **Der Markt ist 2025/2026 explodiert**: World Labs Marble (kommerziell, API), DeepMind Genie 3 (Research-Preview), NVIDIA Cosmos (Open-Weight), Tencent HunyuanWorld (Open Source), Decart Oasis 3 (API). Nur wenige sind für Entwickler frei nutzbar.

4. **Für Interior Design gibt es eine echte Marktlücke**: Bestehende Tools (Planner5D, Coohom, Spacely, REimagine Home) liefern entweder 2D→3D-Renderings/Walkthroughs aus Möbel-Katalogen oder flache "Foto-Restyling"-Bilder – aber kein Tool erzeugt aus *einem realen Raumfoto* eine *photorealistische, begehbare 3D-Welt*. Genau das können World Models jetzt.

## Details

### 1. Die zwei Personen: Schmidhuber und LeCun

**Jürgen Schmidhuber (KAUST/IDSIA).** Mitautor (mit Sepp Hochreiter) der LSTM-Architektur (1997), die laut mehreren Quellen das meistzitierte KI-Paper des 20. Jahrhunderts ist. Sein zentraler Beitrag zu Weltmodellen:
- **Das Paper "World Models" (Ha & Schmidhuber, 2018; NeurIPS-Version "Recurrent World Models Facilitate Policy Evolution", arXiv:1803.10122 / 1809.01999).** Kernidee: Ein Agent wird in drei Komponenten zerlegt – **V** (Vision, ein Variational Autoencoder, der Pixel in einen latenten Vektor komprimiert), **M** (Memory, ein RNN/MDN-RNN, das die zeitliche Dynamik vorhersagt) und **C** (Controller, eine kleine Policy). Spektakulärstes Ergebnis: Der Agent kann *vollständig in seinem eigenen "geträumten"* (halluzinierten) Weltmodell trainiert und die Policy dann zurück in die echte Umgebung übertragen werden (VizDoom, CarRacing-v0).
- **Priorität ab 1990.** Schmidhuber reklamiert die Erfindung des neuronalen Weltmodells für sich: Im Technical Report **"Making the World Differentiable" (FKI-126-90, TU München, 1990)** beschrieb er ein rekurrentes "Controller/Model"-System (C/M), bei dem M die Konsequenzen der Aktionen von C vorhersagt und C M zum Vorausplanen nutzt. Ergänzt durch seine "Artificial Curiosity"-Papiere (1990/1991), in denen ein Agent intrinsisch belohnt wird, wenn er das Weltmodell verbessert. Das 2018er Paper sagt selbst wörtlich: *"Using RNNs to develop internal models to reason about the future has been explored as early as 1990 in a paper called Making the World Differentiable."* Auf X kontert Schmidhuber LeCun direkt: *"I've been publishing deep learning architectures capable of planning since 1990."* 2026 veröffentlichte er die Technical Note **"The Neural World Model Boom"** (IDSIA), die den heutigen Boom (Genie, Sora, Cosmos, World Labs) auf seine Arbeit von 1990–2015 zurückführt.
- **Aktuelle Position (2024 WAIC-Interview, jazzyear.com).** Schmidhuber trennt scharf LLMs von AGI: *"It's just that the scaling of present LLMs has little to do with AGI... How does a baby learn? Not by downloading the web. It learns to collect data through self-invented experiments that improve its adaptive neural world model, which it can use for planning. All of this, however, has little to do with the LLMs that are now so popular."* Er sieht den nächsten Schritt in *"true AGI in the physical world, not just today's AI behind the screen."*

**Yann LeCun (vormals Meta, jetzt AMI Labs).** Turing-Award 2018 (mit Hinton, Bengio), Erfinder der CNNs.
- **Positionspapier "A Path Towards Autonomous Machine Intelligence" (OpenReview, 27.06.2022).** Entwirft eine Architektur autonomer Maschinen-Intelligenz aus sechs Modulen: Configurator, Perception, **World Model**, Cost, Actor, Short-term Memory. Das zentrale Lernprinzip ist die **Joint Embedding Predictive Architecture (JEPA)**: Statt Pixel oder Token vorherzusagen (wie generative Modelle/LLMs), sagt JEPA *abstrakte Repräsentationen im latenten Raum* voraus und ignoriert irrelevantes Rauschen.
- **JEPA-Familie**: I-JEPA (Bilder, 2023), V-JEPA (Video, 2024), **V-JEPA 2 (11.06.2025, arXiv:2506.09985)** – trainiert auf >1 Mio. Stunden Internet-Video + 1 Mio. Bildern; die action-conditioned Variante **V-JEPA 2-AC** (300M-Parameter-Transformer) wurde mit nur 62 Stunden unannotiertem Robotervideo (Droid-Dataset) feinjustiert und steuert Roboterarme **zero-shot** in neuen Laboren via Model-Predictive Control. Laut Metas eigenen internen Tests ist V-JEPA 2 30× schneller als NVIDIA Cosmos; TechCrunch (11.6.2025) ordnet das ein: *"According to Meta, V-JEPA 2 is 30x faster than Nvidia's Cosmos model... However, Meta may be evaluating its own models according to different benchmarks than Nvidia."* LeJEPA (Nov. 2025) ist die jüngste theoretische Weiterentwicklung.
- **Bruch mit Meta und AMI Labs.** LeCun bestätigte am 19.11.2025 seinen Weggang von Meta nach 12 Jahren. Gründe laut seinen eigenen Aussagen: Zerwürfnis nach dem Llama-4-Launch (*"Results were fudged a little bit"*) und Metas Schwenk weg von Grundlagenforschung. Sein O-Ton zu LLMs: *"They are not a path to human-level intelligence. They're just not."* Seine neue Firma **Advanced Machine Intelligence Labs (AMI Labs)**, mit CEO Alexandre LeBrun (LeCun = Executive Chair), wurde am 10.03.2026 mit **1,03 Mrd. $ Seed bei 3,5 Mrd. $ Pre-Money-Bewertung** angekündigt – die größte Seed-Runde der europäischen Startup-Geschichte, ko-geleitet u.a. von Bezos Expeditions, mit NVIDIA, Samsung, Toyota Ventures. Sitz: Paris. AMI baut Weltmodelle auf Basis von V-JEPA. Wichtig für die Einordnung: LeBrun sagt selbst, das sei *"not your typical applied AI startup"* – kommerzielle Anwendungen könnten *Jahre* dauern.

**Übereinstimmung vs. Widerspruch.** Beide stimmen überein: LLMs allein führen nicht zu menschenähnlicher Intelligenz; Weltmodelle, die Physik/Kausalität lernen, sind der Weg. **Widerspruch**: (a) Urheberschaft – Schmidhuber wirft LeCun öffentlich vor, seine Ideen von 1990 ohne Credit zu rezyklieren; (b) Architektur – LeCun setzt strikt auf *nicht-generative* latente Vorhersage (JEPA), während Schmidhubers Linie und die heutigen generativen World Models (Genie, Marble) durchaus pixel-/szenengenerativ sind.

### 2. Was World Models sind und warum sie als "das, was nach LLMs kommt" gelten

Ein World Model ist ein Modell, das den Zustand und die Dynamik einer Umgebung so repräsentiert, dass ein System vorhersagen kann, *wie sich die Welt entwickelt und wie eigene Aktionen sie verändern*. Abgrenzung zu LLMs: Ein LLM sagt das nächste Token (Wort) voraus und ist im Kern ein "Information-Retrieval-/Kompositions-System" (LeCun: *"mostly information retrieval systems"*). Ein World Model sagt den *nächsten Zustand der Welt* voraus und zielt auf Kausalität, Physik und Planung. Pointiert formuliert es Graison Thomas ("World Models: The Next Leap Beyond LLMs", Medium): *"If LLMs made AI good at recalling and composing, world models are how we make AI good at foreseeing and doing."*

Historische Linie: Plato/Aristoteles (mentale Modelle) → Sutton (Dyna, Model-based RL, 1990) → **Schmidhuber "Making the World Differentiable" (1990)** → **Ha & Schmidhuber "World Models" (2018)** → Dreamer/DreamerV3 (Hafner et al.), MuZero (DeepMind) → die generative Welle 2023–2026 (GAIA-1, Genie, Sora als "World Simulator", V-JEPA 2, Cosmos, Marble).

Wichtige konzeptionelle Unterscheidung (für die App entscheidend): **Video-Generierung ≠ World Model.** Ein Video (Sora, Veo) zeigt, wie eine Szene über die Zeit aussieht; ein echtes World Model erlaubt, *eine Aktion auszuführen und die Umgebung live reagieren zu sehen*. Interaktivität ist das Unterscheidungsmerkmal.

### 3. Aktueller Stand der Technik und die wichtigsten Player (2025/2026)

| Produkt | Anbieter | Was es kann | Zugang für Entwickler |
|---|---|---|---|
| **Marble** | World Labs (Fei-Fei Li) | Erzeugt *persistente*, editierbare 3D-Welten aus Text, Bild, Video, Panorama oder grobem 3D-Layout; Export als **Gaussian Splats (.ply/.spz), Mesh (GLB) oder Video** | **Ja**: Web-App + **öffentliche World API** (seit 2025); Free (4 Welten/Monat), Standard 20 $, Pro 35 $, Max 95 $ |
| **Genie 3** | Google DeepMind | Echtzeit-begehbare Welten aus Textprompt, 720p @ 24fps, konsistent "für einige Minuten" | **Eingeschränkt**: "Project Genie" nur für Google-AI-Ultra-Abonnenten (US, ab 29.01.2026); keine offene API |
| **Cosmos** | NVIDIA | World Foundation Models für *Physical AI* (Robotik/AV); physik-bewusste Video-/Szenengenerierung, synthetische Trainingsdaten | **Ja, Open-Weight**: NVIDIA Open Model License, Code Apache 2.0; auf GitHub/Hugging Face/NGC; self-hostbar (H100-Klasse) |
| **HunyuanWorld 1.0 / 1.5** | Tencent | Erstes *Open-Source* simulationsfähiges 3D-Weltgenerierungsmodell; Text/Bild→begehbares 3D-Mesh; 1.0-Lite läuft auf RTX 4090; 1.5 (WorldPlay) echtzeit-interaktiv @ 24 FPS | **Ja, Open Source**: GitHub/Hugging Face; Mesh-Export für Game-Engines |
| **Oasis 3** | Decart | Echtzeit-interaktives, photorealistisches Fahrumgebungs-Weltmodell; Multi-Kamera; <200ms Latenz | **Ja, API**: 0,02 $/Sekunde; Fokus AV/Robotik |
| **RTFM** | World Labs | Echtzeit-generatives Frame-Modell (Research Preview) | Research Preview |

Zur finanziellen Einordnung des Booms: World Labs hat laut StartupHub.ai (3.6.2026) insgesamt rund 1,23 Mrd. $ über zwei Runden eingesammelt; die jüngste, am 18.2.2026 von Bloomberg gemeldete Runde brachte 1 Mrd. $ (inkl. 200 Mio. $ von Autodesk) bei Bewertungsgesprächen um ~5 Mrd. $. Decart sammelte vor dem Oasis-3-Launch 300 Mio. $ bei knapp 4 Mrd. $ Bewertung ein (Investoren u.a. Toyota, Adobe, eBay, NVIDIA).

**Einordnung für die Interior-App**: Marble ist die einzige Lösung, die (a) eine offene API hat, (b) aus *einem Foto* eine *persistente, downloadbare, begehbare* 3D-Welt mit echter Geometrie (Gaussian Splats + Collider-Mesh) macht und (c) im Browser via three.js renderbar ist. NVIDIA hat einen vollständigen Workflow Marble→Isaac Sim dokumentiert. Genie 3 ist beeindruckend, aber geschlossen und nicht persistent. HunyuanWorld ist die ernstzunehmende Open-Source/Self-Hosting-Alternative.

### 4. Technische Machbarkeit: vom Raumfoto zum begehbaren 3D-Raum

Es gibt drei realistische Pfade:

**Pfad A – Generatives World Model via API (heute produktiv).**
1. Nutzer lädt Raumfoto in der React-PWA hoch → FastAPI-Backend.
2. Backend ruft **World Labs Marble World API** auf (Input: Bild; optional mehrere Bilder/Video für Digital Twin).
3. API liefert eine 3D-Welt zurück; Export als **Gaussian Splat (.spz/.ply)** plus **Collider-Mesh (GLB)** für Physik.
4. Frontend rendert den Splat im Browser mit **Spark** (World Labs' Open-Source three.js-Renderer) oder **GaussianSplats3D** (mkkellogg, three.js) – Nutzer bewegt sich frei (WASD/Touch).
5. Physik/Kollision optional über das Collider-Mesh (z.B. mit cannon-es/Rapier in three.js oder Babylon.js).
- *Realismus*: hoch (photorealistisch). *Aufwand*: gering. *Forschung vs. produktiv*: produktiv. *Schwäche*: Geometrie kann an Rändern verzerren; Objekte sind statisch.

**Pfad B – Self-hosted Open-Source-Pipeline (DSGVO-Variante).**
- **HunyuanWorld 1.0-Lite** (läuft auf einer RTX 4090, <17 GB VRAM) oder **NVIDIA Cosmos** auf eigener EU-GPU-Infrastruktur. Input Bild/Text → Mesh/3DGS-Export → gleicher three.js-Viewer wie Pfad A.
- *Realismus*: gut. *Aufwand*: hoch (GPU-Ops, Modell-Tuning). *Datenstandort*: vollständig kontrollierbar (kein US-Transfer).

**Pfad C – Klassische, nicht-generative Rekonstruktion (am robustesten geometrisch).**
- **Monokulare Tiefenschätzung** (Depth Pro, MiDaS/Ranftl et al.), **Raum-Layout-Schätzung** (LayoutNet/Manhattan-Layout aus 360°-Panorama), **Structure-from-Motion + 3D Gaussian Splatting** (Kerbl et al. 2023) oder **NeRF**. Feed-forward-Modelle wie **Splatt3R/DepthSplat/MVSplat** erzeugen Splats aus wenigen Bildern.
- *Realismus*: hoch, wenn genug Aufnahmen; *Aufwand*: mittel-hoch; benötigt mehrere Fotos/Video, nicht *ein* Foto. **Gaussian Splatting** hat NeRF für Echtzeit-/Web-Anwendungen überholt (100+ FPS, web-nativ), ist aber für *Messgenauigkeit* ungeeignet (mittlerer Geometriefehler im Zentimeterbereich).

**Render-/Physik-Engines**: Für eine PWA ist **three.js** (mit Gaussian-Splatting-Libs) oder **Babylon.js** der natürliche Weg; **Unity/Unreal** nur bei nativen Apps/höchstem Realismus. glTF hat seit August 2025 eine offizielle Gaussian-Splatting-Erweiterung (KHR_gaussian_splatting), was Interoperabilität verbessert.

### 5. Interior Design speziell: Wettbewerber und Marktlücke

**Bestehende Tools:**
- **Planner5D** (Sitz Vilnius, Litauen): 2D/3D-Floorplanner, AI-Floorplan-Recognition, "3D & VR Walkthrough" – aber katalogbasiert (Möbel werden platziert), nicht aus realem Foto rekonstruiert. Das Unternehmen nennt auf seiner About-Seite "over 120 millions of users and more than 400 million interior design projects created".
- **Coohom**: Floorplan→3D-Render, 4K-Rendering, immersive Walkthroughs; B2B-/Retail-Fokus; Pro ab 9,90 $/Monat.
- **Spacely AI / REimagine Home / Interior AI / HomeDesigns AI**: Generatives *Bild-Restyling* aus Fotos (Virtual Staging, Stilwechsel) – aber **2D-Output**, kein begehbarer 3D-Raum. REimagine Home explizit: *"Visuals are for concept exploration; they are not guaranteed to be dimensionally accurate."* Interior AI bietet "3D Flythrough Videos" – aber Video, nicht interaktiv begehbar.

**Marktlücke**: Kein etabliertes Interior-Tool erzeugt aus *einem Foto eines realen Raums* eine *photorealistische, frei begehbare 3D-Welt*. Die generativen Restyling-Tools sind 2D; die 3D-Planner sind katalog-/CAD-basiert und sehen nicht photorealistisch aus. Ein World-Model-Ansatz (Marble/HunyuanWorld + Restyling) könnte beides verbinden: realer Raum → begehbares 3D → KI-gestütztes Re-Design im Raum. Differenzierung für XDAB: **DSGVO-konform + EU-Hosting + "walk through your own room"**.

### 6. Geschäfts- und Integrationswinkel für XDAB

**Was nötig ist (Pfad A, Prototyp):** FastAPI-Endpoint, der Marble World API aufruft; Job-Queue (Generierung dauert Sekunden bis Minuten, asynchron); S3-kompatibler EU-Objektspeicher für die Splat-Dateien; React/Vite-Viewer mit Spark/GaussianSplats3D. Realistisch in Wochen baubar.

**Kosten/Latenz:** Marble: Abomodell ab 20 $/Monat (12 Welten) bis 95 $/Monat (75 Welten); pro-Generierung-Credits. Decart Oasis 3: 0,02 $/Sek (aber AV-Fokus, kein persistenter Export). Self-hosted (HunyuanWorld-Lite/Cosmos): GPU-Kosten – eine H100 ~2 $/Stunde in der Cloud; eine RTX-4090-Klasse reicht für HunyuanWorld-Lite. Genie 3 scheidet mangels API aus.

**DSGVO/EU-Aspekte (kritisch für XDAB's Positionierung):**
- Raumfotos können *personenbezogene Daten* enthalten (Gesichter, Wohnungsinneres = Rückschluss auf Person). Upload an eine US-API (World Labs, Decart) ist ein **Drittlandtransfer** nach DSGVO Kap. V (Art. 44–50) und erfordert SCCs + Transfer-Impact-Assessment (Schrems II), bzw. Data-Privacy-Framework-Zertifizierung des US-Anbieters.
- World Labs ist US-Anbieter; eine spezifische EU-Datenresidenz oder ein "Zero-Retention-Mode" ist für Marble nicht dokumentiert (anders als z.B. bei OpenAI/ElevenLabs, die EU-Residency anbieten). Die kommerziellen Nutzungsrechte gibt es zudem erst ab dem Pro-Tier; Free/Standard nicht für kommerzielle Auslieferung.
- **DSGVO-konformer Weg = Self-Hosting** von HunyuanWorld/Cosmos auf EU-GPU (z.B. deutscher/EU-Cloud-Anbieter). Dann bleiben die Fotos im EU-Raum, kein Drittlandtransfer.

**Realismus-Einschätzung:** Für ein kleines deutsches Team ist ein **Prototyp heute realistisch** (Pfad A), ein **DSGVO-konformes Produktionsfeature mittelfristig realistisch** (Pfad B, mit GPU-Invest), ein **eigenes trainiertes World Model = Zukunftsmusik** (LeCuns AMI und World Labs verbrennen dafür Milliarden). Der Reifegrad insgesamt: Decart-CEO Dean Leitersdorf räumt zum Oasis-3-Launch ein (zit. nach AI Chat Daily), World Models seien als Feld noch früh – *"closer to GPT-2 than to GPT-4 in maturity."* Konsistenz/Object-Permanence sind ungelöst.

## Recommendations

**Phase 0 – Validierung (jetzt, 1–2 Wochen):** Marble manuell mit echten Raumfotos testen (Free/Standard-Tier, 20 $). Frage: Ist die Qualität "begehbar genug"? Splat im Browser mit GaussianSplats3D rendern. Benchmark: Wenn ein typisches Kundenfoto eine überzeugende, navigierbare Szene liefert (keine groben Rand-Artefakte) → weiter.

**Phase 1 – Prototyp "walkable room from a photo" (4–8 Wochen):** Minimaler Stack: React/Vite-PWA (Upload + three.js/Spark-Viewer) → FastAPI (Job-Queue, async) → Marble World API (Pro-Tier wegen kommerzieller Rechte) → EU-Objektspeicher für Splats. Klar als "Beta/experimentell" labeln. Datenschutz: explizite Einwilligung für US-Verarbeitung einholen, in der RoPA (Verzeichnis der Verarbeitungstätigkeiten) dokumentieren.

**Phase 2 – DSGVO-Variante evaluieren (parallel/danach):** HunyuanWorld 1.0-Lite auf einer EU-GPU-Instanz (RTX-4090-/L40S-Klasse) self-hosten, Qualität gegen Marble benchmarken. Wenn akzeptabel → das wird euer DSGVO-USP: "Dein Raum verlässt nie die EU."

**Phase 3 – Differenzierung:** Begehbare Szene + KI-Re-Design im Raum (Möbel tauschen/Stil ändern) kombinieren. Hier liegt die Marktlücke gegenüber Planner5D (katalogbasiert) und REimagine Home (nur 2D).

**Schwellen, die die Empfehlung ändern:** (a) Falls World Labs eine EU-Datenresidenz/Zero-Retention für die API einführt → Pfad A wird auch DSGVO-tauglich, Self-Hosting unnötig. (b) Falls HunyuanWorld-Qualität an Marble herankommt → direkt Pfad B als Kern. (c) Falls die Splat-Qualität auf typischen Smartphone-Fotos zu schlecht ist → auf Mehrbild-/Video-Input (Pfad C) umstellen oder Feature zurückstellen.

## Caveats
- **Begriffsverwirrung**: "World Model" wird für interne prädiktive Modelle (JEPA) *und* generative 3D-Welten (Marble) verwendet – nur Letzteres ist für die App relevant.
- **Reifegrad**: Generative World Models sind 2026 noch jung; Szenen "brechen" nach wenigen Schritten/Minuten, Geometrie verzerrt an Rändern, Objekte sind statisch. Nicht messgenau (kein Ersatz für CAD/Aufmaß).
- **Schmidhubers Prioritätsansprüche** sind seine eigene Sichtweise und in der Community umstritten; die Zuschreibung "der heutige Boom baut auf meiner Arbeit von 1990" ist sein Framing. Die meisten Sekundärquellen kreditieren Schmidhuber 1990 und Suttons Dyna gemeinsam als Ursprünge und das Ha-&-Schmidhuber-Paper von 2018 als Ursprung des modernen *Begriffs* "World Models".
- **Marketing-Sprache**: Viele Genie-3-/World-Model-"Landingpages" (genie3.im, genie3.net etc.) sind SEO-/Affiliate-Seiten, nicht offizielle Quellen; offizielle Daten stammen von deepmind.google, worldlabs.ai, ai.meta.com.
- **Preise/Tiers** (Marble, Decart) und Finanzierungsstände können sich schnell ändern; Stand dieser Recherche ist Juni 2026.
- **DSGVO**: Die Aussage "kein US-Transfer bei Self-Hosting" gilt nur, wenn die gesamte Pipeline (inkl. Modellgewichte, Inferenz, Speicher) in der EU liegt; das ist mit Open-Source-Modellen (HunyuanWorld/Cosmos) möglich, mit den US-APIs nicht.