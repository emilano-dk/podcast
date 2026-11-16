// Appens moduler. Et nyt modul: en mappe under moduler/ med en fil, der eksporterer
// `mount(ctx)`, en import og én linje her. Macens side af et modul står i src/mobil_handlinger.py.
// Modulerne importeres statisk: Safari på iPhone afviste den dynamiske import() ("Importing a
// module script failed"), mens de statiske virkede.
import * as analytics from "./moduler/analytics/analytics.js";

export const MODULER = [
  { id: "analytics", navn: "Analytics", ikon: "📈", tekst: "Views, afspilninger og følgere",
    hent: async () => analytics },
];

// Vises dæmpet i modulvælgeren, så det er tydeligt, at der kommer mere.
export const KOMMER = [
  { navn: "Flere funktioner", ikon: "✨", tekst: "Kommer senere" },
];
