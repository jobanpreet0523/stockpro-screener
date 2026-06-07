// index.js - StockPro Terminal Command Interpreter

(function() {
  console.log("StockPro Bloomberg Terminal Command Layer Online.");

  let activeTicker = "RELIANCE.NS";
  let refreshController = null;
  let isDaemonRefreshing = false;

  // Terminal commands map
  const COMMANDS = {
    "DES": "Description / Equity Fundamentals",
    "OMN": "Options Monitor / Derivatives",
    "PORT": "Algorithmic Portfolio Viewer",
    "HELP": "Terminal Help Directory"
  };

  /**
   * Parses terminal commands (e.g. "TCS DES <GO>", "NIFTY OMN <GO>", "PORT <GO>")
   */
  function parseTerminalCommand(inputString) {
    let clean = inputString.trim().toUpperCase();
    
    // Check for help command
    if (clean === "HELP" || clean === "HELP <GO>" || clean === "HELP GO") {
      return { command: "HELP", symbol: null };
    }
    
    // Check for portfolio command
    if (clean === "PORT" || clean === "PORT <GO>" || clean === "PORT GO") {
      return { command: "PORT", symbol: null };
    }

    // Strip out "<GO>" or "GO" strings
    clean = clean.replace(/<GO>/g, "").replace(/GO/g, "").trim();

    const parts = clean.split(/\s+/);
    if (parts.length === 1) {
      // Default to Description if only symbol entered
      return { command: "DES", symbol: parts[0] };
    }

    const symbol = parts[0];
    const cmd = parts[1];

    if (COMMANDS[cmd]) {
      return { command: cmd, symbol: symbol };
    }

    return { command: "DES", symbol: symbol };
  }

  function cleanAndNormalizeTicker(symbol) {
    if (!symbol) return "";
    let clean = symbol.trim().toUpperCase();
    if (!clean.endsWith('.NS') && !clean.includes('^')) {
      clean += '.NS';
    }
    return clean;
  }

  function getActiveTickerInput() {
    const inputEl = document.querySelector('#tickerInput');
    if (inputEl && inputEl.value.trim()) {
      const parsed = parseTerminalCommand(inputEl.value);
      if (parsed.symbol) {
        return cleanAndNormalizeTicker(parsed.symbol);
      }
    }
    return activeTicker;
  }

  /**
   * Executes Bloomberg-style terminal commands
   */
  async function executeTerminalSearch() {
    const inputEl = document.querySelector('#tickerInput');
    if (!inputEl) return;

    const query = inputEl.value.trim();
    if (!query) return;

    const parsed = parseTerminalCommand(query);
    showTerminalLoadingState();

    if (parsed.command === "HELP") {
      showHelpOverlay();
      return;
    }

    if (parsed.command === "PORT") {
      await fetchAlgorithmicPortfolios();
      return;
    }

    if (parsed.command === "OMN") {
      let indexName = parsed.symbol || "NIFTY";
      if (indexName === "NIFTY.NS") indexName = "NIFTY";
      if (indexName === "BANKNIFTY.NS") indexName = "BANKNIFTY";
      await fetchDerivativesOptionChain(indexName);
      return;
    }

    if (parsed.command === "DES") {
      const symbol = cleanAndNormalizeTicker(parsed.symbol);
      await fetchEquityFundamentals(symbol);
    }
  }

  // --- CORE TELEMETRY OPERATIONS ---

  async function fetchEquityFundamentals(symbol) {
    try {
      const res = await fetch(`/api/pro-data?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data && !data.error) {
        updateFundamentalsUI(data);
        // Switch view to Fundamentals layout if tabs exist
        activateTab('fundamentals-tab');
      }
    } catch (e) {
      console.error("Terminal failed to fetch Equity description:", e);
    }
  }

  async function fetchDerivativesOptionChain(underlying) {
    try {
      const res = await fetch(`/api/data?underlying=${encodeURIComponent(underlying)}`);
      const data = await res.json();
      if (data && !data.error) {
        // Render spot values and option matrix
        if (window.MarketStream) {
          window.MarketStream.init(); // Update indices fallback
        }
        activateTab('derivatives-tab');
      }
    } catch (e) {
      console.error("Terminal failed to fetch Option Monitor data:", e);
    }
  }

  async function fetchAlgorithmicPortfolios() {
    try {
      const res = await fetch('/api/propicks');
      const data = await res.json();
      if (data && data.portfolios) {
        renderPortfoliosUI(data.portfolios);
        activateTab('portfolios-tab');
      }
    } catch (e) {
      console.error("Terminal failed to fetch Portfolio assets:", e);
    }
  }

  // --- INTERFACE RENDERING ENGINE ---

  function showTerminalLoadingState() {
    const healthVal = document.querySelector('#health-score-val') || document.querySelector('#health-score');
    if (healthVal) {
      healthVal.innerHTML = "<span class='animate-pulse text-yellow-500'>SYS LOAD...</span>";
    }
  }

  function updateFundamentalsUI(data) {
    if (!data || data.error) return;
    activeTicker = data.symbol;

    // Company Headers
    const titleElements = Array.from(document.querySelectorAll('h1, h2, h3, p')).filter(el => 
      el.id === 'company-name' || el.textContent.includes("Reliance") || el.textContent.includes("TCS") || el.textContent.includes("Infosys")
    );
    titleElements.forEach(el => {
      if (el.children.length === 0 || el.id === 'company-name') {
        el.textContent = data.companyName + " [" + data.symbol + "]";
      }
    });

    // Asset Spot Pricing
    const priceElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.id === 'current-price' || (el.children.length === 0 && el.textContent.trim().startsWith('₹'))
    );
    priceElements.forEach(el => {
      el.textContent = "₹" + parseFloat(data.price).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    });

    // Fair Value
    const fairValueEl = document.querySelector('#fair-value') || Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Fair Value') || el.id === 'fair-val-container');
    if (fairValueEl) {
      const targetSpan = fairValueEl.querySelector('span, p') || fairValueEl;
      if (targetSpan) targetSpan.textContent = "₹" + parseFloat(data.fairValue).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    // Upside Potential
    const upsideEl = document.querySelector('#upside-potential') || Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Upside') || el.id === 'upside-container');
    if (upsideEl) {
      const valueSpan = upsideEl.querySelector('span, p') || upsideEl;
      if (valueSpan) {
        valueSpan.textContent = "+" + parseFloat(data.upsidePercent).toFixed(1) + "%";
        valueSpan.className = "text-green-500 font-bold text-lg";
      }
    }

    // Health score
    const healthEl = document.querySelector('#health-score-val') || document.querySelector('#health-score');
    if (healthEl) {
      const rating = healthEl.querySelector('span, p') || healthEl;
      if (rating) {
        rating.textContent = data.healthScore + " / 5.0";
        rating.style.color = data.healthScore >= 4.3 ? '#10B981' : (data.healthScore >= 3.8 ? '#F59E0B' : '#EF4444');
      }
    }

    // Operating Margins
    const marginsContainer = document.querySelector('#operating-margins') || document.querySelector('#margins-container');
    if (marginsContainer) {
      marginsContainer.innerHTML = '';
      data.operatingMargins.forEach(m => {
        const row = document.createElement('div');
        row.className = "flex justify-between py-2 text-sm text-gray-300 border-b border-gray-800";
        row.innerHTML = "<span>FY " + m.year + " Margin</span><span class='font-semibold text-green-400'>" + m.margin.toFixed(1) + "%</span>";
        marginsContainer.appendChild(row);
      });
    }

    // Multi-Year Operating Statement
    const tableBody = document.querySelector('#financials-table-body') || document.querySelector('#financials-tbody') || document.querySelector('table tbody');
    if (tableBody) {
      tableBody.innerHTML = '';
      data.statements.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-800 hover:bg-gray-900 transition text-sm";
        tr.innerHTML = `
          <td class="px-4 py-3 font-semibold text-gray-200">${row.year}</td>
          <td class="px-4 py-3 text-right text-gray-300">₹${(row.revenue / 1e9).toFixed(2)}B</td>
          <td class="px-4 py-3 text-right text-green-400">₹${(row.netIncome / 1e9).toFixed(2)}B</td>
          <td class="px-4 py-3 text-right text-gray-300">₹${(row.assets / 1e9).toFixed(2)}B</td>
          <td class="px-4 py-3 text-right text-red-400">₹${(row.liabilities / 1e9).toFixed(2)}B</td>
          <td class="px-4 py-3 text-right text-blue-400">₹${(row.fcf / 1e9).toFixed(2)}B</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  }

  function renderPortfoliosUI(portfolios) {
    const container = document.querySelector('#portfolios-container') || document.querySelector('#heatmap-container') || document.body;
    if (!container) return;

    // Clear and build terminal portfolio workspace
    container.innerHTML = `
      <div class="col-span-full space-y-6">
        <h2 class="text-xl font-bold text-yellow-500 border-b border-gray-800 pb-2">ACTIVE ALGORITHMIC PORTFOLIOS [PORT]</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          \${portfolios.map(p => \`
            <div class="bg-black border border-gray-800 p-5 rounded space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded font-bold">\${p.type}</span>
                <span class="text-sm font-semibold text-green-400">Ann. Return: +\${p.annualizedReturn}%</span>
              </div>
              <h3 class="text-lg font-bold text-gray-100">\${p.name}</h3>
              <p class="text-xs text-gray-400">\${p.description}</p>
              <div class="space-y-2 border-t border-gray-900 pt-3">
                <h4 class="text-xs font-bold text-gray-300">Active Allocations</h4>
                \${p.activeHoldings.map(h => \`
                  <div class="flex justify-between text-xs text-gray-400">
                    <span>\${h.symbol} (\${h.allocation})</span>
                    <span class="font-bold text-gray-200">\${h.weight}%</span>
                  </div>
                \`).join('')}
              </div>
            </div>
          \`).join('')}
        </div>
      </div>
    `;
  }

  function showHelpOverlay() {
    const existing = document.getElementById('terminal-help-modal');
    if (existing) return;

    const modal = document.createElement('div');
    modal.id = 'terminal-help-modal';
    modal.className = "fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 font-mono";
    modal.innerHTML = `
      <div class="bg-black border border-yellow-500 p-6 max-w-lg w-full space-y-4 text-green-400">
        <div class="flex justify-between items-center border-b border-gray-800 pb-2">
          <h3 class="text-lg font-bold text-yellow-500">STOCKPRO TERMINAL DIRECTORY</h3>
          <button id="close-help-btn" class="text-gray-500 hover:text-white">&times;</button>
        </div>
        <div class="space-y-2 text-xs">
          <p class="text-white font-semibold">Supported Keyboard Command Sequences:</p>
          <div class="grid grid-cols-2 gap-2 border-b border-gray-900 pb-2 my-2">
            <div>TCS DES &lt;GO&gt;</div><div>Load detailed fundamentals</div>
            <div>NIFTY OMN &lt;GO&gt;</div><div>Load index options monitor</div>
            <div>PORT &lt;GO&gt;</div><div>Load algorithm portfolio models</div>
            <div>HELP &lt;GO&gt;</div><div>Display this directory</div>
          </div>
          <p class="text-gray-400">Use standard tickers for the NSE (e.g. RELIANCE, TCS, INFY).</p>
        </div>
        <button id="close-help-btn-bottom" class="w-full bg-yellow-500 text-black py-2 rounded text-xs font-bold font-sans">CLOSE WINDOW</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('close-help-btn').onclick = close;
    document.getElementById('close-help-btn-bottom').onclick = close;
  }

  // --- SYSTEM DAEMON & TAB CONTROLLER ---

  function activateTab(tabId) {
    const tabBtn = document.getElementById(tabId) || document.querySelector(\`[data-tab="\${tabId}"]\`);
    if (tabBtn) {
      tabBtn.click();
    }
  }

  window.fetchLiveMetrics = async function() {
    if (isDaemonRefreshing) return;
    if (document.hidden) return;

    if (refreshController) refreshController.abort();
    refreshController = new AbortController();
    isDaemonRefreshing = true;

    const currentSymbol = getActiveTickerInput();

    try {
      const response = await fetch('/api/pro-data?symbol=' + encodeURIComponent(currentSymbol), {
        signal: refreshController.signal
      });
      const data = await response.json();
      if (data && !data.error) {
        updateFundamentalsUI(data);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error("Auto-Refresh Background Loop Error:", e);
      }
    } finally {
      isDaemonRefreshing = false;
    }
  };

  function setupDOMBindings() {
    const inputEl = document.querySelector('#tickerInput');
    const buttonEl = document.querySelector('#searchButton') || Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Search') || btn.onclick?.toString().includes('fetchProStock'));

    if (inputEl) {
      // Set initial watermark placeholder to mimic Bloomberg
      inputEl.placeholder = "Enter command (e.g., TCS DES <GO> or PORT <GO>)...";
      
      inputEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeTerminalSearch();
        }
      });
    }

    if (buttonEl) {
      buttonEl.addEventListener('click', function(e) {
        e.preventDefault();
        executeTerminalSearch();
      });
    }

    if (window.metricsIntervalId) {
      clearInterval(window.metricsIntervalId);
    }
    window.metricsIntervalId = setInterval(window.fetchLiveMetrics, 12000);
    window.fetchLiveMetrics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDOMBindings);
  } else {
    setupDOMBindings();
  }
})();
