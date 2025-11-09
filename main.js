/* ========= MAIN.JS - Google Sheet + Pagination + MP4 Support =========
   Features:
   ✅ Pagination + Filters + Views from Google Sheet
   ✅ YouTube + MP4 support
   ✅ Native fullscreen (no extra ⛶ button)
   ✅ Auto-pause when tab inactive or user scrolls away
*/

/* ---------- CONFIG ---------- */
const SHEET_ID = "1ghG6cfdI07-Xass7Tcej1kgew6lvmDTRe-UMMbn8U-g";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
const LOCAL_VIEW_PREFIX = "local_view_";

/* ---------- DATA ---------- */
let DATA = [];
let VIEW_MAP = {};
let currentPage = 1;
const perPage = 12;

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);
const shuffle = arr => arr.slice().sort(() => Math.random() - 0.5);

/* ---------- PARSE CSV ---------- */
function parseCSV(text) {
  const rows = [];
  let cur = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nxt = text[i + 1];
    if (ch === '"') {
      if (inQuotes && nxt === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cur.push(cell); cell = "";
    } else if ((ch === '\n' || (ch === '\r' && nxt === '\n')) && !inQuotes) {
      cur.push(cell); rows.push(cur); cur = []; cell = "";
      if (ch === '\r' && nxt === '\n') i++;
    } else cell += ch;
  }
  if (cell !== "" || cur.length) { cur.push(cell); rows.push(cur); }
  return rows;
}

/* ---------- CONVERT ROWS ---------- */
function rowsToData(rows) {
  const out = []; if (!rows || !rows.length) return out;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    id: header.indexOf("id"),
    title: header.indexOf("title"),
    dur: header.indexOf("duration"),
    cat: header.indexOf("category"),
    thumb: header.indexOf("thumbnail"),
    yt: header.indexOf("youtube"),
    desc: header.indexOf("description"),
    views: header.indexOf("views")
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r.length) continue;
    const id = (r[idx.id] || "").trim(); if (!id) continue;

    const title = (r[idx.title] || "").trim();
    const dur = (r[idx.dur] || "").trim() || "00:00";
    const cat = (r[idx.cat] || "").trim() || "Uncategorized";
    const thumb = (r[idx.thumb] || "").trim() || `https://picsum.photos/seed/${id}/400/225`;
    const yt = (r[idx.yt] || "").trim() || "";
    const desc = (r[idx.desc] || "").trim() || "";
    const viewsRaw = (r[idx.views] || "0").toString().trim();
    const views = parseInt(viewsRaw.replace(/,/g, "")) || 0;

    out.push({ id, title, dur, cat, thumb, yt, desc, views });
  }
  return out;
}

/* ---------- FETCH SHEET ---------- */
async function fetchSheetData() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    DATA = rowsToData(rows);
    VIEW_MAP = {};
    DATA.forEach(d => VIEW_MAP[d.id] = d.views || 0);
    initialRenderAfterData();
  } catch (err) {
    console.error("Failed to fetch sheet data:", err);
    DATA = []; VIEW_MAP = {};
    initialRenderAfterData();
  }
}

/* ---------- RENDER CARDS ---------- */
function renderCards(grid, list) {
  const box = $(grid), tpl = $("cardTpl");
  if (!box || !tpl) return;
  box.innerHTML = "";
  list.forEach(v => {
    const n = tpl.content.cloneNode(true);
    const img = n.querySelector("img");
    if (img) { img.src = v.thumb; img.onload = () => img.classList.add("loaded"); }
    n.querySelector(".dur").textContent = v.dur || "00:00";
    const t = n.querySelector(".title");
    t.textContent = v.title; t.href = `watch.html?id=${v.id}`;
    n.querySelector(".thumb a").href = `watch.html?id=${v.id}`;
    const viewsEl = n.querySelector(".view-count");
    if (viewsEl) viewsEl.textContent = v.views > 0 ? v.views.toLocaleString() : "0";
    box.appendChild(n);
  });
}

/* ---------- PAGINATION ---------- */
function renderPagination(gridId, total, perPage, currentPage, onChange) {
  let pager = $("pager-" + gridId);
  if (!pager) {
    pager = document.createElement("div");
    pager.id = "pager-" + gridId;
    pager.className = "pager";
    $(gridId).after(pager);
  }
  pager.innerHTML = "";
  pager.style.justifyContent = "center";

  const totalPages = Math.ceil(total / perPage);
  const prev = document.createElement("button");
  prev.className = "page";
  prev.textContent = "◀";
  prev.disabled = currentPage === 1;
  prev.onclick = () => onChange(currentPage - 1);
  pager.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "page" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => onChange(i);
    pager.appendChild(btn);
  }

  const next = document.createElement("button");
  next.className = "page";
  next.textContent = "▶";
  next.disabled = currentPage === totalPages;
  next.onclick = () => onChange(currentPage + 1);
  pager.appendChild(next);
}

/* ---------- SCROLL TO TOP ---------- */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- PAGE RENDER ---------- */
function renderPage(gridId, list) {
  const total = list.length;
  const urlParams = new URLSearchParams(location.search);
  const pageFromURL = parseInt(urlParams.get("page")) || 1;
  currentPage = pageFromURL > 0 ? pageFromURL : 1;

  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageList = list.slice(start, end);
  renderCards(gridId, pageList);

  renderPagination(gridId, total, perPage, currentPage, page => {
    currentPage = page;
    const url = new URL(location);
    url.searchParams.set("page", page);
    history.pushState({}, "", url);
    renderPage(gridId, list);
    scrollToTop();
  });
}

/* ---------- INITIAL RENDER ---------- */
function initialRenderAfterData() {
  // HOME
  if ($("latestGrid")) renderPage("latestGrid", DATA);
  if ($("randomGrid") && !location.pathname.includes("watch"))
    renderCards("randomGrid", shuffle(DATA).slice(0, 12));

  // CATEGORY
  if (location.pathname.includes("category.html")) {
    const c = new URLSearchParams(location.search).get("cat");
    if ($("catName")) $("catName").textContent = c || "Category";
    const filtered = DATA.filter(v => v.cat === c);
    renderPage("catGrid", filtered);
  }

  // WATCH PAGE
  if (location.pathname.includes("watch.html")) {
    const id = new URLSearchParams(location.search).get("id");
    const v = DATA.find(x => x.id === id);
    if (v) {
      $("videoTitle").textContent = v.title;
      $("videoDesc").textContent = v.desc;
      const box = document.querySelector(".video-box");
      if (!box) return;
      box.innerHTML = "";

      let video;
      if (v.yt.endsWith(".mp4") || v.yt.includes(".mp4?")) {
        video = document.createElement("video");
        video.className = "video-player";
        video.controls = true;
        video.autoplay = true;
        video.poster = v.thumb;
        video.playsInline = true;
        const src = document.createElement("source");
        src.src = v.yt;
        src.type = "video/mp4";
        video.appendChild(src);
        box.appendChild(video);
      } else {
        const iframe = document.createElement("iframe");
        iframe.src = v.yt.replace("www.youtube.com", "www.youtube-nocookie.com");
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "no-referrer";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        box.appendChild(iframe);
      }

      // ✅ Local view count
      const viewKey = LOCAL_VIEW_PREFIX + v.id;
      if (!localStorage.getItem(viewKey)) {
        localStorage.setItem(viewKey, Date.now());
        v.views = (v.views || 0) + 1;
      }


      renderCards("relatedGrid", shuffle(DATA.filter(x => x.cat === v.cat && x.id !== v.id)).slice(0, 12));
      renderCards("randomGrid", shuffle(DATA).slice(0, 12));

      // ✅ Auto-pause & resume logic
      if (video) {
        document.addEventListener("visibilitychange", () => {
          if (document.hidden && !video.paused) video.pause();
          else if (!document.hidden && video.paused) video.play().catch(() => {});
        });

        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting && !video.paused) video.pause();
            else if (entry.isIntersecting && video.paused) video.play().catch(() => {});
          });
        }, { threshold: 0.25 });
        observer.observe(video);
      }
    }
  }
}

/* ---------- SEARCH ---------- */
function applySearch() {
  const q = $("searchInput")?.value?.toLowerCase().trim() || "";
  const url = new URL(location);
  if (q) url.searchParams.set("search", q);
  else url.searchParams.delete("search");
  history.replaceState({}, "", url);

  const results = q ? DATA.filter(v => v.title.toLowerCase().includes(q)) : DATA;
  currentPage = 1;
  if ($("latestGrid")) renderPage("latestGrid", results);
  if ($("catGrid")) {
    const c = new URLSearchParams(location.search).get("cat");
    renderPage("catGrid", results.filter(v => v.cat === c));
  }
}
$("searchBtn")?.addEventListener("click", applySearch);
$("searchInput")?.addEventListener("keyup", e => { if (e.key === "Enter") applySearch(); });

/* ---------- FILTER ---------- */
$("videoMode")?.addEventListener("change", e => {
  const mode = e.target.value;
  let list = [...DATA];

  switch (mode) {
    case "longest":
      list.sort((a, b) => {
        const toSec = t => {
          const [m, s] = (t || "0:00").split(":").map(Number);
          return (m || 0) * 60 + (s || 0);
        };
        return toSec(b.dur) - toSec(a.dur);
      });
      break;
    case "most":
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
    case "random":
      list = shuffle(DATA);
      break;
    default:
      list = [...DATA];
      break;
  }

  if ($("latestGrid")) renderPage("latestGrid", list);
});

/* ---------- TO TOP ---------- */
document.querySelector(".to-top")?.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" })
);

/* ---------- INIT ---------- */
fetchSheetData();
