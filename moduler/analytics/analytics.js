// Modulet Analytics: læser det seneste snapshot (bygget af src/mobil_snapshot.py på Macen)
// og beder Macen om friske tal (handlingen "hent" i src/mobil_handlinger.py).

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = new URL("./analytics.css", import.meta.url).href;

const FANER = [
  { id: "idag", navn: "I dag", ikon: '<path d="M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z" fill="currentColor"/>' },
  { id: "gaester", navn: "Gæster", ikon: '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c1-4.5 4.5-7 8-7s7 2.5 8 7" fill="currentColor"/>' },
  { id: "klip", navn: "Klip", ikon: '<rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10.5 9 4 3-4 3z" fill="currentColor"/>' },
  { id: "spotify", navn: "Spotify", ikon: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 9.5c3-1 6.5-.7 9 .8M8 12.6c2.5-.7 5.3-.4 7.4.8M8.6 15.5c2-.5 4-.3 5.6.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
];
const PLATFORM_FARVE = { Instagram: "var(--ig)", TikTok: "var(--tt)", YouTube: "var(--yt)" };

// ── Formatering ─────────────────────────────────────────────
const nf = new Intl.NumberFormat("da-DK");
const fmt = (n) => (n == null ? "–" : nf.format(Math.round(n)));
const kompakt = (n) => {
  if (n == null) return "–";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " mio";
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(".", ",") + "k";
  return fmt(n);
};
const pct = (x) => (x == null ? "–" : (x * 100).toFixed(1).replace(".", ",") + " %");
const delta = (d, tekst = "") => {
  if (d == null) return "";
  const r = Math.round(d);
  if (r === 0) return `<span class="delta nul">±0${tekst}</span>`;
  return `<span class="delta ${r < 0 ? "ned" : ""}">${r > 0 ? "▲ +" : "▼ "}${fmt(r)}${tekst}</span>`;
};
const dato = (iso, aar = false) => iso ? new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", ...(aar ? { year: "numeric" } : {}) }) : "";
const dageSiden = (iso) => Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
const siden = (iso) => {
  const d = dageSiden(iso);
  return d < 0 ? (d === -1 ? "i morgen" : `om ${-d} dage`) : d === 0 ? "i dag" : d === 1 ? "i går" : `${d} dage siden`;
};
function idagTekst() {
  const t = new Date().toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function hilsen() {
  const h = new Date().getHours();
  return h < 5 ? "Godnat" : h < 10 ? "Godmorgen" : h < 12 ? "God formiddag" : h < 18 ? "God eftermiddag" : "God aften";
}

// ── Små grafer (SVG) ────────────────────────────────────────
function soejler(vaerdier, h = 70) {
  const v = vaerdier.map((x) => x || 0);
  if (!v.length) return "";
  const max = Math.max(...v, 1), b = 100 / v.length;
  return `<svg class="soejler" viewBox="0 0 100 ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--lime)"/><stop offset="1" stop-color="var(--lime)" stop-opacity=".25"/></linearGradient></defs>
    ${v.map((x, i) => { const hh = Math.max((x / max) * (h - 2), x ? 1.5 : 0.6); return `<rect x="${i * b + b * 0.16}" y="${h - hh}" width="${b * 0.68}" height="${hh}" rx="${Math.min(b * 0.3, 1.2)}" fill="${x ? "url(#sg)" : "var(--kant)"}"/>`; }).join("")}
  </svg>`;
}
function linje(vaerdier, h = 44, id = "l") {
  const v = vaerdier.filter((x) => x != null);
  if (v.length < 2) return "";
  const min = Math.min(...v), max = Math.max(...v), sp = max - min || 1;
  const pt = v.map((x, i) => [(i / (v.length - 1)) * 100, h - 3 - ((x - min) / sp) * (h - 8)]);
  const d = pt.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("");
  return `<svg class="linje" viewBox="0 0 100 ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sand)" stop-opacity=".35"/><stop offset="1" stop-color="var(--sand)" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}L100,${h}L0,${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="var(--sand)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg>`;
}
function platformBjaelke(pr) {
  const dele = Object.entries(pr || {}).filter(([, v]) => v);
  const sum = dele.reduce((a, [, v]) => a + v, 0);
  if (!sum) return "";
  return `<div class="pbar">${dele.map(([p, v]) => `<i style="flex:${v};background:${PLATFORM_FARVE[p] || "var(--sand)"}"></i>`).join("")}</div>
    <div class="pleg">${dele.map(([p, v]) => `<span><i style="background:${PLATFORM_FARVE[p]}"></i>${p} <b class="tal">${kompakt(v)}</b></span>`).join("")}</div>`;
}

// Tal, der tæller op, og blinker, når de har ændret sig siden sidst.
function animer(rod, forrige) {
  rod.querySelectorAll("[data-tal]").forEach((el) => {
    const slut = Number(el.dataset.tal), noegle = el.dataset.noegle;
    const fra = forrige && noegle in forrige ? forrige[noegle] : slut * 0.6;
    if (forrige && noegle in forrige && forrige[noegle] !== slut) el.classList.add("blink");
    if (fra === slut || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmt(slut); return; }
    const t0 = performance.now(), varighed = 900;
    const trin = (t) => {
      const p = Math.min((t - t0) / varighed, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(fra + (slut - fra) * e);
      if (p < 1) requestAnimationFrame(trin);
    };
    requestAnimationFrame(trin);
  });
}
const taelTal = (rod) => Object.fromEntries([...rod.querySelectorAll("[data-tal]")].map((el) => [el.dataset.noegle, Number(el.dataset.tal)]));
const stortTal = (n, noegle) => n == null ? "–" : `<span class="tal" data-tal="${n}" data-noegle="${noegle}">${fmt(n)}</span>`;

// ── Modulet ─────────────────────────────────────────────────
export async function mount(ctx) {
  const { esc, klok } = ctx;
  document.head.appendChild(css);
  let fane = localStorage.getItem("analytics-fane") || "idag";
  let snap = ctx.gemtSnapshot();
  let hent = { status: null, besked: "" };
  let klipVisning = "stiger";
  let forrigeTal = null;

  ctx.faner.innerHTML = FANER.map((f) => `<button data-fane="${f.id}"><svg viewBox="0 0 24 24">${f.ikon}</svg>${f.navn}</button>`).join("");
  ctx.faner.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    fane = b.dataset.fane;
    try { localStorage.setItem("analytics-fane", fane); } catch { /* */ }
    forrigeTal = null;
    tegn(true);
    window.scrollTo({ top: 0 });
  }));

  const gaest = (slug) => snap?.data?.gaester?.find((g) => g.slug === slug);

  function hentKort() {
    const s = hent.status;
    const vaagen = ctx.macVaagen();
    const tekst = s === "ventende" ? (vaagen ? "Venter på Macen…" : "Macen sover. Den henter, når den vågner.")
      : s === "koerer" ? "Macen henter fra Buffer, Spotify og Instagram…"
      : s === "ok" ? `✓ ${esc(hent.besked || "Nye tal")} kl. ${klok(new Date().toISOString())}`
      : s === "fejl" ? `Fejl: ${esc(hent.besked)}`
      : s === "timeout" ? "Macen svarede ikke. Prøv igen senere."
      : snap ? `Tal fra ${klok(snap.data.laget)}` : "Ingen tal endnu";
    const koerer = s === "ventende" || s === "koerer";
    return `<div class="hent ${koerer ? "koerer" : ""} ${s === "ok" ? "ok" : ""} ${s === "fejl" ? "fejl" : ""}">
      <div><b>${koerer ? "Henter friske tal" : "Friske tal"}</b><small>${tekst}</small></div>
      <button class="hent-knap" ${koerer ? "disabled" : ""} aria-label="Hent">
        <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button></div>`;
  }

  async function hentNu() {
    if (hent.status === "ventende" || hent.status === "koerer") return;
    hent = { status: "ventende" };
    opdaterHent();
    const r = await ctx.opgave("hent", {}, (status, besked) => { hent = { status, besked }; opdaterHent(); });
    if (r.status === "ok") {
      navigator.vibrate?.([10, 40, 10]);
      await genindlaes(true);
      ctx.toast("✓ Nye tal");
    }
  }
  ctx.paaTraek(hentNu);

  function opdaterHent() {
    const el = ctx.indhold.querySelector(".hent");
    if (el) { el.outerHTML = hentKort(); bindHent(); }
  }
  function bindHent() {
    ctx.indhold.querySelector(".hent-knap")?.addEventListener("click", hentNu);
  }

  // ── Fanerne ──
  function idag(d) {
    const t = d.total;
    const akt = gaest(d.aktuel);
    const plat = Object.fromEntries((d.platforme || []).map((p) => [p.navn, p.views]));
    const kommende = (d.kommende || []).map(gaest).filter(Boolean);
    const sp = d.spotify_dagligt || [];
    return `
      <div class="hilsen foerste-gang"><h1>${hilsen()}, Emil</h1>
        <p>${idagTekst()}</p></div>
      ${hentKort()}
      <div class="kort helt foerste-gang">
        <div class="eyebrow">Views i alt · alle platforme</div>
        <div class="kaempe">${stortTal(t.views, "views")}</div>
        <div class="under">${delta(t.views_delta, " siden i går")}${t.eng_rate != null ? `<span class="svag">Eng.-rate ${pct(t.eng_rate)}</span>` : ""}</div>
        ${platformBjaelke(plat)}
      </div>
      <div class="fliser foerste-gang">
        <div class="kort flise"><div class="eyebrow">Afspilninger</div><div class="stort">${stortTal(t.afspilninger, "afsp")}</div>${delta(t.afspilninger_delta)}<small>Spotify og andre apps</small></div>
        <div class="kort flise"><div class="eyebrow">Spotify-følgere</div><div class="stort">${stortTal(t.spotify_foelgere, "spf")}</div>${delta(t.spotify_foelgere_delta)}<small>Showet</small></div>
        <div class="kort flise"><div class="eyebrow">Instagram</div><div class="stort">${stortTal(t.ig_foelgere, "igf")}</div>${delta(t.ig_foelgere_delta)}<small>Følgere</small></div>
        <div class="kort flise"><div class="eyebrow">Timer set</div><div class="stort">${stortTal(t.timer, "timer")}</div><small>${t.klip} klip · ${t.episoder_live} episoder</small></div>
      </div>
      ${akt ? `<div class="sektion">Seneste episode</div>${episodeKort(akt, true)}` : ""}
      ${kommende.length ? `<div class="sektion">Næste</div>${kommende.map((g) => `
        <div class="kort raekke-kort">${g.billede ? `<img src="${g.billede}" alt="">` : "<div class='tomt'></div>"}
          <div><b>${esc(g.navn)}</b><small>${g.ep ? `EP ${g.ep} · ` : ""}Går live ${siden(g.live)} · ${dato(g.live)}${g.planlagt ? ` · ${g.planlagt} reels planlagt` : ""}</small></div></div>`).join("")}` : ""}
      ${sp.length ? `<div class="sektion">Afspilninger pr. dag<small>60 dage · Spotify</small></div>
        <div class="kort graf">${soejler(sp.map((x) => x[1]))}<div class="akse"><span>${dato(sp[0][0])}</span><span>${dato(sp[sp.length - 1][0])}</span></div></div>` : ""}
      ${fod(d)}`;
  }

  function episodeKort(g, stor = false) {
    const gf = g.gaest_foelgere;
    const live = g.live && dageSiden(g.live) >= 0;
    return `<div class="kort ep-kort foerste-gang">
      ${g.billede ? `<div class="ep-bill"><img src="${g.billede}" alt="">${live ? `<span class="live"><i></i>Live · ${siden(g.live)}</span>` : g.live ? `<span class="live kommer"><i></i>Går live ${siden(g.live)}</span>` : ""}</div>` : ""}
      <div class="ep-top"><div><small>${g.ep ? `EP ${g.ep}` : ""}${g.live ? ` · ${dato(g.live, true)}` : ""}</small><h2>${esc(g.navn)}</h2></div></div>
      <div class="ep-tal">
        <div><b class="tal">${fmt(g.afspilninger)}</b><span>Afspilninger</span></div>
        <div><b class="tal">${kompakt(g.views)}</b><span>Views ${g.views_delta ? `<em>+${fmt(g.views_delta)}</em>` : ""}</span></div>
        <div><b class="tal">${g.klip}</b><span>Klip</span></div>
        <div><b class="tal">${pct(g.eng_rate)}</b><span>Eng.-rate</span></div>
      </div>
      ${stor || g.uge1 != null || gf || g.dine_ig != null || g.dine_spotify != null ? `<div class="ep-ekstra">
        ${g.uge1 != null ? `<div><span>Uge 1</span><b class="tal">${fmt(g.uge1)} afsp.</b></div>` : ""}
        ${gf && gf.foer != null ? `<div><span>Gæstens Instagram</span><b class="tal">${fmt(gf.foer)} → ${fmt(gf.efter ?? gf.seneste)} ${delta((gf.efter ?? gf.seneste) - gf.foer)}</b></div>` : ""}
        ${g.dine_ig != null ? `<div><span>Dine nye følgere · IG</span><b class="tal">${delta(g.dine_ig)}</b></div>` : ""}
        ${g.dine_spotify != null ? `<div><span>Dine nye følgere · Spotify</span><b class="tal">${delta(g.dine_spotify)}</b></div>` : ""}
      </div>` : ""}
      ${platformBjaelke(g.platforme)}
    </div>`;
  }

  function gaester(d) {
    const live = d.gaester.filter((g) => g.live && dageSiden(g.live) >= 0).sort((a, b) => b.live.localeCompare(a.live));
    const kommer = d.gaester.filter((g) => !(g.live && dageSiden(g.live) >= 0));
    return `<div class="sektion" style="margin-top:6px">Gæster<small>${live.length} live · swipe</small></div>
      <div class="karrusel">${live.map((g) => `<div class="slide">${episodeKort(g)}</div>`).join("")}</div>
      <div class="prikker">${live.map((_, i) => `<i class="${i ? "" : "aktiv"}"></i>`).join("")}</div>
      ${kommer.length ? `<div class="sektion">Kommer</div>${kommer.map((g) => `
        <div class="kort raekke-kort">${g.billede ? `<img src="${g.billede}" alt="">` : "<div class='tomt'></div>"}
          <div><b>${esc(g.navn)}</b><small>${g.ep ? `EP ${g.ep} · ` : ""}${g.live ? `Går live ${dato(g.live)}` : "Ikke planlagt endnu"}</small></div></div>`).join("")}` : ""}
      ${fod(d)}`;
  }

  function klip(d) {
    const alle = d.klip || [];
    const stiger = alle.filter((k) => k.delta > 0).sort((a, b) => b.delta - a.delta);
    const liste = klipVisning === "stiger" ? stiger : alle;
    const top = Math.max(...liste.map((k) => k.views || 0), 1);
    return `<div class="segment"><button data-v="stiger" class="${klipVisning === "stiger" ? "aktiv" : ""}">🔥 Stiger mest</button>
        <button data-v="top" class="${klipVisning === "top" ? "aktiv" : ""}">🏆 Top</button></div>
      ${klipVisning === "stiger" ? `<p class="note">Nye views siden ${d.foer_dato ? dato(d.foer_dato) : "i går"} · Buffer opdaterer hver 1-3 dage</p>` : ""}
      ${liste.length ? liste.map((k, i) => `
        <button class="klip foerste-gang" data-i="${alle.indexOf(k)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
          <span class="nr">${i + 1}</span>
          <span class="klip-midt"><b>${esc(k.titel)}</b><small>${esc(k.gaest)} · ${dato(k.sendt)}</small>
            <span class="klip-bar"><i style="width:${((k.views || 0) / top) * 100}%"></i></span></span>
          <span class="klip-tal"><b class="tal">${kompakt(k.views)}</b>${klipVisning === "stiger" ? `<em>+${fmt(k.delta)}</em>` : `<small>views</small>`}</span>
        </button>`).join("") : `<div class="kort tom-tekst">Ingen klip med nye views siden i går endnu.</div>`}
      ${fod(d)}`;
  }

  function spotify(d) {
    const t = d.total;
    const eps = d.episoder || [];
    const apple = t.apple_andel != null && t.afspilninger != null ? t.apple_andel * t.afspilninger : null;
    const fl = d.spotify_foelgere || [];
    return `<div class="kort helt foerste-gang">
        <div class="eyebrow">Afspilninger i alt · alle apps</div>
        <div class="kaempe">${stortTal(t.afspilninger, "sp-afsp")}</div>
        <div class="under">${delta(t.afspilninger_delta, " siden sidst")}</div>
      </div>
      <div class="fliser foerste-gang">
        <div class="kort flise"><div class="eyebrow">Lyttere</div><div class="stort">${stortTal(t.lyttere, "lyt")}</div><small>Kun Spotify</small></div>
        <div class="kort flise"><div class="eyebrow">Lyttetimer</div><div class="stort">${stortTal(t.spotify_timer, "lt")}</div><small>Kun Spotify</small></div>
        <div class="kort flise"><div class="eyebrow">Følgere</div><div class="stort">${stortTal(t.spotify_foelgere, "sf")}</div>${delta(t.spotify_foelgere_delta)}</div>
        <div class="kort flise"><div class="eyebrow">Apple Podcasts</div><div class="stort">≈ ${apple != null ? fmt(apple) : "–"}</div><small>${pct(t.apple_andel)} af alle</small></div>
      </div>
      ${fl.length > 1 ? `<div class="sektion">Følgere på Spotify<small>${dato(fl[0][0])} – nu</small></div><div class="kort graf">${linje(fl.map((x) => x[1]), 60, "fl")}</div>` : ""}
      <div class="sektion">Episoder</div>
      ${eps.map((e) => `<div class="kort ep-raekke foerste-gang ${e.kommer ? "daempet" : ""}">
        ${gaest(e.slug)?.billede ? `<img src="${gaest(e.slug).billede}" alt="">` : "<div class='tomt'></div>"}
        <div class="ep-raekke-midt"><small>${e.ep ? `EP ${e.ep} · ` : ""}${e.kommer ? "Planlagt " : ""}${dato(e.udgivet, true)}</small><b>${esc(e.gaest || e.titel)}</b>
          ${e.spark?.length ? `<div class="mini">${soejler(e.spark, 26)}</div>` : ""}</div>
        <div class="ep-raekke-tal"><b class="tal">${fmt(e.afspilninger)}</b><small>afsp.</small>${e.uge1 != null ? `<small class="u1">Uge 1: ${fmt(e.uge1)}</small>` : ""}</div>
      </div>`).join("")}
      ${fod(d)}`;
  }

  function fod(d) {
    const h = d.hentet || {};
    return `<p class="fod">Snapshot ${klok(d.laget)}${h.buffer ? ` · Buffer ${klok(h.buffer)}` : ""}${h.spotify ? ` · Spotify ${klok(h.spotify)}` : ""}</p>`;
  }

  function tegn(nyFane = false) {
    ctx.faner.querySelectorAll("button").forEach((b) => b.classList.toggle("aktiv", b.dataset.fane === fane));
    if (!snap) {
      ctx.indhold.innerHTML = `${hentKort()}<div class="kort tom-tekst">Ingen tal endnu. Tryk Hent, når Macen er vågen.</div>`;
      bindHent();
      return;
    }
    const gamle = nyFane ? null : forrigeTal;
    const d = snap.data;
    ctx.indhold.innerHTML = ({ idag, gaester, klip, spotify }[fane] || idag)(d);
    if (fane !== "idag") ctx.indhold.insertAdjacentHTML("afterbegin", hentKort());
    bindHent();
    animer(ctx.indhold, gamle);
    forrigeTal = taelTal(ctx.indhold);

    ctx.indhold.querySelectorAll(".segment button").forEach((b) => b.addEventListener("click", () => { klipVisning = b.dataset.v; tegn(true); }));
    ctx.indhold.querySelectorAll(".klip").forEach((b) => b.addEventListener("click", () => {
      const k = d.klip[Number(b.dataset.i)];
      ctx.ark(`<h3>${esc(k.titel)}</h3><p class="svag" style="margin:-4px 0 14px">${esc(k.gaest)} · ${dato(k.sendt, true)}</p>
        ${Object.entries(k.pr).map(([p, x]) => `<a class="ark-raekke" href="${esc(x.link || "#")}" target="_blank" rel="noopener">
          <span class="ik" style="color:${PLATFORM_FARVE[p]}">●</span><span><b>${p}</b><small>${fmt(x.views)} views</small></span><span style="margin-left:auto" class="svag">Åbn ↗</span></a>`).join("")}`);
    }));
    const kar = ctx.indhold.querySelector(".karrusel");
    if (kar) kar.addEventListener("scroll", () => {
      const i = Math.round(kar.scrollLeft / kar.clientWidth);
      ctx.indhold.querySelectorAll(".prikker i").forEach((p, j) => p.classList.toggle("aktiv", i === j));
    }, { passive: true });
  }

  async function genindlaes(blink = false) {
    try {
      const ny = await ctx.snapshot();
      if (ny && (!snap || ny.laget !== snap.laget || blink)) { snap = ny; tegn(); }
    } catch (e) {
      if (!snap) ctx.indhold.insertAdjacentHTML("beforeend", `<div class="kort tom-tekst" style="color:var(--roed)">Kunne ikke hente tal: ${esc(e.message || String(e))}</div>`);
    }
  }

  tegn(true);
  await genindlaes();

  return {
    synlig: () => genindlaes(),
    afmonter: () => css.remove(),
  };
}
