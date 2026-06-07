// 1. ROUTER LOGIC
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // If the browser asks for data, serve it FIRST
    if (url.pathname === "/api/data") {
      const underlying = url.searchParams.get("underlying") || "NIFTY";
      const data = await getOptionData(underlying);
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Otherwise, serve your HTML
    return new Response(HTML_CONTENT, {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

// 2. YOUR HELPER FUNCTIONS (Place them here)
async function getOptionData(underlying) {
    // ... keep all your existing logic here ...
    return { status: "success", underlying }; 
}

// 3. THE HTML CONTENT
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Keep all your CSS/Head tags here -->
</head>
<body>
  <!-- Your Body Content -->
  <script>
    // CRITICAL: Use \${} instead of ${} for variables inside this string
    async function fetchLiveMetrics() {
      try {
        const underlying = document.getElementById('underlyingSelect').value;
        const response = await fetch('/api/data?underlying=' + underlying);
        const data = await response.json();
        console.log("Data received:", data);
        // Update your UI here
      } catch (err) {
        console.error("Fetch failed", err);
      }
    }
  </script>
</body>
</html>
`;
