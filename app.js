// Skallen: login, modulvælger, Macens status, pull-to-refresh og fælles hjælpere til modulerne.
import { SUPABASE_URL, SUPABASE_NOEGLE } from "./config.js";
import { MODULER, KOMMER } from "./moduler.js";

const $ = (s) => document.querySelector(s);
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_NOEGLE, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "emilanos-mobil" },
});

const gem = {
  hent(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  saet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat tilstand */ } },
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Toast og ark ─────────────────────────────────────────────
let toastTimer;
function toast(tekst, ms = 2600) {
  const t = $("#toast");
  t.textContent = tekst;
  t.classList.add("vis");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("vis"), ms);
}

function ark(html) {
  $("#ark").innerHTML = html;
  $("#ark").classList.remove("skjult");
  $("#ark-bag").classList.remove("skjult");
  return $("#ark");
}
function lukArk() {
  $("#ark").classList.add("skjult");
  $("#ark-bag").classList.add("skjult");
}
$("#ark-bag").addEventListener("click", lukArk);

// ── Macens status ───────────────────────────────────────────
let macSidst = null;
function macVaagen() {
  return macSidst && Date.now() - new Date(macSidst).getTime() < 2.5 * 60 * 1000;
}
async function opdaterMac() {
  const { data } = await sb.from("mac_status").select("sidst_set").eq("id", 1).maybeSingle();
  macSidst = data?.sidst_set || null;
  const el = $("#mac");
  el.classList.toggle("vaagen", !!macVaagen());
  el.querySelector("span").textContent = macVaagen() ? "Macen er vågen" : (macSidst ? `Macen sover · ${klok(macSidst)}` : "Macen sover");
}
export function klok(iso) {
  const d = new Date(iso);
  const idag = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  return idag ? t : `${d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} ${t}`;
}

// ── Data til modulerne ──────────────────────────────────────
async function snapshot(modul) {
  const { data, error } = await sb.from("snapshot").select("data,laget").eq("modul", modul)
    .order("laget", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (data) gem.saet(`snap-${modul}`, data);
  return data;
}
const gemtSnapshot = (modul) => gem.hent(`snap-${modul}`);

// Bed Macen om noget. onStatus kaldes med "ventende" | "koerer" | "ok" | "fejl" (+ besked).
async function opgave(modul, handling, data = {}, onStatus = () => {}) {
  const { data: o, error } = await sb.from("opgave").insert({ modul, handling, data }).select().single();
  if (error) { onStatus("fejl", error.message); return { status: "fejl", besked: error.message }; }
  onStatus("ventende");
  const start = Date.now();
  let sidst = "ventende";
  while (Date.now() - start < 6 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data: r } = await sb.from("opgave").select("status,besked").eq("id", o.id).single();
    if (!r) continue;
    if (r.status !== sidst) { sidst = r.status; onStatus(r.status, r.besked); }
    if (r.status === "ok" || r.status === "fejl") { opdaterMac(); return r; }
  }
  onStatus("timeout");
  return { status: "timeout" };
}

// ── Pull-to-refresh ─────────────────────────────────────────
let paaTraek = null;
(function ptr() {
  const el = $("#ptr");
  let y0 = null, dy = 0, koerer = false;
  window.addEventListener("touchstart", (e) => {
    if (window.scrollY <= 0 && !koerer && !$("#ark").offsetParent) { y0 = e.touches[0].clientY; dy = 0; }
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const p = Math.min(dy / 90, 1);
    el.style.opacity = p;
    el.style.transform = `translateY(${-30 + p * 40}px)`;
    el.querySelector(".ptr-ring").style.transform = `rotate(${p * 270}deg)`;
    el.classList.toggle("klar", dy > 90);
    el.querySelector("span").textContent = dy > 90 ? "Slip for at hente" : "Træk for at hente";
  }, { passive: true });
  window.addEventListener("touchend", async () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 90 && paaTraek) {
      koerer = true;
      el.classList.add("koer");
      el.querySelector(".ptr-ring").style.transform = "";
      el.querySelector("span").textContent = "Henter…";
      navigator.vibrate?.(10);
      try { await paaTraek(); } finally { koerer = false; }
    }
    el.classList.remove("koer", "klar");
    el.style.opacity = 0;
    el.style.transform = "translateY(-30px)";
  });
})();

// ── Moduler ─────────────────────────────────────────────────
let aktivt = null;
async function visModul(id) {
  const m = MODULER.find((x) => x.id === id) || MODULER[0];
  gem.saet("modul", m.id);
  $("#modul-navn").textContent = m.navn;
  $("#indhold").innerHTML = "";
  $("#faner").innerHTML = "";
  paaTraek = null;
  aktivt?.afmonter?.();
  try {
    const mod = await m.hent();
    aktivt = await mod.mount({
    sb, indhold: $("#indhold"), faner: $("#faner"), esc, klok, toast, ark, lukArk,
    snapshot: () => snapshot(m.id), gemtSnapshot: () => gemtSnapshot(m.id),
    opgave: (handling, data, onStatus) => opgave(m.id, handling, data, onStatus),
    macVaagen, opdaterMac, paaTraek: (fn) => { paaTraek = fn; },
    });
  } catch (e) {
    visFejl(`${m.navn} kunne ikke starte: ${e?.message || e}`);
  }
}

// Fejl vises på skærmen (en telefon har ingen konsol).
function visFejl(tekst) {
  $("#indhold").insertAdjacentHTML("afterbegin", `<div class="kort" style="border-color:var(--roed);color:var(--roed);font-size:13px">${esc(tekst)}</div>`);
}
window.addEventListener("error", (e) => visFejl(e.message || "Ukendt fejl"));
window.addEventListener("unhandledrejection", (e) => visFejl(String(e.reason?.message || e.reason)));

// ── Morgenbesked (push kl. 08) ───────────────────────────────
// Sendes af Supabase-funktionen morgenbesked, også når Macen sover. På iPhone virker push kun,
// når appen er lagt på hjemmeskærmen (iOS 16.4+), og tilladelsen skal bedes om fra et tryk.
const hjemmeskaerm = () => navigator.standalone || matchMedia("(display-mode: standalone)").matches;
const pushMulig = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function pushAbonnement() {
  if (!pushMulig()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
function b64tilBytes(b64) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function slaaPushTil() {
  if (await Notification.requestPermission() !== "granted") throw new Error("Notifikationer er ikke tilladt. Slå dem til under Indstillinger → Notifikationer → emilanos.");
  const { data: noegle, error } = await sb.rpc("push_offentlig_noegle");
  if (error || !noegle) throw new Error("Kunne ikke hente nøglen fra Supabase.");
  const reg = await navigator.serviceWorker.ready;
  const abon = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64tilBytes(noegle) });
  const j = abon.toJSON();
  const { error: e2 } = await sb.from("push_abonnement").upsert(
    { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
  if (e2) throw new Error(e2.message);
}
async function slaaPushFra(abon) {
  await sb.from("push_abonnement").delete().eq("endpoint", abon.endpoint);
  await abon.unsubscribe();
}
async function pushRaekke() {
  const abon = await pushAbonnement().catch(() => null);
  const tekst = !pushMulig() || !hjemmeskaerm() ? "Læg appen på hjemmeskærmen først"
    : abon ? "Til · tryk for at slå fra" : "Fra · tryk for at slå til";
  return `<button class="ark-raekke ${abon ? "aktiv" : ""}" id="push" ${!pushMulig() || !hjemmeskaerm() ? "disabled" : ""}>
    <span class="ik">🔔</span><span><b>Morgenbesked kl. 08</b><small>${tekst}</small></span></button>`;
}

$("#modul-knap").addEventListener("click", async () => {
  const aktiv = gem.hent("modul") || MODULER[0].id;
  const push = await pushRaekke();
  const a = ark(`<h3>Moduler</h3>
    ${MODULER.map((m) => `<button class="ark-raekke ${m.id === aktiv ? "aktiv" : ""}" data-modul="${m.id}">
      <span class="ik">${m.ikon}</span><span><b>${esc(m.navn)}</b><small>${esc(m.tekst)}</small></span></button>`).join("")}
    ${KOMMER.map((m) => `<div class="ark-raekke dæmpet"><span class="ik">${m.ikon}</span><span><b>${esc(m.navn)}</b><small>${esc(m.tekst)}</small></span></div>`).join("")}
    ${push}
    <button class="ark-raekke" id="log-ud"><span class="ik">↩︎</span><span><b>Log ud</b><small>På denne telefon</small></span></button>`);
  a.querySelectorAll("[data-modul]").forEach((b) => b.addEventListener("click", () => { lukArk(); visModul(b.dataset.modul); }));
  a.querySelector("#log-ud").addEventListener("click", async () => { lukArk(); await sb.auth.signOut(); visLogin(); });
  a.querySelector("#push")?.addEventListener("click", async () => {
    lukArk();
    try {
      const abon = await pushAbonnement();
      if (abon) { await slaaPushFra(abon); toast("Morgenbesked slået fra"); }
      else { await slaaPushTil(); toast("✓ Du får en besked kl. 08"); }
    } catch (e) { visFejl(e?.message || String(e)); }
  });
});

// ── Login ───────────────────────────────────────────────────
function visLogin() {
  $("#app").classList.add("skjult");
  $("#login").classList.remove("skjult");
  const email = gem.hent("email");
  if (email) { $("#login-email").value = email; setTimeout(() => $("#login-pw").focus(), 50); }
}
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-fejl").textContent = "";
  const email = $("#login-email").value.trim();
  const { error } = await sb.auth.signInWithPassword({ email, password: $("#login-pw").value });
  if (error) { $("#login-fejl").textContent = "Forkert mail eller password."; return; }
  gem.saet("email", email);
  $("#login-pw").value = "";
  start();
});

let macTimer;
async function start() {
  $("#login").classList.add("skjult");
  $("#app").classList.remove("skjult");
  opdaterMac();
  clearInterval(macTimer);
  macTimer = setInterval(opdaterMac, 30000);
  await visModul(gem.hent("modul") || MODULER[0].id);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !$("#app").classList.contains("skjult")) {
    opdaterMac();
    aktivt?.synlig?.();
  }
});

// Bliv logget ind: bed browseren om at gemme data permanent, og prøv igen, hvis nettet ikke var
// klar, da ikonet blev åbnet (så ville fornyelsen af login fejle, og login-skærmen ville vises).
navigator.storage?.persist?.().catch(() => {});
let { data: { session } } = await sb.auth.getSession();
for (let i = 0; !session && i < 3 && localStorage.getItem("emilanos-mobil"); i++) {
  await new Promise((r) => setTimeout(r, 1200));
  ({ data: { session } } = await sb.auth.getSession());
}
session ? start() : visLogin();

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
