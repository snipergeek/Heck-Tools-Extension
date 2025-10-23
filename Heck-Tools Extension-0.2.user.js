// ==UserScript==
// @name         Heck-Tools Extension
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Interface de recherche multi-sites
// @author       GOSTFRAME
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
  'use strict';

  /* ---------- Helpers ---------- */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function saveSites(sites) {
    localStorage.setItem('msqs_sites_v1', JSON.stringify(sites));
  }
  function loadSites() {
    const raw = localStorage.getItem('msqs_sites_v1');
    if (!raw) {
      const defaultSites = [
        {name: "steamunlocked", template: "https://steamunlocked.org/?s={q}"},
        {name: "game3rb", template: "https://game3rb.com/?s={q}"},
        {name: "fitgirl-repacks", template: "https://fitgirl-repacks.site/?s={q}"},
        {name: "pcgamestorrents", template: "https://pcgamestorrents.com/?s={q}"},
        {name: "repack-games", template: "https://repack-games.com/?s={q}"},
        {name: "cracked-games", template: "https://cracked-games.org/?s={q}"},
        {name: "skidrowreloaded", template: "https://www.skidrowreloaded.com/?s={q}&x=0&y=0"},
        {name: "pivigames", template: "https://pivigames.blog/?s={q}"},
        {name: "mrpcgamer", template: "https://mrpcgamer.net/?s={q}"},
        {name: "gamestorrents.app", template: "https://www.gamestorrents.app/?s={q}"},
        {name: "online-fix", template: "https://online-fix.me/index.php?do=search&subaction=search&story={q}"}
      ];
      saveSites(defaultSites);
      return defaultSites;
    }
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  /* ---------- UI styles (Thème sombre) ---------- */
  GM_addStyle(`
  #msqs_sidebar {
    position: fixed;
    right: 12px;
    top: 60px;
    width: 360px;
    max-height: 80vh;
    background: #1e1e1e;
    border: 1px solid #333;
    box-shadow: 0 6px 18px rgba(0,0,0,0.6);
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #ddd;
  }
  #msqs_header {
    padding: 10px;
    display:flex;
    gap:8px;
    align-items:center;
    border-bottom:1px solid #333;
  }
  #msqs_header input[type="text"]{
    flex:1;
    padding:8px;
    border-radius:6px;
    border:1px solid #555;
    background: #2b2b2b;
    color: #ddd;
  }
  #msqs_header button {
    padding:8px 10px;
    border-radius:6px;
    border: none;
    cursor:pointer;
    background: #0b76ff;
    color: #fff;
  }
  #msqs_results {
    padding:10px;
    overflow:auto;
    flex:1;
    background: #181818;
  }
  .msqs_site {
    padding:8px;
    border-radius:6px;
    margin-bottom:8px;
    border:1px solid #333;
    background: #2a2a2a;
  }
  .msqs_site h4 { margin:0 0 6px 0; font-size:14px; display:flex; justify-content:space-between; align-items:center;}
  .msqs_site .msqs_found { font-weight:700; color: #0bff6e; }
  .msqs_site .msqs_notfound { color:#999; }
  #msqs_footer { padding:8px; border-top:1px solid #333; display:flex; gap:8px; align-items:center;}
  #msqs_sitesList { max-height:110px; overflow:auto; width:100%; padding:6px; border:1px dashed #555; border-radius:6px; background: #2b2b2b; color:#ddd; }
  .msqs_small { font-size:12px; color:#aaa; }
  .msqs_btn_small { padding:6px 8px; border-radius:6px; border:none; cursor:pointer; font-size:12px; background:#0b76ff; color:#fff; }
  #msqs_toggle {
    position: fixed;
    right: 12px;
    top: 16px;
    z-index: 999999;
    background: #0b76ff;
    color: #fff;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(11,118,255,0.3);
  }
  #msqs_sidebar a { color: #0b76ff; text-decoration: none; }
  #msqs_sidebar a:hover { text-decoration: underline; }
  `);

  /* ---------- Build UI ---------- */
  const sidebar = document.createElement('div');
  sidebar.id = 'msqs_sidebar';
  sidebar.style.display = 'none';

  sidebar.innerHTML = `
    <div id="msqs_header">
      <input id="msqs_query" placeholder="Recherche"/>
      <button id="msqs_search">Chercher</button>
    </div>
    <div id="msqs_results"><div class="msqs_small">Aucune recherche effectuée.</div></div>
    <div id="msqs_footer">
      <div style="flex:1">
        <div class="msqs_small">Sites (éditable) :</div>
        <textarea id="msqs_sitesList" rows="4"></textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <button class="msqs_btn_small" id="msqs_saveSites">Save</button>
        <button class="msqs_btn_small" id="msqs_addSite">+ Site</button>
        <button class="msqs_btn_small" id="msqs_clear">Clear</button>
      </div>
    </div>
  `;
  document.body.appendChild(sidebar);

  const toggle = document.createElement('div');
  toggle.id = 'msqs_toggle';
  toggle.textContent = 'Heck-Tools Extension';
  document.body.appendChild(toggle);

  toggle.addEventListener('click', () => {
    sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
  });

  function renderSitesArea() {
    const sites = loadSites();
    const ta = document.getElementById('msqs_sitesList');
    ta.value = sites.map(s => `${s.name} | ${s.template}`).join('\n');
  }
  renderSitesArea();

  document.getElementById('msqs_saveSites').addEventListener('click', () => {
    const raw = document.getElementById('msqs_sitesList').value.trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const sites = lines.map(line => {
      const parts = line.split('|').map(p=>p.trim());
      return {name: parts[0] || 'Site', template: parts[1] || parts[0] || ''};
    });
    saveSites(sites);
    alert('Sites sauvegardés : ' + sites.length);
  });

  document.getElementById('msqs_addSite').addEventListener('click', () => {
    const ta = document.getElementById('msqs_sitesList');
    ta.value = ta.value + (ta.value.trim() ? '\n' : '') + 'NomSite | https://example.com/search?q={q}';
  });

  document.getElementById('msqs_clear').addEventListener('click', () => {
    document.getElementById('msqs_results').innerHTML = '<div class="msqs_small">Aucune recherche effectuée.</div>';
  });

  let currentRequests = [];

  function buildSearchUrl(template, query) {
    return template.replace(/{q}/g, encodeURIComponent(query));
  }

  function showResultsPlaceholder(msg) {
    const r = document.getElementById('msqs_results');
    r.innerHTML = `<div class="msqs_small">${msg}</div>`;
  }

  function appendResult(siteName, url, found, excerpt) {
    const container = document.getElementById('msqs_results');
    const div = document.createElement('div');
    div.className = 'msqs_site';
    const title = document.createElement('h4');
    const titleLeft = document.createElement('span');
    titleLeft.textContent = siteName;
    const titleRight = document.createElement('span');
    titleRight.innerHTML = found ? `<span class="msqs_found">Trouvé</span>` : `<span class="msqs_notfound">Non trouvé</span>`;
    title.appendChild(titleLeft);
    title.appendChild(titleRight);

    const body = document.createElement('div');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Ouvrir la recherche';
    link.style.display = 'inline-block';
    link.style.marginBottom = '6px';

    body.appendChild(link);

    if (found && excerpt) {
      const pre = document.createElement('div');
      pre.style.fontSize = '13px';
      pre.style.padding = '6px';
      pre.style.border = '1px solid #333';
      pre.style.background = '#1a1a1a';
      pre.style.borderRadius = '6px';
      pre.style.maxHeight = '120px';
      pre.style.overflow = 'auto';
      pre.textContent = excerpt;
      body.appendChild(pre);
    }

    div.appendChild(title);
    div.appendChild(body);
    container.appendChild(div);
  }

  function performSearch(query) {
    const sites = loadSites();
    const resultsContainer = document.getElementById('msqs_results');
    resultsContainer.innerHTML = '';
    if (!query || !query.trim()) {
      showResultsPlaceholder('Tape une recherche valide.');
      return;
    }
    showResultsPlaceholder('Recherche en cours — envoi des requêtes...');
    currentRequests.forEach(r => r.abort && r.abort());
    currentRequests = [];

    const re = new RegExp('\\b' + escapeRegExp(query) + '\\b', 'i');

    sites.forEach(site => {
      const url = buildSearchUrl(site.template, query);
      const req = GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: { 'User-Agent': navigator.userAgent, 'Accept': 'text/html,application/xhtml+xml' },
        timeout: 15000,
        onload: function(resp) {
          let text = resp.responseText || '';
          const match = text.match(re);
          let excerpt = null;
          if (match) {
            const idx = match.index;
            const start = Math.max(0, idx - 120);
            const end = Math.min(text.length, idx + query.length + 120);
            excerpt = text.substring(start, end).replace(/\s+/g,' ').trim();
            if (excerpt.length > 400) excerpt = excerpt.substring(0,400) + '…';
          }
          appendResult(site.name, url, !!match, excerpt);
        },
        onerror: function() { appendResult(site.name, url, false, null); },
        ontimeout: function() { appendResult(site.name, url, false, null); }
      });
      currentRequests.push(req);
    });
  }

  document.getElementById('msqs_search').addEventListener('click', () => {
    const q = document.getElementById('msqs_query').value.trim();
    performSearch(q);
  });
  document.getElementById('msqs_query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('msqs_search').click();
    }
  });

  sidebar.style.display = 'none';

})();
