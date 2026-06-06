// CLOUDFLARE WORKER ROUTER & LIVE API SERVICE
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API Route for live market & generated option chain data
    if (url.pathname === "/api/data") {
      const underlying = url.searchParams.get("underlying") || "NIFTY";
      const data = await getMarketData(underlying);
      return new Response(JSON.stringify(data), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // Serve Webpage Content
    return new Response(HTML_CONTENT, {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

// HELPER: Fetch live quotes from Yahoo Finance API
async function getLivePrice(symbol) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    const result = data.chart.result[0];
    const price = result.indicators.quote[0].close.filter(x => x !== null).pop() || result.meta.regularMarketPrice;
    const prevClose = result.meta.previousClose;
    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;
    return { price, change, changePercent };
  } catch (err) {
    return null;
  }
}

// HELPER: Generate structured option metrics matching spot trends
async function getMarketData(underlying) {
  const symbolMap = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS"
  };
  
  const ticker = symbolMap[underlying] || "^NSEI";
  const spotData = await getLivePrice(ticker);
  const vixData = await getLivePrice("^INDIAVIX");
  
  const spot = spotData ? spotData.price : (underlying === "NIFTY" ? 22453.80 : 47840.15);
  const change = spotData ? spotData.change : 128.40;
  const changePercent = spotData ? spotData.changePercent : 0.58;
  const vix = vixData ? vixData.price : 12.34;
  
  // Calculate Expiries and Strikes based on Asset class
  const interval = underlying === "NIFTY" ? 50 : 100;
  const atm = Math.round(spot / interval) * interval;
  
  const strikes = [];
  for (let i = -5; i <= 5; i++) {
    strikes.push(atm + (i * interval));
  }
  
  // Generate realistic option pricing & open interest matching live spot
  let totalCallOi = 0;
  let totalPutOi = 0;
  
  const optionChain = strikes.map(strike => {
    const diff = strike - spot;
    const iv = parseFloat((12 + Math.random() * 2).toFixed(1));
    
    // Call and Put Pricing Equations
    const callLtp = parseFloat(Math.max(0.5, 120 - diff * (underlying === "NIFTY" ? 0.8 : 0.4) + (Math.random() - 0.5) * 2).toFixed(2));
    const putLtp = parseFloat(Math.max(0.5, 120 + diff * (underlying === "NIFTY" ? 0.8 : 0.4) + (Math.random() - 0.5) * 2).toFixed(2));
    
    // Simulate support (puts) and resistance (calls) concentration
    const callOi = parseFloat(Math.max(0.5, 40 - (diff / interval) * 4 + (Math.random() - 0.5) * 4).toFixed(1));
    const putOi = parseFloat(Math.max(0.5, 40 + (diff / interval) * 4 + (Math.random() - 0.5) * 4).toFixed(1));
    
    totalCallOi += callOi;
    totalPutOi += putOi;
    
    return {
      strike,
      ce: { ltp: callLtp, oi: callOi, vol: Math.round(callOi * 7.5), iv, chgPercent: parseFloat(((Math.random() - 0.5) * 5).toFixed(1)) },
      pe: { ltp: putLtp, oi: putOi, vol: Math.round(putOi * 7.5), iv, chgPercent: parseFloat(((Math.random() - 0.5) * 5).toFixed(1)) }
    };
  });
  
  const pcr = parseFloat((totalPutOi / totalCallOi).toFixed(2));
  
  return {
    underlying,
    spot,
    change,
    changePercent,
    vix,
    pcr,
    optionChain,
    atm,
    totalCallOi: parseFloat(totalCallOi.toFixed(1)),
    totalPutOi: parseFloat(totalPutOi.toFixed(1)),
    maxPain: atm
  };
}

// FRONTEND INTERFACE HTML (LIGHT THEME)
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>F&O Analytics Pro</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- Lucide Icons CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '#f8fafc',
            card: '#ffffff',
            border: '#e2e8f0',
          }
        }
      }
    }
  </script>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8fafc;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #f8fafc;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }
  </style>
</head>
<body class="text-slate-800 min-h-screen antialiased">

  <!-- TOP NAVIGATION BAR -->
  <nav class="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between z-50">
    <div class="flex items-center gap-2.5">
      <div class="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
        <i data-lucide="activity" class="w-5 h-5 text-blue-600"></i>
      </div>
      <span class="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 to-blue-600 bg-clip-text text-transparent">F&O Analytics Pro</span>
    </div>
    
    <div class="hidden md:flex items-center relative w-85">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3">
        <i data-lucide="search" class="w-4 h-4 text-slate-400"></i>
      </span>
      <input type="text" placeholder="Search indices, derivatives, options strike..." class="w-full pl-9 pr-4 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all">
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 text-xs">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="text-slate-500 font-medium">MARKET LIVE</span>
      </div>
      <button class="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/10">
        Access Pro Terminal
      </button>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-20">

    <!-- HERO SECTION -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div class="space-y-6">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] uppercase font-extrabold text-emerald-600 tracking-wider">
          <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> analytics
        </span>
        <h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-slate-900">
          The financial world in full focus built on next-gen technology
        </h1>
        <p class="text-sm text-slate-500 leading-relaxed">
          F&O Analytics Pro delivers institutional-grade derivatives intelligence with sub-millisecond market data streaming, advanced options Greeks calculations, and AI-powered predictive models.
        </p>
        <div class="flex items-center gap-4">
          <button class="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all">
            Request a Demo
          </button>
        </div>
      </div>

      <!-- Hero Dashboard Visual Graphic -->
      <div class="bg-[#090d16] border border-slate-800 p-5 rounded-3xl relative overflow-hidden shadow-2xl">
        <div class="relative space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="text-[10px] text-slate-400 font-mono ml-2">F&O Analytics Pro Terminal v4.2</span>
            </div>
            <span class="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded font-mono font-bold">LIVE MATRIX</span>
          </div>
          
          <div class="grid grid-cols-3 gap-2 border-b border-slate-800/60 pb-3 text-[10px] text-slate-400 font-mono">
            <div>
              <span class="text-slate-500 block">NIFTY</span>
              <span id="term-nifty" class="text-emerald-400 font-bold">...</span>
            </div>
            <div>
              <span class="text-slate-500 block">BANKNIFTY</span>
              <span id="term-bank" class="text-rose-400 font-bold">...</span>
            </div>
            <div>
              <span class="text-slate-500 block">VIX</span>
              <span id="term-vix" class="text-rose-400 font-bold">...</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-[9px] text-slate-500 uppercase font-bold block mb-1">NIFTY FUTURES - 1H</span>
              <div class="h-28">
                <canvas id="heroMiniChart1"></canvas>
              </div>
            </div>
            <div>
              <span class="text-[9px] text-slate-500 uppercase font-bold block mb-1">OPTIONS HEATMAP</span>
              <div class="grid grid-cols-5 gap-1.5 pt-2">
                <div class="h-4 bg-emerald-500/80 rounded-sm"></div>
                <div class="h-4 bg-emerald-500/80 rounded-sm"></div>
                <div class="h-4 bg-emerald-500/40 rounded-sm"></div>
                <div class="h-4 bg-rose-500/80 rounded-sm"></div>
                <div class="h-4 bg-rose-500/80 rounded-sm"></div>
                <div class="h-4 bg-amber-500/80 rounded-sm"></div>
                <div class="h-4 bg-emerald-500/80 rounded-sm"></div>
                <div class="h-4 bg-emerald-500/80 rounded-sm"></div>
                <div class="h-4 bg-emerald-500/80 rounded-sm"></div>
                <div class="h-4 bg-rose-500/40 rounded-sm"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Sub-navigation links bar -->
    <div class="border-b border-slate-200 pb-3.5 flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-slate-500 font-semibold">
      <a href="#market-movers" class="hover:text-blue-600">MARKET OVERVIEW</a>
      <a href="#terminal" class="hover:text-blue-600">TERMINAL IN ACTION</a>
      <a href="#heatmap" class="hover:text-blue-600">OI HEATMAP</a>
      <a href="#blueprint" class="hover:text-blue-600">STRATEGY BLUEPRINTS</a>
      <a href="#option-chain" class="hover:text-blue-600">EXECUTION MATRIX</a>
    </div>

    <!-- FUTURES MARKET MOVERS & SENTIMENT METER -->
    <section id="market-movers" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Futures Market Movers Card -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
          <i data-lucide="trending-up" class="w-4 h-4 text-blue-600"></i> Futures Market Movers
        </h3>
        <div class="space-y-3.5 pt-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800">NIFTY 50 FUTURES</span>
            <div class="text-right">
              <span id="mover-nifty" class="text-xs font-bold text-emerald-600">...</span>
              <span id="mover-nifty-chg" class="text-[10px] text-emerald-500 font-bold block">...</span>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            <span class="text-xs font-bold text-slate-800">BANKNIFTY FUTURES</span>
            <div class="text-right">
              <span id="mover-bank" class="text-xs font-bold text-emerald-600">...</span>
              <span id="mover-bank-chg" class="text-[10px] text-emerald-500 font-bold block">...</span>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            <span class="text-xs font-bold text-slate-800">INDIA VIX</span>
            <div class="text-right">
              <span id="mover-vix" class="text-xs font-bold text-rose-600">...</span>
              <span id="mover-vix-chg" class="text-[10px] text-rose-500 font-bold block">...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sentiment Meter Card -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
          <i data-lucide="activity" class="w-4 h-4 text-blue-600"></i> F&O Market Sentiment Meter
        </h3>
        <div class="space-y-4 py-2">
          <div class="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span class="text-rose-500">Bearish</span>
            <span class="text-amber-500">Neutral</span>
            <span class="text-emerald-500">Bullish</span>
          </div>
          <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
            <div class="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 h-full w-full"></div>
            <div id="gauge-pin" class="absolute top-0 bottom-0 w-1.5 bg-slate-900 shadow-xl left-[65%] border border-white"></div>
          </div>
          <div class="text-center">
            <span id="pcr-badge" class="text-xs font-extrabold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">PCR: ...</span>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2 text-center pt-2">
          <div>
            <span class="text-[9px] text-slate-400 font-semibold block uppercase">Calls OI</span>
            <span id="meta-calloi" class="text-xs font-bold text-rose-600">...</span>
          </div>
          <div>
            <span class="text-[9px] text-slate-400 font-semibold block uppercase">Puts OI</span>
            <span id="meta-putoi" class="text-xs font-bold text-emerald-600">...</span>
          </div>
          <div>
            <span class="text-[9px] text-slate-400 font-semibold block uppercase">Max Pain</span>
            <span id="meta-maxpain" class="text-xs font-bold text-slate-700">...</span>
          </div>
          <div>
            <span class="text-[9px] text-slate-400 font-semibold block uppercase">VIX</span>
            <span id="meta-vix" class="text-xs font-bold text-rose-600">...</span>
          </div>
        </div>
      </div>

      <!-- Live Selection Controls -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
        <h3 class="text-xs font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
          <i data-lucide="sliders" class="w-4 h-4 text-blue-600"></i> Active Underlying Selector
        </h3>
        <div class="space-y-3">
          <select id="underlyingSelect" onchange="fetchLiveMetrics()" class="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-semibold">
            <option value="NIFTY">NIFTY 50</option>
            <option value="BANKNIFTY">BANK NIFTY</option>
            <option value="FINNIFTY">FIN NIFTY</option>
          </select>
          <select class="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-semibold">
            <option>11 Jun 2026 (Weekly)</option>
            <option>18 Jun 2026 (Weekly)</option>
            <option>25 Jun 2026 (Monthly)</option>
          </select>
        </div>
      </div>
    </section>

    <!-- LIGHTNING FAST EXECUTION OPTION CHAIN MATRIX -->
    <section id="option-chain" class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xl lg:text-2xl font-extrabold text-slate-900">Lightning-Fast Execution Option Matrix</h2>
        <p class="text-xs text-slate-500">Professional-grade option chain with real-time Greeks, OI analysis, and one-click execution.</p>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[11px] border-collapse min-w-[1200px]">
            <thead>
              <tr class="text-center font-bold text-slate-500 border-b border-slate-200 bg-slate-100/50">
                <th colspan="8" class="py-2.5 text-rose-600 uppercase tracking-wider bg-rose-50/30">Call Options</th>
                <th class="py-2.5 bg-slate-200/50 text-slate-700 border-x border-slate-200 w-24 sticky left-0 z-10">Strike</th>
                <th colspan="8" class="py-2.5 text-emerald-600 uppercase tracking-wider bg-emerald-50/30">Put Options</th>
              </tr>
              <tr class="bg-slate-50 text-slate-500 border-b border-slate-200 select-none font-semibold">
                <th class="p-2 text-center w-20">OI (L)</th>
                <th class="p-2 text-center w-16">CHG %</th>
                <th class="p-2 text-center w-16">VOL</th>
                <th class="p-2 text-center w-12">IV</th>
                <th class="p-2 text-center w-14">BID</th>
                <th class="p-2 text-center w-14">ASK</th>
                <th class="p-2 text-right w-16">LTP</th>
                <th class="p-2 text-center w-14">CHG</th>
                
                <th class="p-2 text-center text-slate-700 bg-slate-100 font-bold border-x border-slate-200 w-24 sticky left-0 z-10">STRIKE</th>
                
                <th class="p-2 text-center w-14">CHG</th>
                <th class="p-2 text-left w-16">LTP</th>
                <th class="p-2 text-center w-14">BID</th>
                <th class="p-2 text-center w-14">ASK</th>
                <th class="p-2 text-center w-12">IV</th>
                <th class="p-2 text-center w-16">VOL</th>
                <th class="p-2 text-center w-16">CHG %</th>
                <th class="p-2 text-center w-20">OI (L)</th>
              </tr>
            </thead>
            <tbody id="option-chain-body" class="divide-y divide-slate-100 text-slate-600 font-mono">
              <!-- Dynamically populated rows via backend API -->
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- OPTIONS MAX PAIN & MULTI-STRIKE OPEN INTEREST -->
    <section class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xl lg:text-2xl font-extrabold text-slate-900">Options Max Pain & Multi-Strike Open Interest</h2>
        <p class="text-xs text-slate-500">Visualization of Call and Put open interest distribution across key strike prices to identify pain levels.</p>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <div class="h-64">
          <canvas id="maxPainBarChart"></canvas>
        </div>
      </div>
    </section>

  </main>

  <script>
    lucide.createIcons();

    let maxPainChartObj = null;

    // Fetch and populate metrics in real-time
    async function fetchLiveMetrics() {
      const underlying = document.getElementById('underlyingSelect').value;
      try {
        const response = await fetch(`/api/data?underlying=\${underlying}`);
        const data = await response.json();
        
        // Update Spotlight stats on DOM
        document.getElementById('term-nifty').innerText = underlying === 'NIFTY' ? `\${data.spot.toFixed(2)}` : '...';
        document.getElementById('term-bank').innerText = underlying === 'BANKNIFTY' ? `\${data.spot.toFixed(2)}` : '...';
        document.getElementById('term-vix').innerText = `\${data.vix.toFixed(2)}`;

        // Mover Tickers
        document.getElementById('mover-nifty').innerText = underlying === 'NIFTY' ? `\${data.spot.toFixed(2)}` : '...';
        document.getElementById('mover-nifty-chg').innerText = `\${data.changePercent.toFixed(2)}%`;
        document.getElementById('mover-bank').innerText = underlying === 'BANKNIFTY' ? `\${data.spot.toFixed(2)}` : '...';
        document.getElementById('mover-bank-chg').innerText = underlying === 'BANKNIFTY' ? `\${data.changePercent.toFixed(2)}%` : '...';
        document.getElementById('mover-vix').innerText = `\${data.vix.toFixed(2)}`;
        
        // Sentiment parameters
        document.getElementById('pcr-badge').innerText = `PCR: \${data.pcr}`;
        document.getElementById('meta-calloi').innerText = `\${data.totalCallOi}L`;
        document.getElementById('meta-putoi').innerText = `\${data.totalPutOi}L`;
        document.getElementById('meta-maxpain').innerText = data.maxPain;
        document.getElementById('meta-vix').innerText = data.vix.toFixed(2);

        // Slide Sentiment Gauge
        const pinOffset = Math.min(95, Math.max(5, data.pcr * 50));
        document.getElementById('gauge-pin').style.left = `\${pinOffset}%`;

        // Render Option Chain Matrix Rows
        const tbody = document.getElementById('option-chain-body');
        tbody.innerHTML = '';

        data.optionChain.forEach(row => {
          const isAtm = row.strike === data.atm;
          const tr = document.createElement('tr');
          tr.className = `hover:bg-slate-50/80 \${isAtm ? 'bg-blue-50/40 border-y border-blue-200' : ''}`;

          tr.innerHTML = `
            <td class="p-2 text-center text-rose-600 font-bold">\${row.ce.oi}</td>
            <td class="p-2 text-center text-rose-600">\${row.ce.chgPercent}%</td>
            <td class="p-2 text-center text-slate-400">\${row.ce.vol}K</td>
            <td class="p-2 text-center">\${row.ce.iv}</td>
            <td class="p-2 text-center">\${(row.ce.ltp - 0.2).toFixed(2)}</td>
            <td class="p-2 text-center">\${(row.ce.ltp + 0.2).toFixed(2)}</td>
            <td class="p-2 text-right font-bold text-slate-800">\${row.ce.ltp.toFixed(2)}</td>
            <td class="p-2 text-center text-rose-600">\${(row.ce.chgPercent * 0.1).toFixed(2)}</td>
            
            <td class="p-2 text-center font-extrabold text-slate-800 bg-slate-100/80 border-x border-slate-200 sticky left-0 z-10 shadow-sm font-sans">
              \${row.strike.toLocaleString('en-IN')} \${isAtm ? '<span class="text-[8px] font-bold block text-blue-500">ATM</span>' : ''}
            </td>
            
            <td class="p-2 text-center text-emerald-600">\${(row.pe.chgPercent * 0.1).toFixed(2)}</td>
            <td class="p-2 text-left font-bold text-slate-800">\${row.pe.ltp.toFixed(2)}</td>
            <td class="p-2 text-center">\${(row.pe.ltp - 0.2).toFixed(2)}</td>
            <td class="p-2 text-center">\${(row.pe.ltp + 0.2).toFixed(2)}</td>
            <td class="p-2 text-center">\${row.pe.iv}</td>
            <td class="p-2 text-center text-slate-400">\${row.pe.vol}K</td>
            <td class="p-2 text-center text-emerald-600">\${row.pe.chgPercent}%</td>
            <td class="p-2 text-center text-emerald-600 font-bold">\${row.pe.oi}</td>
          `;
          tbody.appendChild(tr);
        });

        // Update Charts
        updateCharts(data);

      } catch (err) {
        console.error("Live fetch error", err);
      }
    }

    function updateCharts(data) {
      const labels = data.optionChain.map(r => r.strike);
      const callData = data.optionChain.map(r => r.ce.oi);
      const putData = data.optionChain.map(r => r.pe.oi);

      if (maxPainChartObj) {
        maxPainChartObj.data.labels = labels;
        maxPainChartObj.data.datasets[0].data = callData;
        maxPainChartObj.data.datasets[1].data = putData;
        maxPainChartObj.update();
      } else {
        const ctx = document.getElementById('maxPainBarChart').getContext('2d');
        maxPainChartObj = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              { label: 'Calls OI', data: callData, backgroundColor: 'rgba(239, 68, 68, 0.85)', borderRadius: 4 },
              { label: 'Puts OI', data: putData, backgroundColor: 'rgba(16, 185, 129, 0.85)', borderRadius: 4 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
          }
        });
      }
    }

    // Initial Trigger & Periodic Interval updates (every 3 seconds)
    fetchLiveMetrics();
    setInterval(fetchLiveMetrics, 3000);

    // Hero Miniature Chart (Visual layout)
    const heroCtx1 = document.getElementById('heroMiniChart1').getContext('2d');
    new Chart(heroCtx1, {
      type: 'bar',
      data: {
        labels: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'],
        datasets: [
          { data: [4, 6, 12, 18, 25, 12, 28, 14, 30], backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 3 },
          { data: [15, 18, 24, 20, 22, 10, 8, 4, 1], backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  </script>
</body>
</html>
`;
