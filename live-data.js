// live-data.js

// Configuration
const CONFIG = {
  updateIntervalMs: 5000 // Refresh all index quotes, heatmap, and option chain every 5 seconds
};

// List of top Nifty stocks mapped to their Yahoo Finance symbols for the Live Heatmap
const HEATMAP_SYMBOLS = {
  "RELIANCE": "RELIANCE.NS",
  "TCS": "TCS.NS",
  "HDFCBANK": "HDFCBANK.NS",
  "INFY": "INFY.NS",
  "ICICIBANK": "ICICIBANK.NS",
  "SBIN": "SBIN.NS",
  "ITC": "ITC.NS",
  "LT": "LT.NS",
  "BHARTIARTL": "BHARTIARTL.NS",
  "KOTAKBANK": "KOTAKBANK.NS",
  "TATAMOTORS": "TATAMOTORS.NS",
  "AXISBANK": "AXISBANK.NS",
  "HINDUNILVR": "HINDUNILVR.NS",
  "MARUTI": "MARUTI.NS",
  "SUNPHARMA": "SUNPHARMA.NS"
};

// Global market data state
let marketData = {
  nifty: { price: 24892.50, change: 210.35, percent: 0.85 },
  banknifty: { price: 52341.20, change: -62.80, percent: -0.12 },
  vix: { price: 12.34, change: 0.25, percent: 2.10 }
};

/**
 * 1. LIVE HEATMAP ENGINE
 * Finds stock elements by name (e.g., "RELIANCE") inside your #heatmap UI,
 * updates their live prices, and applies beautiful live green/red background states.
 */
function updateHeatmapUI(ticker, price, percentChange) {
  const allElements = Array.from(document.querySelectorAll('*'));
  const targetElement = allElements.find(el => 
    el.textContent.trim().toUpperCase() === ticker.toUpperCase() && el.children.length === 0
  );
  
  if (targetElement) {
    const card = targetElement.closest('div');
    if (card) {
      const childTexts = Array.from(card.querySelectorAll('span, p, div'))
        .filter(el => el.children.length === 0 && el !== targetElement);
        
      const priceEl = childTexts.find(el => /^[0-9,.]+(\s?)$/.test(el.textContent.trim().replace(/[^0-9.]/g, '')));
      const percentEl = childTexts.find(el => el.textContent.includes('%') || el.textContent.includes('+') || el.textContent.includes('-'));

      if (priceEl) {
        priceEl.textContent = parseFloat(price).toFixed(2);
      }
      if (percentEl) {
        percentEl.textContent = `${percentChange >= 0 ? '+' : ''}${parseFloat(percentChange).toFixed(2)}%`;
      }

      // Live color coding states
      if (percentChange > 1.5) {
        card.style.backgroundColor = '#065f46'; // deep green
      } else if (percentChange > 0) {
        card.style.backgroundColor = '#047857'; // light green
      } else if (percentChange < -1.5) {
        card.style.backgroundColor = '#991b1b'; // deep red
      } else if (percentChange < 0) {
        card.style.backgroundColor = '#b91c1c'; // light red
      } else {
        card.style.backgroundColor = '#374151'; // neutral gray
      }
      card.style.color = '#ffffff';
    }
  }
}

/**
 * 2. LIVE OPTION CHAIN ENGINE
 * Automatically maps live calls/puts to your option chain table rows.
 */
function updateOptionChainTableUI(calls, puts, underlyingPrice) {
  const tbody = document.querySelector('#option-chain-tbody') || document.querySelector('tbody');
  if (!tbody) return;

  const chainMap = {};
  calls.forEach(c => {
    chainMap[c.strike] = { strike: c.strike, call: c, put: null };
  });
  puts.forEach(p => {
    if (!chainMap[p.strike]) {
      chainMap[p.strike] = { strike: p.strike, call: null, put: p };
    } else {
      chainMap[p.strike].put = p;
    }
  });

  const sortedStrikes = Object.keys(chainMap).map(Number).sort((a, b) => a - b);
  // Show strikes within range of spot price
  const nearestStrikes = sortedStrikes.filter(strike => Math.abs(strike - underlyingPrice) < 400);

  tbody.innerHTML = '';

  nearestStrikes.forEach(strike => {
    const item = chainMap[strike];
    const c = item.call || { lastPrice: 0, volume: 0, openInterest: 0, change: 0 };
    const p = item.put || { lastPrice: 0, volume: 0, openInterest: 0, change: 0 };

    const tr = document.createElement('tr');
    tr.className = "border-b border-gray-800 text-sm hover:bg-gray-950";

    const isATM = Math.abs(strike - underlyingPrice) < 25;
    if (isATM) {
      tr.className += " bg-gray-900";
    }

    tr.innerHTML = `
      <td class="px-3 py-2 text-right text-gray-400">${c.openInterest || 0}</td>
      <td class="px-3 py-2 text-right ${c.change >= 0 ? 'text-green-500' : 'text-red-500'}">${c.change ? c.change.toFixed(1) : '0'}</td>
      <td class="px-3 py-2 text-right text-gray-400">${c.volume || 0}</td>
      <td class="px-3 py-2 text-right text-green-400 font-semibold">${c.lastPrice ? c.lastPrice.toFixed(2) : '0.00'}</td>
      <td class="px-3 py-2 text-center bg-gray-900 text-yellow-500 font-bold border-l border-r border-gray-800">${strike}</td>
      <td class="px-3 py-2 text-left text-green-400 font-semibold">${p.lastPrice ? p.lastPrice.toFixed(2) : '0.00'}</td>
      <td class="px-3 py-2 text-left text-gray-400">${p.volume || 0}</td>
      <td class="px-3 py-2 text-left ${p.change >= 0 ? 'text-green-500' : 'text-red-500'}">${p.change ? p.change.toFixed(1) : '0'}</td>
      <td class="px-3 py-2 text-left text-gray-400">${p.openInterest || 0}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 3. REAL-TIME PCR CALCULATOR
 * Analyzes open interest (OI) to calculate Put-Call-Ratio
 */
function calculatePCRandOI(calls, puts) {
  let totalCallOI = 0;
  let totalPutOI = 0;

  calls.forEach(c => totalCallOI += (c.openInterest || 0));
  puts.forEach(p => totalPutOI += (p.openInterest || 0));

  const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '1.00';

  const pcrElements = Array.from(document.querySelectorAll('*'))
    .filter(el => el.textContent.trim().toUpperCase().includes('PCR') && el.children.length === 0);

  pcrElements.forEach(el => {
    const parent = el.closest('div');
    if (parent) {
      const valueEl = Array.from(parent.querySelectorAll('span, p, div'))
        .find(child => !child.textContent.toUpperCase().includes('PCR') && /^[0-9.]+(\s?)$/.test(child.textContent.trim()));
      if (valueEl) {
        valueEl.textContent = pcr;
        if (pcr > 1.1) valueEl.style.color = '#10B981';
        else if (pcr < 0.9) valueEl.style.color = '#EF4444';
      }
    }
  });
}

/**
 * 4. REAL-TIME CORE INDICES & HEATMAP DATA INGESTION
 */
async function fetchLiveMarketData() {
  const symbols = '^NSEI,^NSEBANK,^INDIAVIX,' + Object.values(HEATMAP_SYMBOLS).join(',');
  const targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  // Safe CORS bypass proxy
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy connection failure');
    const wrapper = await response.json();
    const data = JSON.parse(wrapper.contents);
    const quotes = data?.quoteResponse?.result || [];

    quotes.forEach(quote => {
      const symbol = quote.symbol;
      
      if (symbol === '^NSEI') {
        marketData.nifty = { price: quote.regularMarketPrice, change: quote.regularMarketChange, percent: quote.regularMarketChangePercent };
      } else if (symbol === '^NSEBANK') {
        marketData.banknifty = { price: quote.regularMarketPrice, change: quote.regularMarketChange, percent: quote.regularMarketChangePercent };
      } else if (symbol === '^INDIAVIX') {
        marketData.vix = { price: quote.regularMarketPrice, change: quote.regularMarketChange, percent: quote.regularMarketChangePercent };
      }
      
      for (const [name, yahooSymbol] of Object.entries(HEATMAP_SYMBOLS)) {
        if (symbol === yahooSymbol) {
          updateHeatmapUI(name, quote.regularMarketPrice, quote.regularMarketChangePercent);
        }
      }
    });

    renderAllIndices();
  } catch (error) {
    console.warn("Live API fetch failed. Using index simulation backup:", error);
    useDataSimulation();
  }
}

/**
 * 5. REAL-TIME OPTION CHAIN DATA INGESTION
 */
async function fetchLiveOptionChain(symbol = '^NSEI') {
  const targetUrl = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy connection failure');
    const wrapper = await response.json();
    const data = JSON.parse(wrapper.contents);
    
    const optionChain = data?.optionChain?.result?.[0];
    if (!optionChain) return;

    const strikes = optionChain.options?.[0] || {};
    const calls = strikes.calls || [];
    const puts = strikes.puts || [];
    const underlyingPrice = optionChain.quote?.regularMarketPrice || marketData.nifty.price;

    updateOptionChainTableUI(calls, puts, underlyingPrice);
    calculatePCRandOI(calls, puts);

  } catch (error) {
    console.error("Failed to fetch live option chain:", error);
  }
}

function updateIndexUI(label, price, change, percent) {
  const formattedPrice = parseFloat(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedPercent = `${change >= 0 ? '+' : ''}${parseFloat(percent).toFixed(2)}%`;
  
  const priceId = `${label.toLowerCase()}-price`;
  const changeId = `${label.toLowerCase()}-change`;
  
  const priceEl = document.getElementById(priceId);
  const changeEl = document.getElementById(changeId);
  
  if (priceEl && changeEl) {
    priceEl.textContent = formattedPrice;
    changeEl.textContent = formattedPercent;
    changeEl.className = change >= 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold";
    return;
  }

  const allElements = Array.from(document.querySelectorAll('*'));
  const headerElement = allElements.find(el => 
    el.textContent.trim().toUpperCase() === label.toUpperCase() && el.children.length === 0
  );
  
  if (headerElement) {
    const cardContainer = headerElement.closest('div');
    if (cardContainer) {
      const childTexts = Array.from(cardContainer.querySelectorAll('span, p, div'))
        .filter(el => el.children.length === 0);
      
      const priceTextEl = childTexts.find(el => /^[0-9,.]+(\s?)$/.test(el.textContent.trim().replace(/[^0-9.]/g, '')));
      const changeTextEl = childTexts.find(el => el.textContent.includes('%') || el.textContent.includes('+') || el.textContent.includes('-'));

      if (priceTextEl) priceTextEl.textContent = formattedPrice;
      if (changeTextEl) {
        changeTextEl.textContent = formattedPercent;
        changeTextEl.style.color = change >= 0 ? '#10B981' : '#EF4444';
      }
    }
  }
}

function useDataSimulation() {
  const applyRandomTick = (item) => {
    const changeFactor = (Math.random() - 0.5) * 1.5;
    item.price += changeFactor;
    item.change += changeFactor;
    item.percent = (item.change / (item.price - item.change)) * 100;
  };
  applyRandomTick(marketData.nifty);
  applyRandomTick(marketData.banknifty);
  
  const vixMove = (Math.random() - 0.5) * 0.05;
  marketData.vix.price = Math.max(8, marketData.vix.price + vixMove);
  marketData.vix.percent = (vixMove / marketData.vix.price) * 100;

  renderAllIndices();
}

function renderAllIndices() {
  updateIndexUI('NIFTY', marketData.nifty.price, marketData.nifty.change, marketData.nifty.percent);
  updateIndexUI('BANKNIFTY', marketData.banknifty.price, marketData.banknifty.change, marketData.banknifty.percent);
  updateIndexUI('VIX', marketData.vix.price, marketData.vix.change, marketData.vix.percent);
}

function initMarketStream() {
  renderAllIndices();
  fetchLiveMarketData();
  fetchLiveOptionChain('^NSEI');
  
  setInterval(fetchLiveMarketData, CONFIG.updateIntervalMs);
  setInterval(() => fetchLiveOptionChain('^NSEI'), CONFIG.updateIntervalMs * 2);
}

window.MarketStream = {
  init: initMarketStream,
  getLatest: () => marketData
};
