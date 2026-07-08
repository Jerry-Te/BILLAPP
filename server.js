const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(__dirname, url);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for unknown paths
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(500);
          res.end('Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// 监听端口错误（例如端口被占用）
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[x] 端口 ${PORT} 已被占用，请关闭占用该端口的程序后重试`);
    console.error(`    查看占用: netstat -ano | findstr :${PORT}`);
  } else if (err.code === 'EACCES') {
    console.error(`[x] 没有权限绑定端口 ${PORT}，请尝试使用更高的端口号`);
  } else {
    console.error(`[x] 服务器启动失败:`, err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  \u{1f43b}  \u5c0f\u718a\u8bb0\u8d26 \u5f00\u53d1\u670d\u52a1\u5668\u5df2\u542f\u52a8');
  console.log('');
  console.log('  \u{1f310}  \u672c\u5730:          http://localhost:' + PORT);
  console.log('  \u{1f4f1}  iPhone: http://<你电脑的IP>:' + PORT);
  console.log('');
  console.log('  \u{23f3}  按 Ctrl+C 停止服务器');
  console.log('');
});
