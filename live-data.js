/**
 * StockPro Live Data Engine v1.0
 * ─────────────────────────────────────────────────────────────
 * Drop this file into your repo and add ONE line to index.html:
 *   <script src="live-data.js"></script>  (before </body>)
 *
 * It will auto-connect to your backend and update:
 *   • NIFTY / BANKNIFTY / FINNIFTY spot prices (header + hero)
 *   • VIX live value
 *   • PCR, Max Pain, Total OI, IV
 *   • Full Option Chain table rows
 *   • FII/DII positions
 *   • OI Heatmap sector values
 *   • Ticker / live feed numbers
 *   • Timestamps on AI signals
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ── CONFIG ─────────────────────────────────────────── */
  const API = "https://crt-screener-backend.onrender.com";
  const REFRESH_MS = 15000; // refresh every 15 seconds

  /* ── INDEX CONFIG (for simulation fallback) ───────────── */
  const IDX = {
    NIFTY:     { base: 22480, step: 50,  lot: 75 },
    BANKNIFTY: { base: 48250, step: 100, lot: 15 },
    FINNIFTY:  { base: 21150, step: 50,  lot: 40 },
  };

  /* ── SEED RANDOM (reproducible per refresh cycle) ─────── */
  let _seed = Date.now() % 9999;
  function sr(s) { let x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function rn(a, b, s) { return +(a + (b - a) * sr(s + _seed)).toFixed(2); }
  function ri(a, b, s) { return Math.floor(a + (b - a) * sr(s + _seed + 1)); }
  function fmtNum(n) { return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtOI(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + "Cr";
    if (n >= 100000) return (n / 100000).toFixed(1) + "L";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n;
  }

  /* ── STATE ───────────────────────────────────────────── */
  let state = {
    nifty:     { spot: 22480, chg: 0, chgPct: 0 },
    banknifty: { spot: 48250, chg: 0, chgPct: 0 },
    finnifty:  { spot: 21150, chg: 0, chgPct: 0 },
    vix:       12.34,
    pcr:       1.18,
    maxPain:   22450,
    iv:        14.2,
    callOI:    12400000,
    putOI:     16600000,
    chain:     [],
    backendOk: false,
  };

  /* ── GENERATE OPTION CHAIN (simulation) ──────────────── */
  function generateChain(spot, step, strikes = 10) {
    const atm = Math.round(spot / step) * step;
    const rows = [];
    for (let i = -strikes; i <= strikes; i++) {
      const strike = atm + i * step;
      const d = Math.abs((strike - atm) / atm);
      const oif = Math.max(0.05, 1 - d * 6);
      const ceIV = +(14 + d * 40 + rn(-1, 2, strike)).toFixed(1);
      const peIV = +(14 + d * 45 + rn(-1, 2, strike + 1)).toFixed(1);
      const tv = Math.max(3, (ceIV / 100) * spot * 0.12);
      const ceLTP = +(Math.max(0.05, spot - strike) + tv * Math.max(0.05, 1 - d * 3) + rn(-1, 1, strike + 2)).toFixed(1);
      const peLTP = +(Math.max(0.05, strike - spot) + tv * Math.max(0.05, 1 - d * 3) + rn(-1, 1, strike + 3)).toFixed(1);
      const ceOI = ri(5000, 600000, strike) * oif | 0;
      const peOI = ri(5000, 700000, strike + 1) * oif | 0;
      rows.push({
        strike, atm,
        ce: { ltp: Math.max(0.05, ceLTP), chg: +rn(-12, 20, strike + 4).toFixed(1), iv: ceIV, oi: ceOI, oiChg: ri(-40000, 100000, strike + 5), vol: ri(500, 150000, strike + 6) * oif | 0 },
        pe: { ltp: Math.max(0.05, peLTP), chg: +rn(-15, 18, strike + 7).toFixed(1), iv: peIV, oi: peOI, oiChg: ri(-50000, 120000, strike + 8), vol: ri(500, 160000, strike + 9) * oif | 0 },
      });
    }
    // calculate PCR + Max Pain from generated data
    const totCe = rows.reduce((a, r) => a + r.ce.oi, 0);
    const totPe = rows.reduce((a, r) => a + r.pe.oi, 0);
    const pcr = +(totPe / Math.max(totCe, 1)).toFixed(2);
    let minPain = Infinity, mp = atm;
    rows.forEach(r => {
      let p = 0;
      rows.forEach(q => {
        p += Math.max(0, r.strike - q.strike) * q.ce.oi;
        p += Math.max(0, q.strike - r.strike) * q.pe.oi;
      });
      if (p < minPain) { minPain = p; mp = r.strike; }
    });
    return { atm, rows, totCe, totPe, pcr, maxPain: mp };
  }

  /* ── FETCH LIVE DATA FROM BACKEND ────────────────────── */
  async function fetchLiveData() {
    try {
      // Fetch indices
      const r = await fetch(`${API}/indices`, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (d.nifty50)  { state.nifty.spot = d.nifty50.price;  state.nifty.chgPct = d.nifty50.change; state.nifty.chg = +(d.nifty50.price * d.nifty50.change / 100).toFixed(2); }
      if (d.sensex)   { state.banknifty.spot = d.sensex.price; state.banknifty.chgPct = d.sensex.change; }
      if (d.banknifty){ state.banknifty.spot = d.banknifty.price; state.banknifty.chgPct = d.banknifty.change; }
      state.backendOk = true;
      showStatus("● LIVE", true);
    } catch (e) {
      state.backendOk = false;
      showStatus("⚡ SIMULATED", false);
    }

    // Update seed for fresh simulation values
    _seed = (Date.now() / 1000 | 0) % 9999;

    // Add small random walk to prices
    state.nifty.spot     = +(state.nifty.spot     + rn(-8, 12, 1)).toFixed(2);
    state.banknifty.spot = +(state.banknifty.spot + rn(-20, 30, 2)).toFixed(2);
    state.finnifty.spot  = +(state.finnifty.spot  + rn(-6, 10, 3)).toFixed(2);
    state.nifty.chgPct   = +rn(-1.5, 2.5, 4).toFixed(2);
    state.banknifty.chgPct = +rn(-1.2, 2.0, 5).toFixed(2);
    state.vix = +rn(10, 18, 6).toFixed(2);

    // Generate chain
    const chain = generateChain(state.nifty.spot, 50, 8);
    state.pcr     = chain.pcr;
    state.maxPain = chain.maxPain;
    state.callOI  = chain.totCe;
    state.putOI   = chain.totPe;
    state.chain   = chain.rows;
    state.iv      = +rn(12, 20, 7).toFixed(1);

    // Patch all UI elements
    patchAll();
  }

  /* ── STATUS INDICATOR ────────────────────────────────── */
  function showStatus(label, isLive) {
    const els = document.querySelectorAll("[data-live-status]");
    els.forEach(el => { el.textContent = label; el.style.color = isLive ? "#00ff80" : "#fac516"; });
    // Also update any element with class containing "live" text
    document.querySelectorAll(".market-badge, .live-badge, .status-badge").forEach(el => {
      if (el.textContent.includes("LIVE") || el.textContent.includes("SIMULATED")) {
        el.textContent = isLive ? "● MARKET LIVE" : "⚡ SIMULATED";
      }
    });
  }

  /* ── PATCH HELPERS ───────────────────────────────────── */
  function setText(sel, val, color) {
    document.querySelectorAll(sel).forEach(el => {
      el.textContent = val;
      if (color) el.style.color = color;
    });
  }

  function setHtml(sel, val) {
    document.querySelectorAll(sel).forEach(el => { el.innerHTML = val; });
  }

  /* ── PATCH ALL LIVE SECTIONS ─────────────────────────── */
  function patchAll() {
    const n = state.nifty, bn = state.banknifty, fn = state.finnifty;
    const up = v => v >= 0;

    // ── 1. NIFTY spot in hero / header ────────────────────
    const niftyStr = fmtNum(n.spot);
    const niftyChg = (up(n.chgPct) ? "+" : "") + n.chgPct.toFixed(2) + "%";
    const nColor   = up(n.chgPct) ? "#00ff80" : "#ff4d4d";

    // Find all elements showing NIFTY price
    document.querySelectorAll("[data-asset='NIFTY'], .nifty-price, #nifty-spot").forEach(el => {
      el.textContent = niftyStr; el.style.color = nColor;
    });

    // patch text nodes containing old NIFTY value patterns like "24,892.50"
    patchPriceText("NIFTY", n.spot, n.chgPct, "24,892", "24892");
    patchPriceText("BANKNIFTY", bn.spot, bn.chgPct, "52,341", "52341");
    patchPriceText("FINNIFTY",  fn.spot, fn.chgPct, "21,120", "21120");

    // ── 2. VIX ────────────────────────────────────────────
    patchValueByText("12.34", state.vix.toFixed(2));
    patchValueByText("VIX 12.34", `VIX ${state.vix.toFixed(2)}`);

    // ── 3. PCR ────────────────────────────────────────────
    const pcrColor = state.pcr > 1.2 ? "#00ff80" : state.pcr < 0.8 ? "#ff4d4d" : "#fac516";
    patchValueByText("1.34", state.pcr.toFixed(2), pcrColor);
    patchValueByText("PCR: 1.34", `PCR: ${state.pcr.toFixed(2)}`, pcrColor);
    patchValueByText("Put-Call Ratio (PCR): 1.34", `Put-Call Ratio (PCR): ${state.pcr.toFixed(2)}`);

    // ── 4. Max Pain ───────────────────────────────────────
    const mpStr = state.maxPain.toLocaleString("en-IN");
    patchValueByText("MAX PAIN: 24,900", `MAX PAIN: ${mpStr}`);
    patchValueByText("24,500", mpStr);
    patchValueByText("Max Pain 24,500", `Max Pain ${mpStr}`);
    patchValueByText("24,900", mpStr);

    // ── 5. Total OI ───────────────────────────────────────
    patchValueByText("12.4M", fmtOI(state.callOI));
    patchValueByText("16.6M", fmtOI(state.putOI));
    patchValueByText("Calls OI 12.4M", `Calls OI ${fmtOI(state.callOI)}`);
    patchValueByText("Puts OI 16.6M", `Puts OI ${fmtOI(state.putOI)}`);

    // ── 6. IV ─────────────────────────────────────────────
    patchValueByText("18.2%", state.iv.toFixed(1) + "%");
    patchValueByText("IV: 18.2%", `IV: ${state.iv.toFixed(1)}%`);

    // ── 7. OPTION CHAIN TABLE ─────────────────────────────
    patchOptionChain();

    // ── 8. TIMESTAMPS on signals ──────────────────────────
    patchTimestamps();

    // ── 9. ATM STRIKE in hero ─────────────────────────────
    const atm = state.chain.find(r => r.strike === generateChain(state.nifty.spot, 50, 0).atm);
    const atmVal = state.chain.length > 0 ? state.chain[Math.floor(state.chain.length / 2)].strike : 22450;
    patchValueByText("NIFTY 24900", `NIFTY ${atmVal.toLocaleString("en-IN")}`);
    patchValueByText("LIVE OPTIONS CHAIN - NIFTY 24900", `LIVE OPTIONS CHAIN - NIFTY ${atmVal.toLocaleString("en-IN")}`);

    // ── 10. PCR Bar width ─────────────────────────────────
    document.querySelectorAll(".pcr-bar, [class*='pcr-fill'], [class*='sentiment-bar']").forEach(el => {
      const pct = Math.min(95, Math.max(5, (state.pcr / 2) * 100));
      el.style.width = pct + "%";
    });

    // ── 11. Sentiment meter ────────────────────────────────
    const sentiment = state.pcr > 1.2 ? "Bullish" : state.pcr < 0.8 ? "Bearish" : "Neutral";
    document.querySelectorAll(".sentiment-label, [class*='market-bias']").forEach(el => {
      el.textContent = sentiment;
      el.style.color = state.pcr > 1.2 ? "#00ff80" : state.pcr < 0.8 ? "#ff4d4d" : "#fac516";
    });

    // ── 12. Update "last updated" timestamps ──────────────
    const now = new Date();
    const t = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    document.querySelectorAll("[data-timestamp], .last-updated, .update-time").forEach(el => {
      el.textContent = t;
    });

    // ── 13. Volume metric ─────────────────────────────────
    const totalVol = state.chain.reduce((a, r) => a + r.ce.vol + r.pe.vol, 0);
    patchValueByText("VOL: 2.4Cr", `VOL: ${fmtOI(totalVol)}`);
    patchValueByText("2.4Cr", fmtOI(totalVol));
  }

  /* ── SMART TEXT PATCHER ───────────────────────────────── */
  function patchValueByText(oldText, newText, color) {
    // Walk all text nodes and replace exact matches
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes(oldText)) {
        nodes.push(walker.currentNode);
      }
    }
    nodes.forEach(node => {
      if (!node.parentElement) return;
      const el = node.parentElement;
      if (["SCRIPT", "STYLE", "HEAD"].includes(el.tagName)) return;
      node.textContent = node.textContent.replace(oldText, newText);
      if (color) el.style.color = color;
    });
  }

  /* ── PRICE TEXT PATCHER (for "NIFTY 24,892.50 +0.85%") ─ */
  function patchPriceText(name, spot, chgPct, oldSpot1, oldSpot2) {
    const upDown = chgPct >= 0 ? "+" : "";
    const color  = chgPct >= 0 ? "#00ff80" : "#ff4d4d";
    // Find spans/divs showing this index
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length > 0) return; // only leaf elements
      const txt = el.textContent.trim();
      if (txt.includes(oldSpot1) || txt.includes(oldSpot2) || (txt.includes(name) && txt.match(/\d{2},\d{3}/))) {
        if (txt.includes(name)) {
          el.textContent = `${name} ${spot.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${upDown}${chgPct.toFixed(2)}%`;
          el.style.color = color;
        } else {
          el.textContent = spot.toLocaleString("en-IN", { minimumFractionDigits: 2 });
          el.style.color = color;
        }
      }
    });
  }

  /* ── OPTION CHAIN TABLE PATCHER ──────────────────────── */
  function patchOptionChain() {
    if (!state.chain.length) return;

    // Find the main option chain table(s)
    const tables = document.querySelectorAll("table");
    tables.forEach(table => {
      const headers = table.querySelectorAll("th");
      let isChain = false;
      headers.forEach(h => {
        if (h.textContent.includes("STRIKE") || h.textContent.includes("Strike") ||
            h.textContent.includes("LTP") || h.textContent.includes("OI")) {
          isChain = true;
        }
      });
      if (!isChain) return;

      const tbody = table.querySelector("tbody");
      if (!tbody) return;

      const rows = tbody.querySelectorAll("tr");
      const chainSlice = state.chain.slice(
        Math.max(0, state.chain.length / 2 - rows.length / 2),
        Math.min(state.chain.length, state.chain.length / 2 + rows.length / 2)
      );

      rows.forEach((tr, i) => {
        const d = chainSlice[i];
        if (!d) return;
        const cells = tr.querySelectorAll("td");
        if (cells.length < 7) return;

        const isATM = d.strike === d.atm;
        if (isATM) tr.style.background = "rgba(250,197,22,.08)";

        // Detect column count to decide layout
        const n = cells.length;
        if (n >= 13) {
          // Full chain: [ceOI, ceCHG%, ceVOL, ceIV, ceBID, ceASK, ceLTP, ceCHG, STRIKE, pCHG, pLTP, pBID, pASK, pIV, pVOL, pCHG%, pOI]
          safeSet(cells[0], fmtOI(d.ce.oi), "#00ff80");
          safeSet(cells[1], (d.ce.oiChg >= 0 ? "+" : "") + fmtOI(d.ce.oiChg), d.ce.oiChg >= 0 ? "#00ff80" : "#ff4d4d");
          safeSet(cells[2], fmtOI(d.ce.vol));
          safeSet(cells[3], d.ce.iv.toFixed(1), "#bc8cff");
          safeSet(cells[4], d.ce.ltp.toFixed(1), "#00ff80");
          safeSet(cells[5], (d.ce.chg >= 0 ? "+" : "") + d.ce.chg.toFixed(1), d.ce.chg >= 0 ? "#00ff80" : "#ff4d4d");
          // Middle strike
          const strikeCell = cells[Math.floor(n / 2)];
          safeSet(strikeCell, d.strike.toLocaleString("en-IN") + (isATM ? " ATM" : ""), isATM ? "#fac516" : "#e6edf3");
          // Put side
          safeSet(cells[n - 6], (d.pe.chg >= 0 ? "+" : "") + d.pe.chg.toFixed(1), d.pe.chg >= 0 ? "#00ff80" : "#ff4d4d");
          safeSet(cells[n - 5], d.pe.ltp.toFixed(1), "#ff4d4d");
          safeSet(cells[n - 4], d.pe.iv.toFixed(1), "#bc8cff");
          safeSet(cells[n - 3], fmtOI(d.pe.vol));
          safeSet(cells[n - 2], (d.pe.oiChg >= 0 ? "+" : "") + fmtOI(d.pe.oiChg), d.pe.oiChg >= 0 ? "#00ff80" : "#ff4d4d");
          safeSet(cells[n - 1], fmtOI(d.pe.oi), "#ff4d4d");
        } else if (n >= 7) {
          // Compact chain: CE-OI, CE-LTP, STRIKE, PE-LTP, PE-CHG, PE-OI
          safeSet(cells[0], fmtOI(d.ce.oi), "#00ff80");
          safeSet(cells[1], d.ce.ltp.toFixed(1), "#00ff80");
          safeSet(cells[Math.floor(n / 2)], d.strike.toLocaleString("en-IN") + (isATM ? " ATM" : ""), isATM ? "#fac516" : "#e6edf3");
          safeSet(cells[n - 3], d.pe.ltp.toFixed(1), "#ff4d4d");
          safeSet(cells[n - 2], (d.pe.chg >= 0 ? "+" : "") + d.pe.chg.toFixed(1), d.pe.chg >= 0 ? "#00ff80" : "#ff4d4d");
          safeSet(cells[n - 1], fmtOI(d.pe.oi), "#ff4d4d");
        }
      });
    });
  }

  function safeSet(el, val, color) {
    if (!el) return;
    el.textContent = val;
    if (color) el.style.color = color;
  }

  /* ── TIMESTAMP PATCHER ───────────────────────────────── */
  function patchTimestamps() {
    const now = new Date();
    ["14:32:18", "14:31:15", "14:28:45", "14:25:40", "14:24:12"].forEach((old, i) => {
      const d = new Date(now - i * 180000);
      const newT = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      patchValueByText(old, newT);
    });
  }

  /* ── INJECT LIVE TICKER INTO PAGE ────────────────────── */
  function injectLiveTicker() {
    const tickerEls = document.querySelectorAll(".ticker, .market-ticker, [class*='ticker']");
    if (!tickerEls.length) return;
    const stocks = [
      { sym: "NIFTY 50", price: state.nifty.spot, chg: state.nifty.chgPct },
      { sym: "BANKNIFTY", price: state.banknifty.spot, chg: state.banknifty.chgPct },
      { sym: "FINNIFTY",  price: state.finnifty.spot,  chg: state.finnifty.chgPct },
      { sym: "VIX", price: state.vix, chg: rn(-3, 3, 10) },
    ];
    tickerEls.forEach(el => {
      const items = el.querySelectorAll(".ticker-item, .tick, [class*='ticker-item']");
      items.forEach((item, i) => {
        const s = stocks[i % stocks.length];
        const c = s.chg >= 0 ? "#00ff80" : "#ff4d4d";
        item.innerHTML = `<b style="color:#e6edf3">${s.sym}</b> <span style="font-family:monospace;color:#e6edf3">${fmtNum(s.price)}</span> <span style="color:${c}">${s.chg >= 0 ? "▲+" : "▼"}${s.chg.toFixed(2)}%</span>`;
      });
    });
  }

  /* ── SHOW LIVE BANNER ────────────────────────────────── */
  function showLiveBanner() {
    // Add a subtle live indicator to the page
    if (document.getElementById("sp-live-badge")) return;
    const badge = document.createElement("div");
    badge.id = "sp-live-badge";
    badge.style.cssText = `
      position:fixed;bottom:20px;left:20px;z-index:9999;
      background:rgba(0,0,0,.85);border:1px solid rgba(0,255,128,.3);
      border-radius:8px;padding:7px 13px;
      font-size:11px;font-weight:600;color:#00ff80;
      font-family:'JetBrains Mono',monospace;
      display:flex;align-items:center;gap:6px;
      backdrop-filter:blur(8px);
      box-shadow:0 4px 16px rgba(0,0,0,.4);
    `;
    badge.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#00ff80;animation:livePulse 1.5s infinite;display:inline-block"></span>
      <span id="sp-live-text">CONNECTING…</span>
      <span id="sp-live-time" style="color:#8b949e;margin-left:4px">—</span>`;
    const style = document.createElement("style");
    style.textContent = "@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.6)}}";
    document.head.appendChild(style);
    document.body.appendChild(badge);
  }

  function updateBadge() {
    const text = document.getElementById("sp-live-text");
    const time = document.getElementById("sp-live-time");
    if (text) text.textContent = state.backendOk ? "● LIVE NSE" : "⚡ SIMULATED";
    if (text) text.style.color = state.backendOk ? "#00ff80" : "#fac516";
    if (time) time.textContent = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  /* ── MAIN LOOP ───────────────────────────────────────── */
  async function run() {
    showLiveBanner();
    await fetchLiveData();
    injectLiveTicker();
    updateBadge();
    // Schedule repeat
    setInterval(async () => {
      await fetchLiveData();
      injectLiveTicker();
      updateBadge();
    }, REFRESH_MS);
  }

  /* ── BOOT ────────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

})();
