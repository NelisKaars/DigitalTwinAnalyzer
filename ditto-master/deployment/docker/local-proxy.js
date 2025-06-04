// Simple localhost:8080 to actual Ditto API proxy
const http = require('http');

// Configuration
const LOCALHOST_PORT = 8080;          // Port to listen on locally
const TARGET_HOST = 'localhost';      // Target host (nginx container hostname)
const TARGET_PORT = 80;               // Target port (nginx container port)

console.log(`Starting local proxy: localhost:${LOCALHOST_PORT} → ${TARGET_HOST}:${TARGET_PORT}`);

// Create a proxy server
const server = http.createServer((req, res) => {
  console.log(`Proxying request: ${req.method} ${req.url}`);
  
  // Set up the request options for the target server
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  // Adjust host header to match the target
  options.headers.host = `${TARGET_HOST}:${TARGET_PORT}`;
  
  // Send the request to the target server
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  // Handle errors
  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(500);
    res.end(`Proxy error: ${error.message}`);
  });
  
  // If there's request data, forward it to the target
  req.pipe(proxyReq);
});

// Start the proxy server
server.listen(LOCALHOST_PORT, '127.0.0.1', () => {
  console.log(`Proxy server running at http://localhost:${LOCALHOST_PORT}/`);
});