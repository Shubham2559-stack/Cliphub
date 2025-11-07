/* ========= MAIN.JS - Google Sheet driven content + views + MP4 support =========
   Instructions:
   1) Update SHEET_ID below to your sheet's ID.
   2) Optional: Add your Apps Script endpoint to SHEET_VIEW_API if you want live view tracking.
   3) Supports both YouTube and direct MP4 video links automatically.
*/

/* ---------- CONFIG: Your Google Sheet ---------- */
const SHEET_ID = "1ghG6cfdI07-Xass7Tcej1kgew6lvmDTRe-UMMbn8U-g";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
const SHEET_VIEW_API = ""; // optional Apps Script endpoint
const LOCAL_VIEW_PREFIX = "local_view_";

/* ---------- DATA holders ---------- */
let DATA = [];
let VIEW_MAP = {};

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);
const shuffle = arr => arr.slice().sort(()=>Math.random()-0.5);

/* ---------- Robust CSV parser ---------- */
function parseCSV(text){
  const rows = [];
  let cur = [], cell = "", inQuotes = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i], nxt = text[i+1];
    if (ch === '"' ) {
      if (inQuotes && nxt === '"'){ cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cur.push(cell); cell = "";
    } else if ((ch === '\n' || (ch === '\r' && nxt === '\n')) && !inQuotes) {
      cur.push(cell); rows.push(cur); cur = []; cell = "";
      if (ch === '\r' && nxt === '\n') i++;
    } else cell += ch;
  }
  if (cell !== "" || cur.length){ cur.push(cell); rows.push(cur); }
  return rows;
}

/* ---------- Convert rows to DATA ---------- */
function rowsToData(rows){
  const out = [];
  if (!rows || rows.length === 0) return out;
  const header = rows[0].map(h=>h.trim().toLowerCase());
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
  for (let i=1;i<rows.length;i++){
    const r = rows[i]; if (!r || r.length===0) continue;
    const id = (r[idx.id]||"").trim(); if (!id) continue;
    const title = (r[idx.title]||"").trim();
    const dur = (r[idx.dur]||"").trim() || "00:00";
    const cat = (r[idx.cat]||"").trim() || "Uncategorized";
    const thumb = (r[idx.thumb]||"").trim() || `https://picsum.photos/seed/${id}/400/225`;
    const yt = (r[idx.yt]||"").trim() || "";
    const desc = (r[idx.desc]||"").trim() || "";
    const views = parseInt((r[idx.views]||"0").trim()||"0",10)||0;
    out.push({ id, title, dur, cat, thumb, yt, desc, views });
  }
  return out;
}

/* ---------- Fetch Sheet ---------- */
async function fetchSheetData(){
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    DATA = rowsToData(rows);
    VIEW_MAP = {};
    DATA.forEach(d => { VIEW_MAP[d.id] = d.views || 0; });
    initialRenderAfterData();
  } catch (err) {
    console.error("Failed to fetch sheet data:", err);
    DATA = []; VIEW_MAP = {};
    initialRenderAfterData();
  }
}

/* ---------- Render Cards ---------- */
function renderCards(grid, list){
  const box = $(grid), tpl = $("cardTpl");
  if(!box || !tpl) return;
  box.innerHTML = "";
  list.forEach(v=>{
    const n = tpl.content.cloneNode(true);
    const img = n.querySelector("img");
    if(img){ img.src = v.thumb; img.onload = () => img.classList.add("loaded"); }
    const durEl = n.querySelector(".dur"); if(durEl) durEl.textContent = v.dur || "00:00";
    const titleEl = n.querySelector(".title");
    if(titleEl){ titleEl.textContent = v.title || "Clip"; titleEl.href = `watch.html?id=${v.id}`; }
    const thumbLink = n.querySelector(".thumb a"); if(thumbLink) thumbLink.href = `watch.html?id=${v.id}`;
    const vc = n.querySelector(".view-count");
    const views = VIEW_MAP[v.id] || (v.views || 0);
    if(vc) vc.textContent = views;
    box.appendChild(n);
  });
}

/* ---------- Sort helpers ---------- */
function sortByDurationDesc(list){
  return list.slice().sort((a,b)=>{
    const toSec = t=>{
      const [m,s]=(t||"0:00").split(":").map(Number);
      return (m||0)*60+(s||0);
    };
    return toSec(b.dur)-toSec(a.dur);
  });
}
function sortByViews(list){
  return list.slice().sort((a,b)=>(VIEW_MAP[b.id]||0)-(VIEW_MAP[a.id]||0));
}

/* ---------- Initial Render ---------- */
function initialRenderAfterData(){
  // Home
  if($("latestGrid")){
    const mode = $("videoMode")?.value || "latest";
    handleModeChange(mode,"latestGrid");
  }
  if($("randomGrid") && !location.pathname.includes("watch")){
    renderCards("randomGrid", shuffle(DATA).slice(0,12));
  }

  // Category
  if(location.pathname.includes("category.html")){
    const c = new URLSearchParams(location.search).get("cat");
    if($("catName")) $("catName").textContent = c || "Category";
    const modeCat = $("videoModeCat")?.value || "latest";
    handleModeChange(modeCat, "catGrid", c);
  }

  // Watch
  if(location.pathname.includes("watch.html")){
    const id = new URLSearchParams(location.search).get("id");
    const v = DATA.find(x=>x.id===id);
    if(v){
      $("videoTitle") && ($("videoTitle").textContent = v.title);
      $("videoDesc") && ($("videoDesc").textContent = v.desc);

      const box = document.querySelector(".video-box");
      if(!box) return;

      // 🔥 Auto-detect MP4 or YouTube
      if(v.yt.endsWith(".mp4") || v.yt.includes(".mp4?")){
        const video = document.createElement("video");
        video.className = "video-player";
        video.controls = true;
        video.autoplay = true;
        video.poster = v.thumb;
        const src = document.createElement("source");
        src.src = v.yt;
        src.type = "video/mp4";
        video.appendChild(src);
        box.innerHTML = "";
        box.appendChild(video);
      } else {
        const iframe = document.createElement("iframe");
        iframe.src = v.yt.replace("www.youtube.com","www.youtube-nocookie.com");
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "no-referrer";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        box.innerHTML = "";
        box.appendChild(iframe);
      }

      renderCards("relatedGrid", shuffle(DATA.filter(x=>x.cat===v.cat && x.id!==v.id)).slice(0,12));
      renderCards("randomGrid", shuffle(DATA).slice(0,12));

      // increment view count
      updateViewCountFor(id);
    }
  }
}

/* ---------- Mode Change ---------- */
function handleModeChange(mode, gridId, catFilter=null){
  let list = DATA;
  if(catFilter) list = DATA.filter(v=>v.cat===catFilter);
  if(mode==="latest") renderCards(gridId, list.slice(0,12));
  else if(mode==="random") renderCards(gridId, shuffle(list).slice(0,12));
  else if(mode==="longest") renderCards(gridId, sortByDurationDesc(list).slice(0,12));
  else if(mode==="most") renderCards(gridId, sortByViews(list).slice(0,12));
}

/* ---------- Search ---------- */
function applySearch(){
  const q = $("searchInput")?.value?.toLowerCase().trim() || "";
  const url = new URL(location);
  if(q) url.searchParams.set("search", q); else url.searchParams.delete("search");
  history.replaceState({}, "", url);
  const results = q ? DATA.filter(v=>v.title.toLowerCase().includes(q)) : DATA.slice(0,12);
  if($("latestGrid")) renderCards("latestGrid", results);
  if($("catGrid")){
    const c = new URLSearchParams(location.search).get("cat");
    renderCards("catGrid", results.filter(v=>v.cat===c));
  }
}
$("searchBtn")?.addEventListener("click", applySearch);
$("searchInput")?.addEventListener("keyup", e=>{ if(e.key==="Enter") applySearch(); });

/* ---------- View Counter ---------- */
async function updateViewCountFor(id){
  if(SHEET_VIEW_API && SHEET_VIEW_API.trim()!==""){
    try{
      const res = await fetch(`${SHEET_VIEW_API}?id=${encodeURIComponent(id)}`);
      if(res.ok){
        const text = await res.text();
        const newCount = parseInt(text,10);
        if(!isNaN(newCount)){
          VIEW_MAP[id] = newCount;
          const entry = DATA.find(d=>d.id===id);
          if(entry) entry.views = newCount;
          refreshVisibleGrids();
          return;
        }
      }
    }catch(err){ console.warn("View API failed, fallback to local", err); }
  }
  // local fallback
  const key = LOCAL_VIEW_PREFIX + id;
  const localCount = parseInt(localStorage.getItem(key)||"0",10) || 0;
  localStorage.setItem(key, localCount+1);
  VIEW_MAP[id] = (VIEW_MAP[id]||0)+1;
  const entry = DATA.find(d=>d.id===id);
  if(entry) entry.views = VIEW_MAP[id];
  refreshVisibleGrids();
}

/* ---------- Refresh visible grids ---------- */
function refreshVisibleGrids(){
  const mode = $("videoMode")?.value || "latest";
  if($("latestGrid")) handleModeChange(mode,"latestGrid");
  if($("randomGrid") && !location.pathname.includes("watch")) renderCards("randomGrid", shuffle(DATA).slice(0,12));
  if(location.pathname.includes("category.html")){
    const modeCat = $("videoModeCat")?.value || "latest";
    const c = new URLSearchParams(location.search).get("cat");
    if($("catGrid")) handleModeChange(modeCat,"catGrid",c);
  }
}

/* ---------- Dropdown listeners ---------- */
$("videoMode")?.addEventListener("change", e=>{
  handleModeChange(e.target.value, "latestGrid");
});
$("videoModeCat")?.addEventListener("change", e=>{
  const c = new URLSearchParams(location.search).get("cat");
  handleModeChange(e.target.value, "catGrid", c);
});

/* ---------- To Top ---------- */
document.querySelector(".to-top")?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

/* ---------- INIT ---------- */
fetchSheetData();
sendBtn.classList.add("sending");
// after done:
sendBtn.classList.remove("sending");
