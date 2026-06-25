/* FF&E-Demokatalog — Felder wie in echten Spec-Sheets / Raumbüchern.
   place: Position im 3D-Raum (x,z in m, ry = Drehung), kind: Geometrie-Typ. */
window.CATALOG = [
  { id:"sofa", name:"3-Sitzer Sofa „Lund\"", cat:"Sitzmöbel",
    w:210, d:92, h:78, material:"Bouclé-Stoff, Eiche", color:"#c9c2b4",
    price:1290, brand:"Nordhaus", supplier:"nordhaus.de", lead:"4–6 Wo.",
    props:["abziehbare Bezüge","FSC-Eiche","B210 × T92 × H78 cm"],
    kind:"sofa", place:[-1.6,-1.05,0] },

  { id:"table", name:"Couchtisch „Disc\"", cat:"Tische",
    w:90, d:90, h:38, material:"Eiche massiv", color:"#a9794b",
    price:480, brand:"Nordhaus", supplier:"nordhaus.de", lead:"3 Wo.",
    props:["Massivholz geölt","runde Platte Ø90"],
    kind:"table", place:[-1.6,0.4,0] },

  { id:"chair", name:"Lounge-Sessel „Pebble\"", cat:"Sitzmöbel",
    w:78, d:80, h:74, material:"Leder cognac, Stahl", color:"#8a4f2e",
    price:690, brand:"Atelier Vire", supplier:"vire-furniture.eu", lead:"6–8 Wo.",
    props:["Anilinleder","drehbar"],
    kind:"chair", place:[1.7,0.7,-2.4] },

  { id:"lamp", name:"Stehleuchte „Arc\"", cat:"Leuchten",
    w:40, d:40, h:180, material:"Messing, Marmorfuß", color:"#caa15a",
    price:340, brand:"Lumen&Co", supplier:"lumenco.de", lead:"2 Wo.",
    props:["dimmbar","2700 K warmweiß"],
    kind:"lamp", place:[2.4,0.0,1.6] },

  { id:"rug", name:"Teppich „Dune\"", cat:"Textil",
    w:300, d:200, h:1.5, material:"Wolle, handgetuftet", color:"#b8a892",
    price:560, brand:"Soft Earth", supplier:"softearth.eu", lead:"5 Wo.",
    props:["reine Wolle","300 × 200 cm","schallabsorbierend"],
    kind:"rug", place:[-1.6,-1.4,0] },

  { id:"side", name:"Sideboard „Linn\"", cat:"Stauraum",
    w:160, d:42, h:64, material:"Eichenfurnier", color:"#9c7950",
    price:870, brand:"Nordhaus", supplier:"nordhaus.de", lead:"4 Wo.",
    props:["Soft-Close","Kabeldurchführung"],
    kind:"side", place:[0,1.0,-3.6] },

  { id:"plant", name:"Zimmerpflanze „Ficus\"", cat:"Deko",
    w:60, d:60, h:160, material:"Pflanze + Keramiktopf", color:"#3f7d4f",
    price:120, brand:"GrünRaum", supplier:"gruenraum.de", lead:"1 Wo.",
    props:["pflegeleicht","Topf Ø34"],
    kind:"plant", place:[3.0,0.0,-3.2] }
];

/* FF&E-Tag (pos_nr) + Statuskette ergänzen — Spec-Tag verbindet Plan/Liste/PO/Rechnung. */
window.CATALOG.forEach((it, i) => {
  it.tag = it.tag || ("FF-" + String(i + 1).padStart(2, "0"));
  it.status = it.status || "Vorschlag";
});
window.FFE_STATUS = ["Vorschlag", "Freigabe ausstehend", "freigegeben", "bestellt", "geliefert", "montiert"];

/* Stil-Vorlagen fürs KI-Studio (Prompt-Bausteine). */
window.STYLES = [
  { k:"Skandinavisch", p:"skandinavisch, helle Eiche, weiße Wände, viel Tageslicht, minimalistisch, gemütlich" },
  { k:"Japandi",       p:"Japandi, warme Naturtöne, Holz & Leinen, ruhig, reduziert, handwerklich" },
  { k:"Modern Luxus",  p:"moderne Luxus-Ästhetik, Marmor, Messingakzente, samtige Texturen, indirekte Beleuchtung" },
  { k:"Industrial",    p:"Industrial-Loft, Sichtbeton, schwarzer Stahl, Backstein, Edison-Lampen" },
  { k:"Boho",          p:"Boho, warme Erdtöne, Rattan, Pflanzen, gemusterte Textilien, gemütlich" },
  { k:"Mid-Century",   p:"Mid-Century-Modern, Teakholz, organische Formen, Senfgelb & Petrol-Akzente" },
  { k:"Mediterran",    p:"mediterran, Kalkputz, Terrakotta, Olivgrün, Bögen, warmes Abendlicht" },
  { k:"Minimalistisch",p:"strenger Minimalismus, monochrom, klare Linien, viel Negativraum" }
];
