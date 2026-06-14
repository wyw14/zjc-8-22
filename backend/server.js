const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3122;
const JWT_SECRET = 'dream-secret-key-2024';

const DATA_DIR = path.join(__dirname, 'data');
const DREAMS_FILE = path.join(DATA_DIR, 'dreams.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function validateLucidity(lucidity) {
  const l = parseInt(lucidity);
  return Number.isInteger(l) && l >= 1 && l <= 5;
}

function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d) && d.toISOString().slice(0, 10) === dateStr;
}

function initUsers() {
  const users = readJSON(USERS_FILE);
  if (users.length === 0) {
    const defaultUser = {
      id: 1,
      username: 'dreamer',
      password: bcrypt.hashSync('123456', 10)
    };
    writeJSON(USERS_FILE, [defaultUser]);
  }
}

function initDreams() {
  const dreams = readJSON(DREAMS_FILE);
  if (dreams.length === 0) {
    const sampleDreams = [
      {
        id: 1,
        userId: 1,
        content: '在一片紫色的云海中漂浮，远处有一座发光的水晶城堡，城堡的塔尖直插云霄。',
        lucidity: 5,
        date: '2026-06-01'
      },
      {
        id: 2,
        userId: 1,
        content: '梦见自己变成了一只鸟，在城市上空飞翔，下面的人群像蚂蚁一样小。',
        lucidity: 3,
        date: '2026-06-05'
      },
      {
        id: 3,
        userId: 1,
        content: '在海底漫步，周围是五颜六色的珊瑚和会发光的鱼，我可以在水中呼吸。',
        lucidity: 4,
        date: '2026-06-10'
      },
      {
        id: 4,
        userId: 1,
        content: '梦见了很久没见的老朋友，我们在一片向日葵花田里聊天。',
        lucidity: 2,
        date: '2026-05-20'
      },
      {
        id: 5,
        userId: 1,
        content: '在太空里行走，地球就在脚下，星星近得伸手就能摸到。',
        lucidity: 5,
        date: '2026-05-15'
      },
      {
        id: 6,
        userId: 1,
        content: '梦见自己在图书馆里，每本书打开都会飞出不同颜色的蝴蝶。',
        lucidity: 4,
        date: '2026-06-12'
      }
    ];
    writeJSON(DREAMS_FILE, sampleDreams);
  }
}

initUsers();
initDreams();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'token无效' });
    }
    req.user = user;
    next();
  });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/api/dreams', authenticateToken, (req, res) => {
  const dreams = readJSON(DREAMS_FILE).filter(d => d.userId === req.user.id);
  res.json(dreams.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/dreams', authenticateToken, (req, res) => {
  const { content, lucidity, date } = req.body;
  if (!content || !lucidity || !date) {
    return res.status(400).json({ error: '内容、清醒度和日期必填' });
  }
  if (!validateLucidity(lucidity)) {
    return res.status(400).json({ error: '清醒度必须是 1-5 的整数' });
  }
  if (!validateDate(date)) {
    return res.status(400).json({ error: '日期格式必须是 YYYY-MM-DD 的有效日期' });
  }

  const dreams = readJSON(DREAMS_FILE);
  const newDream = {
    id: dreams.length > 0 ? Math.max(...dreams.map(d => d.id)) + 1 : 1,
    userId: req.user.id,
    content,
    lucidity: parseInt(lucidity),
    date
  };

  dreams.push(newDream);
  writeJSON(DREAMS_FILE, dreams);
  res.status(201).json(newDream);
});

const THEME_KEYWORDS = {
  sky: ['飞', '天空', '云', '漂浮', '太空', '星星', '月亮', '太阳', '飞翔', '天空'],
  water: ['海', '水', '河', '湖', '雨', '海底', '鱼', '珊瑚', '浪', '游泳', '水中'],
  nature: ['花', '树', '森林', '草地', '山', '向日葵', '花园', '田野', '蝴蝶'],
  building: ['城堡', '房子', '图书馆', '教堂', '宫殿', '塔', '桥', '城'],
  people: ['朋友', '人', '母亲', '父亲', '孩子', '老人', '恋人', '聊天'],
  animal: ['鸟', '猫', '狗', '鱼', '蝴蝶', '马', '龙'],
  light: ['发光', '光', '亮', '水晶', '彩虹', '闪烁', '灯'],
  music: ['歌', '音乐', '琴', '鼓', '旋律', '唱']
};

const LUCIDITY_TEMPLATES = {
  1: [
    '在迷离的梦境边缘，让{theme}成为你笔下的暗流——不必说清，只需感受。',
    '那段模糊的{theme}还在回响，试着用直觉而非逻辑去续写它。',
    '梦境未散，{theme}仍在呢喃——放手让它自己生长。'
  ],
  2: [
    '梦境渐远但余韵犹存，{theme}的意象值得你用文字重新锚定。',
    '半梦半醒间的{theme}最迷人，试着捕捉那一瞬的动摇。',
    '用{theme}的碎片拼出属于你的故事骨架，剩下的交给想象。'
  ],
  3: [
    '梦中的{theme}清晰可触——这是创作的好兆头，趁记忆还鲜活，动笔吧。',
    '{theme}正等你赋予它新的走向，你已经拥有了足够的故事素材。',
    '清醒度恰到好处：{theme}既真实又奇幻，正是创作的绝佳起点。'
  ],
  4: [
    '你在梦中几乎清醒地经历了{theme}——把这份清晰转化为文字的力量。',
    '{theme}的记忆如此鲜明，仿佛可以一比一还原，试着在纸上重建它。',
    '高度清醒的梦境是灵感的金矿，{theme}就是等待开采的矿石。'
  ],
  5: [
    '你在梦中完全掌控了{theme}——现在，在创作中也掌控它吧。',
    '清明梦中的{theme}是最纯净的灵感，它不需要加工，只需要被记录和延展。',
    '当你清醒地穿越{theme}时，创作已经开始了——继续这个未完的叙事。'
  ]
};

const SEASON_TEMPLATES = {
  spring: ['春风里万物萌发，', '在花开的季节，', '春日正好，'],
  summer: ['盛夏光影交错，', '在热烈的季节，', '夏日悠长，'],
  autumn: ['秋意渐浓，', '落叶纷飞之际，', '在沉思的季节，'],
  winter: ['寒冬沉淀思绪，', '万物静默之时，', '在深邃的季节，']
};

const TIME_HINTS = {
  morning: '晨光初照',
  afternoon: '午后慵懒',
  evening: '暮色四合',
  night: '夜深人静'
};

function extractThemes(content) {
  const themes = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => content.includes(kw))) {
      themes.push(theme);
    }
  }
  return themes.length > 0 ? themes : ['dream'];
}

function getSeason(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

const THEME_LABELS = {
  sky: '天空与飞翔',
  water: '水与深海',
  nature: '自然与花木',
  building: '建筑与空间',
  people: '人际与情感',
  animal: '生灵与陪伴',
  light: '光影与色彩',
  music: '旋律与节奏',
  dream: '梦境本身'
};

function generateReminder(dream) {
  const { content, lucidity, date } = dream;
  const themes = extractThemes(content);
  const primaryTheme = themes[0];
  const themeLabel = THEME_LABELS[primaryTheme] || '梦境';

  const lucidityLevel = Math.max(1, Math.min(5, lucidity));
  const templates = LUCIDITY_TEMPLATES[lucidityLevel];
  const mainText = templates[Math.floor(Math.random() * templates.length)].replace('{theme}', themeLabel);

  const dreamDate = new Date(date);
  const month = dreamDate.getMonth() + 1;
  const season = getSeason(month);
  const seasonPrefixes = SEASON_TEMPLATES[season];
  const seasonPrefix = seasonPrefixes[Math.floor(Math.random() * seasonPrefixes.length)];

  const daysDiff = Math.floor((Date.now() - dreamDate.getTime()) / (1000 * 60 * 60 * 24));
  let timeText = '';
  if (daysDiff === 0) {
    timeText = '今天的梦犹在眼前——';
  } else if (daysDiff <= 7) {
    timeText = '那个梦只过去了几天——';
  } else if (daysDiff <= 30) {
    timeText = '时光流转，但那个梦仍未远去——';
  } else if (daysDiff <= 90) {
    timeText = '记忆或许模糊，但灵感不会过期——';
  } else {
    timeText = '久远的梦也有重生的力量——';
  }

  const actionHints = [
    '试着用不同视角重写这个场景',
    '为它添加一个意想不到的转折',
    '把这个意象融入你正在创作的作品',
    '用五感去丰富这段记忆',
    '给它一个你从未想过的结局'
  ];
  const actionHint = actionHints[Math.floor(Math.random() * actionHints.length)];

  return {
    text: `${timeText}${seasonPrefix}${mainText}`,
    hint: actionHint,
    theme: themeLabel,
    lucidityLevel
  };
}

app.get('/api/dreams/random', authenticateToken, (req, res) => {
  const userDreams = readJSON(DREAMS_FILE).filter(d => d.userId === req.user.id);
  if (userDreams.length === 0) {
    return res.status(404).json({ error: '还没有梦境记录' });
  }
  const randomDream = userDreams[Math.floor(Math.random() * userDreams.length)];
  res.json(randomDream);
});

app.post('/api/dreams/remind', authenticateToken, (req, res) => {
  const { content, lucidity, date } = req.body;
  if (!content || !lucidity || !date) {
    return res.status(400).json({ error: '内容、清醒度和日期必填' });
  }
  if (!validateLucidity(lucidity)) {
    return res.status(400).json({ error: '清醒度必须是 1-5 的整数' });
  }
  if (!validateDate(date)) {
    return res.status(400).json({ error: '日期格式必须是 YYYY-MM-DD 的有效日期' });
  }
  const reminder = generateReminder({ content, lucidity, date });
  res.json(reminder);
});

app.get('/api/stats/monthly', authenticateToken, (req, res) => {
  const { month, year } = req.query;
  const now = new Date();
  const targetYear = year ? parseInt(year) : now.getFullYear();
  const targetMonth = month ? parseInt(month) : now.getMonth() + 1;

  const userDreams = readJSON(DREAMS_FILE).filter(d => {
    if (d.userId !== req.user.id) return false;
    const dDate = new Date(d.date);
    return dDate.getFullYear() === targetYear && (dDate.getMonth() + 1) === targetMonth;
  });

  const count = userDreams.length;
  const avgLucidity = count > 0
    ? (userDreams.reduce((sum, d) => sum + d.lucidity, 0) / count).toFixed(1)
    : 0;

  res.json({
    year: targetYear,
    month: targetMonth,
    count,
    avgLucidity: parseFloat(avgLucidity)
  });
});

app.listen(PORT, () => {
  console.log(`梦境收集系统后端运行在 http://localhost:${PORT}`);
  console.log('默认账号: dreamer / 123456');
});
