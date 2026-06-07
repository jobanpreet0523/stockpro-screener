// index.js - Client-Side Controller

(function() {
  console.log("StockPro Core Client-Side Engine Activated.");

  let activeTicker = "RELIANCE.NS";
  let refreshController = null;
  let isDaemonRefreshing = false;

  function cleanAndNormalizeTicker(symbol) {
    let clean = symbol.trim().toUpperCase();
    if (!clean) return "";
    if (!clean.endsWith('.NS') && !clean.includes('^')) {
      clean += '.NS';
    }
    return clean;
  }

  function getActiveTickerInput() {
    const inputEl = document.querySelector('#tickerInput');
    if (inputEl && inputEl.value.trim()) {
      return cleanAndNormalizeTicker(inputEl.value);
    }
    return activeTicker;
  }

  function showLoadingVisualization() {
    const healthVal = document.querySelector('#health-score-val') || document.querySelector('#health-score');
    if (healthVal) {
      healthVal.textContent = "...";
    }
  }

  function updateFundamentalsUI(data) {
    if (!data || data.error) return;
    activeTicker = data.symbol;

    // Update Company Title Elements
    const titleElements = Array.from(document.querySelectorAll('h1, h2, h3, p')).filter(el => 
      el.id === 'company-name' || el.textContent.includes("Reliance") || el.textContent.includes("TCS") || el.textContent.includes("Infosys")
    );
    titleElements.forEach(el => {
      if (el.children.length === 0 || el.id === 'company-name') {
        el.textContent = data.companyName + " (" + data.symbol + ")";
      }
    });

    // Update Pricing metrics
    const priceElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.id === 'current-price' || (el.children.length === 0 && el.textContent.trim().startsWith('₹'))
    );
    priceElements.forEach(el => {
      el.textContent = "₹" + parseFloat(data.price).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    });

    // Update Fair Value metrics
    const fairValueEl = document.querySelector('#fair-value') || Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Fair Value') || el.id === 'fair-val-container');
    if (fairValueEl) {
      const targetSpan = fairValueEl.querySelector('span, p') || fairValueEl;
      if (targetSpan) targetSpan.textContent = "₹" + parseFloat(data.fairValue).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    // Update Upside Potential
    const upsideEl = document.querySelector('#upside-potential') || Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Upside') || el.id === 'upside-container');
    if (upsideEl) {
      const valueSpan = upsideEl.querySelector('span, p') || upsideEl;
      if (valueSpan) {
        valueSpan.textContent = "+" + parseFloat(data.upsidePercent).toFixed(1) + "%";
        valueSpan.className = "text-green-500 font-bold text-lg";
      }
    }

    // Update Health Rating Metrics
    const healthEl = document.querySelector('#health-score-val') || document.querySelector('#health-score');
    if (healthEl) {
      const rating = healthEl.querySelector('span, p') || healthEl;
      if (rating) {
        rating.textContent = data.healthScore + " / 5.0";
        if (data.healthScore >= 4.3) rating.style.color = '#10B981';
        else if (data.healthScore >= 3.8) rating.style.color = '#F59E0B';
        else rating.style.color = '#EF4444';
      }
    }

    // Update Margins List
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

    // Update Multi-Year Financial Statements Table
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

  // Bridging Interactive Search Connectivity
  window.fetchProStock = async function() {
    const inputSymbol = getActiveTickerInput();
    if (!inputSymbol) return;

    showLoadingVisualization();

    try {
      const response = await fetch('/api/pro-data?symbol=' + encodeURIComponent(inputSymbol));
      const data = await response.json();
      if (data && !data.error) {
        updateFundamentalsUI(data);
      }
    } catch (e) {
      console.error("Manual metrics fetch error:", e);
    }
  };

  // Memory-Safe Auto Refresh Daemon
  window.fetchLiveMetrics = async function() {
    if (isDaemonRefreshing) return;
    if (document.hidden) return; // Pause fetches when tab is hidden

    if (refreshController) {
      refreshController.abort();
    }
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
      inputEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.fetchProStock();
        }
      });
    }

    if (buttonEl) {
      buttonEl.addEventListener('click', function(e) {
        e.preventDefault();
        window.fetchProStock();
      });
    }

    // Start daemon refresh
    if (window.metricsIntervalId) {
      clearInterval(window.metricsIntervalId);
    }
    window.metricsIntervalId = setInterval(window.fetchLiveMetrics, 12000);
    
    // Initial fetch to load page stats
    window.fetchLiveMetrics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDOMBindings);
  } else {
    setupDOMBindings();
  }
})();
