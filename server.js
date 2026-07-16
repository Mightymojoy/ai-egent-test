const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ========== 读取配置 ==========
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
} catch (e) {
  console.error('[Config Error] 读取 config.json 失败，请检查文件是否存在');
  console.error('[Config Error] 参考 config.example.json 创建配置文件');
  process.exit(1);
}

const PORT = config.port || 4893;
const BASE_TOKEN = config.baseToken;
const TABLE_ID = config.tableId;

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// ========== 写入飞书多维表格 ==========
function writeToFeishu(data) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

  const payload = {
    "姓名": String(data.name || ''),
    "部门": String(data.dept || ''),
    "总分": Number(data.totalScore) || 0,
    "评级": String(data.rating || ''),
    "答题时间": dateStr,
    "得分详情": `选择:${data.choiceScore}分(${data.choiceCorrect}/10) | 判断:${data.judgeScore}分(${data.judgeCorrect}/5) | 填空:${data.fillScore}分(${data.fillCorrect}/4)`
  };

  const tmpFile = `.exam_tmp_${Date.now()}.json`;
  const tmpPath = path.join(__dirname, tmpFile);

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf-8');
    const cmd = `lark-cli base +record-upsert --as bot --base-token ${BASE_TOKEN} --table-id ${TABLE_ID} --json @${tmpFile}`;
    const output = execSync(cmd, {
      cwd: __dirname,
      timeout: 15000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024
    });
    const parsed = JSON.parse(output);
    return parsed.ok === true;
  } catch (err) {
    console.error('[Feishu Error]', err.message);
    return false;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch(e) {}
  }
}

// ========== HTTP Server ==========
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== 提交成绩 =====
  if (req.method === 'POST' && req.url === '/api/submit') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`[Submission] ${data.name} - ${data.totalScore}分 - ${data.rating}`);
        const ok = writeToFeishu(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok, score: data.totalScore, rating: data.rating }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid data' }));
      }
    });
    return;
  }

  // ===== 静态文件 =====
  let filePath = req.url === '/' ? '/exam.html' : req.url;
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✦ ITO · AI Agent 考试系统已启动 ✦`);
  console.log(`  ─────────────────────────────`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  飞书表格已就绪`);
  console.log(`  按 Ctrl+C 停止服务\n`);
});
