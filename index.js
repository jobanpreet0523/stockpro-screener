// live-data.js - StockPro Terminal State Engine & Derivatives Calculator

const CONFIG = {
  updateIntervalMs: 6000 // Refresh live data every 6 seconds
};

// Global application state
window.terminalState = {
  activeUnderlying: "NIFTY", // NIFTY or BANKNIFTY
  activeOutlook: "BULLISH",  // BULLISH, BEARISH, VOLATILITY, or SIDEWAYS
  spotPrice: 24892.50,
  payoffChart: null
};

// Options Strategy mathematical algorithms
const STRATEGIES = {
  BULLISH: {
    name: "Bull Call Spread",
    desc: "Buy ATM Call, Sell OTM Call. Limits risk while maximizing returns on moderate upside.",
    calc: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const otm = atm + strikeWidth;
      const atmPrem = spot * 0.125 * 0.05;
      const otmPrem = spot * 0.125 * 0.02;
      const netDebit = atmPrem - otmPrem;
      
      const maxLoss = Math.round(netDebit * 75);
      const maxProfit = Math.round((strikeWidth - netDebit) * 75);
      const breakeven = atm + netDebit;
      return { name: "Bull Call Spread", desc: `Buy ATM Call (${atm}), Sell OTM Call (${otm})`, maxProfit: `₹${maxProfit.toLocaleString('en-IN')}`, maxLoss: `₹${maxLoss.toLocaleString('en-IN')}`, winProb: 62, breakeven: Math.round(breakeven) };
    },
    generatePLPoints: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const atmPrem = spot * 0.125 * 0.05;
      const otmPrem = spot * 0.125 * 0.02;
      const netDebit = atmPrem - otmPrem;
      
      const range = [];
      const pl = [];
      for (let i = -4; i <= 4; i++) {
        const xPrice = atm + (i * (strikeWidth / 2));
        range.push(xPrice.toString());
        // P&L calculation at expiry
        let profit = Math.max(0, xPrice - atm) - Math.max(0, xPrice - (atm + strikeWidth)) - netDebit;
        pl.push(Math.round(profit * 75));
      }
      return { range, pl };
    }
  },
  BEARISH: {
    name: "Bear Put Spread",
    desc: "Buy ATM Put, Sell OTM Put. Restricts risk while optimizing returns on moderate downside.",
    calc: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const otm = atm - strikeWidth;
      const atmPrem = spot * 0.125 * 0.052;
      const otmPrem = spot * 0.125 * 0.021;
      const netDebit = atmPrem - otmPrem;
      
      const maxLoss = Math.round(netDebit * 75);
      const maxProfit = Math.round((strikeWidth - netDebit) * 75);
      const breakeven = atm - netDebit;
      return { name: "Bear Put Spread", desc: `Buy ATM Put (${atm}), Sell OTM Put (${otm})`, maxProfit: `₹${maxProfit.toLocaleString('en-IN')}`, maxLoss: `₹${maxLoss.toLocaleString('en-IN')}`, winProb: 58, breakeven: Math.round(breakeven) };
    },
    generatePLPoints: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const atmPrem = spot * 0.125 * 0.052;
      const otmPrem = spot * 0.125 * 0.021;
      const netDebit = atmPrem - otmPrem;
      
      const range = [];
      const pl = [];
      for (let i = -4; i <= 4; i++) {
        const xPrice = atm + (i * (strikeWidth / 2));
        range.push(xPrice.toString());
        let profit = Math.max(0, atm - xPrice) - Math.max(0, (atm - strikeWidth) - xPrice) - netDebit;
        pl.push(Math.round(profit * 75));
      }
      return { range, pl };
    }
  },
  VOLATILITY: {
    name: "Long Straddle",
    desc: "Buy ATM Call and ATM Put. Captures unlimited upside on sharp breakouts in either direction.",
    calc: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const callPrem = spot * 0.125 * 0.05;
      const putPrem = spot * 0.125 * 0.052;
      const totalCost = callPrem + putPrem;
      
      const maxLoss = Math.round(totalCost * 75);
      return { name: "Long Straddle", desc: `Buy ATM Call & Put (${atm})`, maxProfit: "Unlimited", maxLoss: `₹${maxLoss.toLocaleString('en-IN')}`, winProb: 44, breakeven: Math.round(atm + totalCost) };
    },
    generatePLPoints: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const callPrem = spot * 0.125 * 0.05;
      const putPrem = spot * 0.125 * 0.052;
      const totalCost = callPrem + putPrem;
      
      const range = [];
      const pl = [];
      for (let i = -4; i <= 4; i++) {
        const xPrice = atm + (i * (strikeWidth / 2));
        range.push(xPrice.toString());
        let profit = Math.max(0, xPrice - atm) + Math.max(0, atm - xPrice) - totalCost;
        pl.push(Math.round(profit * 75));
      }
      return { range, pl };
    }
  },
  SIDEWAYS: {
    name: "Iron Condor",
    desc: "Sell OTM Put/Call, Buy OTM Protection. Ideal for collecting premiums in consolidations.",
    calc: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const spread = strikeWidth;
      const credit = spot * 0.125 * 0.04;
      const maxLoss = Math.round((spread - credit) * 75);
      
      return { name: "Iron Condor", desc: `OTM Wing Spreads centered around ${atm}`, maxProfit: `₹${Math.round(credit * 75).toLocaleString('en-IN')}`, maxLoss: `₹${maxLoss.toLocaleString('en-IN')}`, winProb: 72, breakeven: atm + spread };
    },
    generatePLPoints: (spot) => {
      const strikeWidth = window.terminalState.activeUnderlying === "BANKNIFTY" ? 200 : 100;
      const atm = Math.round(spot / (strikeWidth / 2)) * (strikeWidth / 2);
      const credit = spot * 0.125 * 0.04;
      
      const range = [];
      const pl = [];
      for (let i = -4; i <= 4; i++) {
        const xPrice = atm + (i * (strikeWidth / 2));
        range.push(xPrice.toString());
        let profit = credit;
        if (xPrice > atm + strikeWidth) {
          profit = credit - (xPrice - (atm + strikeWidth));
        } else if (xPrice < atm - strikeWidth) {
          profit = credit - ((atm - strikeWidth) - xPrice);
        }
        pl.push(Math.round(Math.max(credit - strikeWidth, profit) * 75));
      }
      return { range, pl };
    }
  }
};

/**
 * Main application coordinator
 */
async function syncGlobalTerminalWorkspace() {
  const symbol = window.terminalState.activeUnderlying;
  
  try {
    const res = await fetch(`/api/data?underlying=${symbol}`);
    const data = await res.json();
    if (data && !data.error) {
      window.terminalState.spotPrice = data.spotPrice;
      
      // 1. Update spot rates
      updateSpotRatesUI(data);

      // 2. Render Option Chain near spot
      renderOptionChainMatrix(data.options, data.spotPrice);

      // 3. Recalculate and redraw Payoff Chart
      rebuildBlueprintAndChart();
    }
  } catch (error) {
    console.error("Live Workspace sync error:", error);
  }
}

function updateSpotRatesUI(data) {
  const formattedPrice = data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedChange = `${data.pcr >= 1 ? '+' : '-'}${data.pcr}%`;
  
  if (data.underlying === "NIFTY") {
    const el = document.getElementById('nifty-price');
    if (el) el.textContent = formattedPrice;
  } else if (data.underlying === "BANKNIFTY") {
    const el = document.getElementById('banknifty-price');
    if (el) el.textContent = formattedPrice;
  }
}

/**
 * Builds the live execution matrix around active spot strike prices
 */
function renderOptionChainMatrix(options, spot) {
  const tbody = document.getElementById('option-chain-tbody') || document.querySelector('table tbody');
  if (!tbody) return;

  // Clear static notebook rows
  tbody.innerHTML = '';

  // Show the 7 strikes nearest to spot price
  const nearest = options.filter(opt => Math.abs(opt.strike - spot) < 250).slice(0, 7);

  nearest.forEach(opt => {
    const isATM = Math.abs(opt.strike - spot) < 30;
    const tr = document.createElement('tr');
    tr.className = `border-b border-gray-900 text-sm hover:bg-gray-900/60 transition ${isATM ? 'bg-blue-500/10' : ''}`;

    tr.innerHTML = `
      <td class="px-6 py-3 text-right text-red-400 font-mono">${(opt.ce.oi / 100000).toFixed(1)}L</td>
      <td class="px-6 py-3 text-right font-mono">${opt.ce.ltp.toFixed(2)}</td>
      <td class="px-6 py-3 text-center bg-gray-900/40 font-bold text-yellow-500 border-l border-r border-gray-800 font-mono">${opt.strike}</td>
      <td class="px-6 py-3 text-left font-mono">${opt.pe.ltp.toFixed(2)}</td>
      <td class="px-6 py-3 text-left text-green-400 font-mono">${(opt.pe.oi / 100000).toFixed(1)}L</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Recalculates risk parameters and redraws the payoff Chart
 */
function rebuildBlueprintAndChart() {
  const outlook = window.terminalState.activeOutlook;
  const spot = window.terminalState.spotPrice;
  const strategy = STRATEGIES[outlook];
  
  if (!strategy) return;
  const model = strategy.calc(spot);

  // Update strategy details in HTML dynamically
  updateStrategyHTML(model);

  // Rebuild the payoff chart canvas dynamically
  const payload = strategy.generatePLPoints(spot);
  renderPayoffChart(payload.range, payload.pl);
}

function updateStrategyHTML(model) {
  // Safe selector search
  const blueprintSec = document.getElementById('blueprint');
  if (!blueprintSec) return;

  const titleEl = blueprintSec.querySelector('h3');
  const descEl = blueprintSec.querySelector('p');
  
  if (titleEl) titleEl.textContent = model.name;
  if (descEl) descEl.textContent = model.desc;

  // Search details grid
  const childTexts = Array.from(blueprintSec.querySelectorAll('div'));
  
  const profitEl = childTexts.find(el => el.textContent.includes('Max Profit') || el.id === 'max-profit-val');
  const lossEl = childTexts.find(el => el.textContent.includes('Max Loss') || el.id === 'max-loss-val');
  const bvenEl = childTexts.find(el => el.textContent.includes('Breakeven') || el.id === 'breakeven-val');
  const winEl = childTexts.find(el => el.textContent.includes('Win Probability') || el.id === 'win-val');

  if (profitEl) {
    const val = profitEl.querySelector('div') || profitEl;
    if (val) val.textContent = model.maxProfit;
  }
  if (lossEl) {
    const val = lossEl.querySelector('div') || lossEl;
    if (val) val.textContent = model.maxLoss;
  }
  if (bvenEl) {
    const val = bvenEl.querySelector('div') || bvenEl;
    if (val) val.textContent = model.breakeven.toLocaleString('en-IN');
  }
  if (winEl) {
    const val = winEl.querySelector('div') || winEl;
    if (val) val.textContent = `${model.winProb}%`;
  }
}

function renderPayoffChart(labels, dataset) {
  const ctx = document.getElementById('payoff-chart');
  if (!ctx) return;

  if (window.terminalState.payoffChart) {
    window.terminalState.payoffChart.destroy(); // Clear old instance
  }

  window.terminalState.payoffChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expiry P&L (INR)',
        data: dataset,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(148, 163, 184, 0.08)' } }
      }
    }
  });
}

function setupInteractiveBinds() {
  // 1. Outlook strategy buttons click handling
  const blueprintSec = document.getElementById('blueprint');
  if (blueprintSec) {
    const buttons = blueprintSec.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle selected styling
        buttons.forEach(b => {
          b.className = "bg-gray-900 border border-gray-800 text-gray-400 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-800 transition";
        });
        btn.className = "bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg text-xs font-semibold";
        
        // Update active state and recalculate
        const text = btn.textContent.trim().toUpperCase();
        if (text === "BULLISH") window.terminalState.activeOutlook = "BULLISH";
        if (text === "BEARISH") window.terminalState.activeOutlook = "BEARISH";
        if (text === "HIGH VOLATILITY") window.terminalState.activeOutlook = "VOLATILITY";
        if (text === "SIDEWAYS") window.terminalState.activeOutlook = "SIDEWAYS";

        rebuildBlueprintAndChart();
      });
    });
  }

  // 2. Navigation click binding (click index card to switch tables)
  const niftyCard = document.getElementById('nifty-price')?.closest('div');
  const bankniftyCard = document.getElementById('banknifty-price')?.closest('div');

  if (niftyCard) {
    niftyCard.style.cursor = "pointer";
    niftyCard.addEventListener('click', () => {
      window.terminalState.activeUnderlying = "NIFTY";
      syncGlobalTerminalWorkspace();
    });
  }
  if (bankniftyCard) {
    bankniftyCard.style.cursor = "pointer";
    bankniftyCard.addEventListener('click', () => {
      window.terminalState.activeUnderlying = "BANKNIFTY";
      syncGlobalTerminalWorkspace();
    });
  }
}

// Start Stream
function init() {
  setupInteractiveBinds();
  syncGlobalTerminalWorkspace();
  setInterval(syncGlobalTerminalWorkspace, CONFIG.updateIntervalMs);
}

window.MarketStream = {
  init
};
