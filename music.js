/* ============================================================================
   Lecteur musique — module isolé de la homepage.
   Pour le désactiver : retirer la ligne <script src="music.js"> de index.html.
   Tout (style, HTML, données) vit ici ; les données sont dans localStorage["home.music"].

   Deux modes, choisis automatiquement :
   - page servie en http(s) (GitHub Pages) → lecteur YouTube caché dans la page : pause, suivante, volume.
   - page ouverte en file:/// → YouTube refuse son lecteur intégré (erreur 153) : la station s'ouvre
     dans une petite fenêtre, qu'on ferme pour arrêter (YouTube coupe le lien avec la page, en-tête COOP).
   ========================================================================== */
(() => {
  const KEY = "home.music";
  const API = "https://www.googleapis.com/youtube/v3/";
  const SEED = ["V_BoQIByVVM", "Il-ZpBuC8tA", "Ff0JKlR5Q8Q"];   // stations de départ
  const CHECK_EVERY = 60 * 60e3, DISCOVER_TTL = 30 * 60e3;
  const EMBED = location.protocol.startsWith("http");

  // ---------- Données ----------
  const load = () => {
    const d = JSON.parse(localStorage.getItem(KEY) || "null") || {};
    return {
      stations: d.stations || SEED.map(id => ({ id })), last: d.last || null, key: d.key || "",
      styles: d.styles || "chill house, chill lounge", nope: d.nope || [], checked: d.checked || 0, disc: d.disc || null, vol: d.vol ?? 60,
    };
  };
  let S = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const idOf = s => (String(s).match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/) || String(s).trim().match(/^([\w-]{11})$/) || [])[1];
  const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const kfmt = n => n >= 1000 ? (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(".", ",") + " k" : String(n);

  // ---------- Style ----------
  document.head.insertAdjacentHTML("beforeend", `<style>
  .mu { position: fixed; right: 16px; bottom: 16px; z-index: 20; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    font: 13px/1.35 "Segoe UI Variable", "Segoe UI", system-ui, sans-serif; color: #e8e9f0; }
  .mu button { font: inherit; color: inherit; cursor: pointer; }
  .mu-pill { display: flex; align-items: center; background: #161925; border: 1px solid rgba(255,255,255,.08); border-radius: 99px;
    opacity: .7; transition: opacity .15s, border-color .15s; max-width: 260px; }
  .mu-pill:hover, .mu.open .mu-pill { opacity: 1; border-color: rgba(255,255,255,.16); }
  .mu-play { flex: none; width: 30px; height: 30px; margin: 2px; border-radius: 50%; border: 0; background: #8b7cff; color: #fff !important; font-size: 11px; }
  .mu-play:hover { filter: brightness(1.15); }
  .mu-next { flex: none; width: 26px; height: 30px; border: 0; background: none; color: #8b8fa3 !important; font-size: 12px; }
  .mu-next:hover { color: #fff !important; }
  .mu-it.cur .t1::before { content: "♪ "; color: #8b7cff; }
  .mu-vol { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #8b8fa3; font-size: 12px; }
  .mu-vol input { flex: 1; accent-color: #8b7cff; }
  #muYT { position: fixed; left: -10000px; top: 0; width: 200px; height: 113px; }
  .mu-name { border: 0; background: none; padding: 0 14px 0 8px; height: 34px; color: #8b8fa3 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mu-name:hover { color: #e8e9f0 !important; }
  .mu-panel { width: 360px; max-height: calc(100vh - 90px); overflow-y: auto; scrollbar-width: thin; padding: 14px;
    background: #161925; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; box-shadow: 0 18px 40px -16px #000; }
  .mu-panel[hidden] { display: none; }
  .mu-h { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.1px; color: #8b8fa3; }
  .mu-h:not(:first-child) { margin-top: 16px; }
  .mu-h span { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 11.5px; opacity: .8; }
  .mu-it { display: flex; align-items: center; gap: 10px; padding: 5px; border-radius: 10px; cursor: pointer; }
  .mu-it:hover { background: rgba(255,255,255,.06); }
  .mu-it img { width: 64px; height: 36px; border-radius: 6px; object-fit: cover; flex: none; background: #222; }
  .mu-it .tx { min-width: 0; flex: 1; }
  .mu-it .t1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mu-it .t2 { font-size: 11.5px; color: #8b8fa3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mu-it.last .t1 { color: #b9b0ff; }
  .mu-it.off { opacity: .45; }
  .mu-b { flex: none; width: 26px; height: 26px; border-radius: 8px; border: 0; background: none; color: #8b8fa3 !important; visibility: hidden; }
  .mu-it:hover .mu-b { visibility: visible; }
  .mu-b:hover { background: rgba(255,255,255,.1); color: #fff !important; }
  .mu-b.keep { visibility: visible; color: #8b7cff !important; font-size: 16px; }
  .live { color: #ff6b7a; } .vod { color: #ffb86b; } .gone { color: #ff8a8a; }
  .mu-row { display: flex; gap: 6px; margin-top: 8px; }
  .mu-row input { flex: 1; min-width: 0; font: inherit; color: #e8e9f0; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px; padding: 6px 10px; outline: none; }
  .mu-row input:focus { border-color: #8b7cff; }
  .mu-btn { flex: none; border: 0; border-radius: 10px; padding: 6px 12px; background: rgba(255,255,255,.09); }
  .mu-btn:hover { background: rgba(255,255,255,.15); }
  .mu-btn.pri { background: #8b7cff; color: #fff; }
  .mu-msg { font-size: 12px; color: #8b8fa3; margin-top: 8px; }
  .mu-msg.err { color: #ff8a8a; }
  .mu-msg:empty { display: none; }
  .mu-key ol { margin: 6px 0; padding-left: 18px; color: #b8bbc9; font-size: 12px; }
  .mu-key a { color: #b9b0ff; }
  .mu-foot { margin-top: 14px; font-size: 11.5px; color: #8b8fa3; display: flex; gap: 10px; flex-wrap: wrap; }
  .mu-foot a { color: inherit; cursor: pointer; text-decoration: underline dotted; }
  </style>`);

  // ---------- Squelette ----------
  const root = document.createElement("div");
  root.className = "mu";
  root.innerHTML = `
    <div class="mu-panel" hidden>
      ${EMBED ? `<label class="mu-vol">Volume <input type="range" id="muVol" min="0" max="100"></label>` : ""}
      <div class="mu-h">Mes stations <span>clic = écouter</span></div>
      <div id="muList"></div>
      <form class="mu-row" id="muAdd"><input id="muUrl" placeholder="Coller un lien YouTube…" autocomplete="off"><button class="mu-btn">Ajouter</button></form>
      <div class="mu-h">Découvrir <span>directs en cours</span></div>
      <div class="mu-row"><input id="muStyles" title="Styles recherchés, séparés par des virgules"><button class="mu-btn pri" id="muDisc">🔀 Chercher</button></div>
      <div id="muRes"></div>
      <div class="mu-msg" id="muMsg"></div>
      <div class="mu-foot" id="muFoot"></div>
    </div>
    <div class="mu-pill"><button class="mu-play" id="muPlay" title="Écouter la dernière station (M)">▶</button>
      ${EMBED ? `<button class="mu-next" id="muNext" title="Station suivante (N)">⏭</button>` : ""}
      <button class="mu-name" id="muName" title="Stations et découvertes"></button></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const panel = $(".mu-panel");
  const msg = (t = "", err = false) => { $("#muMsg").textContent = t; $("#muMsg").className = "mu-msg" + (err ? " err" : ""); };

  // ---------- Lecture ----------
  let yt = null, ytReady = null, playing = false, cur = null, pausedAt = 0, fails = 0;
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("home-music") : null;
  // Une autre homepage lance sa musique → celle-ci se met en pause (jamais deux musiques à la fois)
  if (bc) bc.onmessage = ev => { if (ev.data === "play" && playing) pause(); };

  // Lecteur YouTube chargé à la demande (survol de la pastille ou première lecture)
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(res => {
      const host = document.createElement("div");
      host.id = "muYT"; document.body.appendChild(host);
      window.onYouTubeIframeAPIReady = () => {
        yt = new YT.Player("muYT", {
          width: 200, height: 113, playerVars: { controls: 0, playsinline: 1, disablekb: 1 },
          events: { onReady: () => { yt.setVolume(S.vol); res(yt); }, onStateChange: onState, onError: onErr },
        });
      };
      const sc = document.createElement("script");
      sc.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(sc);
    });
    return ytReady;
  }
  function onState(e) {
    playing = e.data === 1 || e.data === 3;   // lecture ou chargement
    if (e.data === 1) fails = 0;
    if (e.data === 0) next();                 // une vidéo (pas un direct) se termine : station suivante
    render();
  }
  function onErr(e) {
    // 100 : vidéo supprimée ; 101 / 150 : la chaîne interdit la lecture hors de YouTube
    if (cur) {
      const s = S.stations.find(x => x.id === cur.id);
      if (s) { s.st = e.data === 100 ? "gone" : "noembed"; save(); }
      msg(`${cur.name || "Cette station"} ne peut pas être lue ici${e.data === 100 ? " (vidéo supprimée)" : " (la chaîne l'interdit)"}.`, true);
    }
    playing = false; render();
    if (++fails < 3) next();
  }
  const playable = s => !["gone", "ended", "noembed"].includes(s.st);
  async function play(st) {
    if (!EMBED) return popup(st);
    cur = st;
    if (S.stations.some(s => s.id === st.id)) { S.last = st.id; save(); }
    bc?.postMessage("play");
    (await loadYT()).loadVideoById(st.id);
    render();
  }
  function pause() { yt?.pauseVideo(); pausedAt = Date.now(); }
  function resume() {
    bc?.postMessage("play");
    // Après une longue pause, on recharge pour revenir au direct plutôt que de reprendre en différé
    if (Date.now() - pausedAt > 30e3) yt.loadVideoById(cur.id); else yt.playVideo();
  }
  function playPause() {
    if (!EMBED) return playLast();
    if (playing) pause();
    else if (yt && cur) resume();
    else playLast();
  }
  function next() {
    const list = S.stations.filter(playable);
    if (!list.length) return;
    const i = list.findIndex(s => s.id === cur?.id);
    play(list[(i + 1) % list.length]);
  }

  function popup(st) {
    const w = 520, h = 320;
    const left = (screen.availLeft || 0) + screen.availWidth - w - 24, top = (screen.availTop || 0) + screen.availHeight - h - 60;
    const win = window.open(`https://www.youtube.com/watch?v=${st.id}`, "_blank", `popup,width=${w},height=${h},left=${left},top=${top}`);
    if (!win) return msg("Le navigateur a bloqué la fenêtre : autorise les pop-ups pour cette page.", true);
    if (S.stations.some(s => s.id === st.id)) { S.last = st.id; save(); }
    render();
  }

  // ---------- Infos des vidéos ----------
  // Sans clé : oEmbed (titre + chaîne, et 404 si la vidéo a disparu). Avec clé : l'API dit si c'est en direct.
  async function oembed(id) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`);
    if (r.status === 404 || r.status === 401 || r.status === 403) return null;
    if (!r.ok) throw new Error("oembed");
    const j = await r.json();
    // Certaines vidéos ne donnent ni titre ni chaîne par oEmbed : nom de secours (l'API, avec clé, complète ensuite)
    return { title: j.title || "", name: j.author_name || j.title || "Station YouTube" };
  }
  async function api(path) {
    const r = await fetch(API + path + "&key=" + encodeURIComponent(S.key));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const why = j.error?.errors?.[0]?.reason || "";
      throw new Error(/quota/i.test(why) ? "Quota YouTube du jour épuisé, réessaie demain."
        : /key/i.test(why) || r.status === 400 ? "Clé YouTube refusée : vérifie-la (lien « clé » en bas)." : "YouTube ne répond pas.");
    }
    return j;
  }
  async function videos(ids) {
    const out = {};
    for (let i = 0; i < ids.length; i += 50) {
      const j = await api(`videos?part=snippet,liveStreamingDetails&id=${ids.slice(i, i + 50).join(",")}`);
      for (const v of j.items || []) out[v.id] = v;
    }
    return out;
  }

  // Vérifie les stations : titre manquant, vidéo supprimée, direct terminé (et, avec clé, retrouve le nouveau direct de la chaîne)
  async function check(force = false) {
    const stale = S.stations.filter(s => !s.name);
    if (!force && !stale.length && Date.now() - S.checked < CHECK_EVERY) return;
    if (S.key) {
      try {
        const info = await videos(S.stations.map(s => s.id));
        for (const s of S.stations) {
          const v = info[s.id];
          if (!v) { s.st = "gone"; continue; }
          Object.assign(s, { title: v.snippet.title, name: v.snippet.channelTitle, ch: v.snippet.channelId });
          s.st = v.snippet.liveBroadcastContent === "live" ? "live" : v.liveStreamingDetails ? "ended" : "vod";
          s.viewers = +(v.liveStreamingDetails?.concurrentViewers || 0);
        }
        // Direct terminé : la chaîne a peut-être relancé un nouveau direct (nouvel identifiant)
        for (const s of S.stations.filter(s => s.st === "ended" && s.ch)) {
          const j = await api(`search?part=snippet&type=video&eventType=live&maxResults=1&channelId=${s.ch}`);
          const nv = j.items?.[0];
          if (nv && !S.stations.some(x => x.id === nv.id.videoId)) {
            if (S.last === s.id) S.last = nv.id.videoId;
            Object.assign(s, { id: nv.id.videoId, title: nv.snippet.title, st: "live" });
          }
        }
        S.checked = Date.now();
      } catch (e) { msg(e.message, true); }
    } else {
      await Promise.all(stale.concat(force ? S.stations : []).map(async s => {
        try { const o = await oembed(s.id); if (o) Object.assign(s, o, { st: s.st === "gone" ? "" : s.st }); else s.st = "gone"; } catch {}
      }));
      S.checked = Date.now();
    }
    save(); render();
  }

  // ---------- Ajout / suppression ----------
  async function add(url) {
    const id = idOf(url);
    if (!id) return msg("Lien YouTube non reconnu.", true);
    if (S.stations.some(s => s.id === id)) return msg("Cette station est déjà dans ta liste.");
    msg("Ajout…");
    try {
      const o = await oembed(id);
      if (!o) return msg("Vidéo introuvable ou privée.", true);
      S.stations.push({ id, ...o });
      S.nope = S.nope.filter(x => x !== id);
      save(); msg(""); render();
      if (S.key) check(true);
    } catch { msg("Pas de connexion à YouTube.", true); }
  }
  function remove(id) {
    S.stations = S.stations.filter(s => s.id !== id);
    if (S.last === id) S.last = null;
    save(); render();
  }

  // ---------- Découvrir ----------
  async function discover() {
    if (!S.key) return keyForm();
    const styles = S.styles.split(",").map(s => s.trim()).filter(Boolean);
    if (!styles.length) return msg("Indique au moins un style.", true);
    msg("Recherche des directs en cours…");
    try {
      const found = new Map();
      for (const q of styles) {
        const j = await api(`search?part=snippet&type=video&eventType=live&maxResults=15&q=${encodeURIComponent(q)}`);
        for (const it of j.items || []) found.set(it.id.videoId, { id: it.id.videoId, title: it.snippet.title, name: it.snippet.channelTitle, ch: it.snippet.channelId });
      }
      const mine = new Set(S.stations.map(s => s.id)), mineCh = new Set(S.stations.map(s => s.ch).filter(Boolean));
      let list = [...found.values()].filter(v => !mine.has(v.id) && !mineCh.has(v.ch) && !S.nope.includes(v.id));
      // Les plus écoutées d'abord : un bon indicateur de qualité pour un direct musical
      const info = await videos(list.map(v => v.id));
      list.forEach(v => v.viewers = +(info[v.id]?.liveStreamingDetails?.concurrentViewers || 0));
      list = list.sort((a, b) => b.viewers - a.viewers).slice(0, 12);
      S.disc = { at: Date.now(), styles: S.styles, list };
      save(); msg(list.length ? "" : "Rien de nouveau pour ces styles.");
      renderDisc();
    } catch (e) { msg(e.message, true); }
  }

  function keyForm() {
    $("#muRes").innerHTML = `<div class="mu-key mu-msg">« Découvrir » utilise l'API YouTube, gratuite. Il faut une clé, à créer une seule fois (≈ 5 min) :
      <ol><li>Ouvre <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">YouTube Data API v3</a>, crée un projet si demandé, puis « Activer ».</li>
      <li>Va dans <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Identifiants</a> → « Créer des identifiants » → « Clé API ».</li>
      <li>Colle la clé ci-dessous. Elle reste dans ce navigateur.</li></ol></div>
      <form class="mu-row" id="muKeyF"><input id="muKey" placeholder="Clé API YouTube" autocomplete="off" spellcheck="false"><button class="mu-btn pri">OK</button></form>`;
    $("#muKey").focus();
    $("#muKeyF").onsubmit = ev => {
      ev.preventDefault();
      const k = $("#muKey").value.trim();
      if (!k) return;
      S.key = k; S.checked = 0; save();
      $("#muRes").innerHTML = ""; renderFoot();
      check(true).then(discover);
    };
  }

  // ---------- Affichage ----------
  const STATUS = {
    live: s => `<span class="live">● en direct</span>${s.viewers ? " · " + kfmt(s.viewers) + " auditeurs" : ""}`,
    ended: () => `<span class="gone">direct terminé</span>`, vod: () => `<span class="vod">vidéo, pas un direct</span>`,
    gone: () => `<span class="gone">n'existe plus</span>`,
    noembed: () => `<span class="gone">lecture interdite hors YouTube</span>`,
  };
  const item = (s, actions, cls = "") => `<div class="mu-it ${cls}" data-id="${s.id}" title="${esc(s.title || "")}">
      <img src="${thumb(s.id)}" alt="" loading="lazy"><div class="tx"><div class="t1">${esc(s.name || "…")}</div>
      <div class="t2">${s.st && STATUS[s.st] ? STATUS[s.st](s) : esc(s.title || "")}</div></div>${actions}</div>`;

  function render() {
    const last = S.stations.find(s => s.id === S.last), shown = cur || last;
    $("#muName").textContent = "♪ " + (shown?.name || "Musique");
    $("#muPlay").textContent = playing ? "⏸" : "▶";
    $("#muPlay").title = playing ? "Pause (M)" : shown ? `Écouter ${shown.name || "la dernière station"} (M)` : "Écouter la première station (M)";
    if ($("#muVol")) $("#muVol").value = S.vol;
    $("#muList").innerHTML = S.stations.length
      ? S.stations.map(s => item(s, `<button class="mu-b" data-act="del" title="Retirer de mes stations">✕</button>`,
          (s.id === S.last ? "last " : "") + (playing && s.id === cur?.id ? "cur " : "") + (playable(s) ? "" : "off"))).join("")
      : `<div class="mu-msg">Aucune station : colle un lien ou utilise « Découvrir ».</div>`;
    $("#muStyles").value = S.styles;
    renderFoot();
  }
  function renderDisc() {
    const d = S.disc;
    if (!d || !d.list.length) { $("#muRes").innerHTML = ""; return; }
    $("#muRes").innerHTML = d.list.map(v => item(v,
      `<button class="mu-b" data-act="nope" title="Pas pour moi">✕</button><button class="mu-b keep" data-act="keep" title="Garder dans mes stations">＋</button>`)).join("");
  }
  function renderFoot() {
    $("#muFoot").innerHTML = (S.key ? `<a data-act="key">clé YouTube</a><a data-act="refresh">vérifier les stations</a>` : "")
      + (EMBED ? `<span>touches M : lecture / pause · N : station suivante</span>`
        : `<span>touche M : dernière station · la musique joue dans sa propre fenêtre, ferme-la pour arrêter</span>`);
  }

  // ---------- Événements ----------
  const toggle = open => {
    open = open ?? panel.hidden;
    panel.hidden = !open; root.classList.toggle("open", open);
    if (open) { msg(""); check(); if (S.disc && Date.now() - S.disc.at < DISCOVER_TTL && S.disc.styles === S.styles) renderDisc(); }
  };
  const playLast = () => { const s = S.stations.find(s => s.id === S.last && playable(s)) || S.stations.find(playable); if (s) play(s); else toggle(true); };
  $("#muName").onclick = () => toggle();
  $("#muPlay").onclick = playPause;
  if (EMBED) {
    $("#muNext").onclick = next;
    root.addEventListener("mouseenter", loadYT, { once: true });   // prépare le lecteur avant le clic
    $("#muVol").oninput = ev => { S.vol = +ev.target.value; yt?.setVolume(S.vol); save(); };
  }
  $("#muAdd").onsubmit = ev => { ev.preventDefault(); add($("#muUrl").value); $("#muUrl").value = ""; };
  $("#muUrl").addEventListener("paste", () => setTimeout(() => { if (idOf($("#muUrl").value)) $("#muAdd").requestSubmit(); }));
  $("#muStyles").onchange = () => { S.styles = $("#muStyles").value; save(); };
  $("#muStyles").onkeydown = ev => { if (ev.key === "Enter") { S.styles = $("#muStyles").value; save(); discover(); } };
  $("#muDisc").onclick = discover;
  panel.addEventListener("click", ev => {
    const act = ev.target.closest("[data-act]")?.dataset.act, row = ev.target.closest(".mu-it");
    if (act === "key") { S.key = ""; save(); return keyForm(); }
    if (act === "refresh") { msg("Vérification…"); return check(true).then(() => msg("")); }
    if (!row) return;
    const id = row.dataset.id, inDisc = !!ev.target.closest("#muRes");
    const v = inDisc ? S.disc.list.find(x => x.id === id) : S.stations.find(x => x.id === id);
    if (act === "del") return remove(id);
    if (act === "nope" || act === "keep") {
      S.disc.list = S.disc.list.filter(x => x.id !== id);
      if (act === "nope") S.nope.push(id); else { S.stations.push({ ...v, st: "live" }); S.last = id; }
      save(); render(); return renderDisc();
    }
    play(v);
  });
  document.addEventListener("keydown", ev => {
    if (ev.ctrlKey || ev.altKey || ev.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes(ev.target.tagName)) return;
    if (ev.key.toLowerCase() === "m") playPause();
    else if (EMBED && ev.key.toLowerCase() === "n") next();
    else if (ev.key === "Escape" && !panel.hidden) toggle(false);
  });
  document.addEventListener("mousedown", ev => { if (!panel.hidden && !root.contains(ev.target)) toggle(false); });

  render();
  check();   // complète les titres des stations au premier affichage
})();
