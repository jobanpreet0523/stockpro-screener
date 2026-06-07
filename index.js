// index.js

document.addEventListener('DOMContentLoaded', () => {
  // Initialize real-time streams
  if (window.MarketStream) {
    window.MarketStream.init();
  }

  // Bind main CTA buttons to your existing pages without breaking UI styling
  bindNavigationElements();

  // Bind the search functionality for indices and derivatives
  setupSearchEngine();
});

/**
 * Safe search logic mapping input keywords to subpages or filters
 */
function setupSearchEngine() {
  const searchInput = document.querySelector('input[placeholder*="Search"]');
  if (!searchInput) return;

  searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      const query = searchInput.value.trim().toUpperCase();
      if (!query) return;

      console.log(`Searching for: ${query}`);
      
      // Route user to fo.html or dashboard.html with active query parameter
      if (query.includes('NIFTY') || query.includes('BANKNIFTY')) {
        window.location.href = `./dashboard.html?symbol=${encodeURIComponent(query)}`;
      } else {
        window.location.href = `./fo.html?search=${encodeURIComponent(query)}`;
      }
    }
  });
}

/**
 * Handles navigation redirects across existing HTML files
 */
function bindNavigationElements() {
  // Access Pro Terminal redirect
  const terminalBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
    el.textContent.trim().includes('Access Pro Terminal')
  );
  if (terminalBtn) {
    terminalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = './dashboard.html';
    });
  }

  // Request a Demo redirect
  const demoBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
    el.textContent.trim().includes('Request a Demo')
  );
  if (demoBtn) {
    demoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = './fo.html';
    });
  }
}
