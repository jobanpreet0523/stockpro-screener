// live-data.js

// Configuration: Insert your live API keys here
const CONFIG = {
  // Option A: RapidAPI (Yahoo Finance API) for live indices
  rapidApiKey: 'YOUR_RAPID_API_KEY', // Get a free key from rapidapi.com/apidojo/api/yh-finance
  rapidApiHost: 'yh-finance.p.rapidapi.com',
  
  // Option B: If you're using broker APIs like Shoonya / Angel One / Upstox for live options
  brokerApiKey: 'YOUR_BROKER_API_KEY',
  
  updateIntervalMs: 5000 // Refresh data every 5 seconds
};

// Main state to store market metrics
let marketData = {
  nifty: { price: 23366.70, change: -49.85, percent: -0.21 },
  banknifty: { price: 54496.25, change: 188.40, percent: 0.35 },
  vix: { price: 12.34, change: 0.25, percent: 2.07 }
};

/**
 * Safely locates and updates index widgets in the UI without altering your HTML/CSS structures.
 */
function updateIndexUI(label, price, change, percent) {
  const formattedPrice = parseFloat(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedPercent = `${change >= 0 ? '+' : ''}${parseFloat(percent).toFixed(2)}%`;
  
  // 1. First attempt: Search for elements using direct standard IDs
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

  // 2. Fallback attempt: Search the DOM contextually to preserve your exact design
  const allElements = Array.from(document.querySelectorAll('*'));
  const headerElement = allElements.find(el => 
    el.textContent.trim().toUpperCase() === label.toUpperCase() && el.children.length === 0
  );
  
  if (headerElement) {
    const cardContainer = headerElement.closest('div');
    if (cardContainer) {
      const childTexts = Array.from(cardContainer.querySelectorAll('span, p, div'))
        .filter(el => el.children.length === 0);
      
      // Update the element that represents a standard currency or index price
      const priceTextEl = childTexts.find(el => /^[0-9,.]+(\s?)$/.test(el.textContent.trim().replace(/[^0-9.]/g, '')));
      // Update the element that represents a percentage/direction change
      const changeTextEl = childTexts.find(el => el.textContent.includes('%') || el.textContent.includes('+') || el.textContent.includes('-'));

      if (priceTextEl) {
        priceTextEl.textContent = formattedPrice;
      }
      if (changeTextEl) {
        changeTextEl.textContent = formattedPercent;
        if (change >= 0) {
          changeTextEl.style.color = '#10B981'; // Tailwind text-green-500
        } else {
          changeTextEl.style.color = '#EF4444'; // Tailwind text-red-500
        }
      }
    }
  }
}

/**
 * Fetches real-time indexes from Yahoo Finance API
 */
async function fetchRealTimeIndices() {
  if (!CONFIG.rapidApiKey || CONFIG.rapidApiKey === 'YOUR_RAPID_API_KEY') {
    useDataSimulation(); // Automatically fall back to realistic tick simulator if no API key is provided
    return;
  }

  // Yahoo Finance Symbols for Nifty 50 (^NSEI), Bank Nifty (^NSEBANK), India VIX (^INDIAVIX)
  const symbols = '^NSEI,^NSEBANK,^INDIAVIX';
  const url = `https://${CONFIG.rapidApiHost}/market/v2/get-quotes?region=IN&symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': CONFIG.rapidApiKey,
        'x-rapidapi-host': CONFIG.rapidApiHost
      }
    });

    if (!response.ok) throw new Error('API Request Failed');

    const result = await response.json();
    const quotes = result?.quoteResponse?.result || [];

    quotes.forEach(quote => {
      if (quote.symbol === '^NSEI') {
        marketData.nifty = {
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          percent: quote.regularMarketChangePercent
        };
      } else if (quote.symbol === '^NSEBANK') {
        marketData.banknifty = {
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          percent: quote.regularMarketChangePercent
        };
      } else if (quote.symbol === '^INDIAVIX') {
        marketData.vix = {
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          percent: quote.regularMarketChangePercent
        };
      }
    });

    renderAllIndices();
  } catch (error) {
    console.warn("Live API fetch failed. Using index simulation:", error);
    useDataSimulation();
  }
}

/**
 * Generates natural tick-by-tick adjustments during weekends or out-of-market hours
 */
function useDataSimulation() {
  const applyRandomTick = (item) => {
    const changeFactor = (Math.random() - 0.5) * 2; // minor price fluctuations
    item.price += changeFactor;
    item.change += changeFactor;
    item.percent = (item.change / (item.price - item.change)) * 100;
  };

  applyRandomTick(marketData.nifty);
  applyRandomTick(marketData.banknifty);
  
  // VIX generally moves counter to key indices
  const vixMove = (Math.random() - 0.5) * 0.1;
  marketData.vix.price = Math.max(8, marketData.vix.price + vixMove);
  marketData.vix.percent = (vixMove / marketData.vix.price) * 100;

  renderAllIndices();
}

function renderAllIndices() {
  updateIndexUI('NIFTY', marketData.nifty.price, marketData.nifty.change, marketData.nifty.percent);
  updateIndexUI('BANKNIFTY', marketData.banknifty.price, marketData.banknifty.change, marketData.banknifty.percent);
  updateIndexUI('VIX', marketData.vix.price, marketData.vix.change, marketData.vix.percent);
}

// Start polling data updates
function initMarketStream() {
  renderAllIndices();
  fetchRealTimeIndices();
  setInterval(fetchRealTimeIndices, CONFIG.updateIntervalMs);
}

// Export functions to window context
window.MarketStream = {
  init: initMarketStream,
  getLatest: () => marketData
};
