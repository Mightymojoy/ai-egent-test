const https = require('https');

// 飞书凭证
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_aaba0a16d7bcdbc3';
const FEISHU_SECRET = process.env.FEISHU_APP_SECRET || 'Z5WUnr1WQptEplbEuAYgubFQOTDv5CgX';
const APP_TOKEN = 'P6tnbCy3oamMx3sSkjBchsYvnLC';
const TABLE_ID = 'tblVq79mDBWm0JZR';

function feishuFetch(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('parse: ' + data.substring(0,200))); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // 1) 获取飞书token
    const tr = await feishuFetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_SECRET })}
    );
    if (tr.code !== 0) throw new Error('token: ' + tr.msg);
    const token = tr.tenant_access_token;

    // 2) 写入飞书
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    const fields = {
      '姓名': payload.name || '',
      '部门': payload.dept || '',
      '总分': payload.totalScore || 0,
      '评级': payload.rating || '',
      '答题时间': dateStr,
      '得分详情': payload.detail || ''
    };

    const wr = await feishuFetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
      { method:'POST',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body: JSON.stringify({fields})}
    );

    if (wr.code === 0) {
      return res.json({ code: 0, success: true, record_id: wr.data.record.record_id });
    } else {
      return res.json({ code: -1, msg: wr.msg || 'write failed' });
    }
  } catch(e) {
    return res.json({ code: -1, msg: e.message });
  }
};
