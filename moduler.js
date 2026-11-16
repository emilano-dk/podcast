// Appens moduler. Et nyt modul: en mappe under moduler/ med en fil, der eksporterer
// `mount(ctx)`, og én linje her. Macens side af et modul står i src/mobil_handlinger.py.
export const MODULER = [
  { id: "analytics", navn: "Analytics", ikon: "📈", tekst: "Views, afspilninger og følgere",
    hent: () => import("./moduler/analytics/analytics.js") },
];

// Vises dæmpet i modulvælgeren, så det er tydeligt, at der kommer mere.
export const KOMMER = [
  { navn: "Flere funktioner", ikon: "✨", tekst: "Kommer senere" },
];
