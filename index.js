const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const express = require('express');

// --- 1. Load settings.json ---
let settings = {
  server: {
    host: "Playfun-C1IM.aternos.me",
    port: 52411,
    version: "1.20.4"
  },
  bot: {
    username: "Nishant_AFK_Bot",
    antiAfk: true,
    actionIntervalSeconds: 8,
    autoChatResponse: true,
    reconnectDelaySeconds": 20
  },
  webServer: {
    port: 3000
  }
};

const settingsPath = path.join(__dirname, 'settings.json');
if (fs.existsSync(settingsPath)) {
  try {
    const rawData = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(rawData);
  } catch (err) {
    console.error('Config load error:', err.message);
  }
}

const SERVER_HOST = process.env.SERVER_HOST || settings.server.host;
const SERVER_PORT = parseInt(process.env.SERVER_PORT || settings.server.port);
const BOT_NAME = process.env.BOT_NAME || settings.bot.username;
const BOT_VERSION = settings.server.version || "1.20.4";
const WEB_PORT = process.env.PORT || settings.webServer.port || 3000;

// --- 2. Live Logs & Connection History Tracker ---
const liveState = {
  status: 'Starting...',
  health: 20,
  food: 20,
  position: { x: 0, y: 0, z: 0 },
  lastAction: 'Initializing bot...',
  totalConnects: 0,
  totalDisconnects: 0,
  lastConnectedAt: 'Never',
  lastDisconnectedAt: 'Never',
  connectionLogs: [], // Dedicated logs for Connect / Disconnect / Kick events
  activityLogs: []    // Movement & chat logs
};

function addConnectionEvent(type, message) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = {
    time: timestamp,
    type: type, // 'CONNECT', 'DISCONNECT', 'KICK', 'ERROR'
    message: message
  };
  console.log(`[${type}] ${timestamp} - ${message}`);
  liveState.connectionLogs.unshift(entry);
  if (liveState.connectionLogs.length > 50) liveState.connectionLogs.pop();
}

function addActivityLog(message) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  liveState.activityLogs.unshift(`[${timestamp}] ${message}`);
  if (liveState.activityLogs.length > 30) liveState.activityLogs.pop();
}

// --- 3. Express Web Server & Live UI ---
const app = express();

app.get('/api/status', (req, res) => {
  if (bot && bot.entity) {
    liveState.health = Math.round(bot.health || 20);
    liveState.food = Math.round(bot.food || 20);
    liveState.position = {
      x: Math.round(bot.entity.position.x),
      y: Math.round(bot.entity.position.y),
      z: Math.round(bot.entity.position.z)
    };
  }
  res.json({
    ...liveState,
    server: `${SERVER_HOST}:${SERVER_PORT}`,
    botName: BOT_NAME
  });
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minecraft Bot Live Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #c9d1d9; padding: 18px; }
    .container { max-width: 950px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #21262d; padding-bottom: 12px; margin-bottom: 18px; }
    .title { font-size: 20px; font-weight: bold; color: #58a6ff; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; background: #238636; color: #fff; }
    .badge.offline { background: #da3633; }
    .badge.warning { background: #d29922; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px; }
    .stat-label { font-size: 11px; color: #8b949e; text-transform: uppercase; margin-bottom: 4px; }
    .stat-val { font-size: 17px; font-weight: bold; color: #f0f6fc; }

    .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media(max-width: 768px) { .split-grid { grid-template-columns: 1fr; } }

    .box-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px; }
    .box-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .log-box { background: #010409; border: 1px solid #21262d; border-radius: 6px; padding: 10px; height: 320px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.6; }

    .tag-connect { color: #3fb950; font-weight: bold; }
    .tag-disconnect { color: #f85149; font-weight: bold; }
    .tag-kick { color: #d29922; font-weight: bold; }
    .tag-error { color: #f85149; }
    .log-row { border-bottom: 1px solid #161b22; padding: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">🤖 Minecraft Bot Monitor & Connection Logs</div>
        <div style="color: #8b949e; font-size: 12px; margin-top: 3px;" id="serverName">Connecting...</div>
      </div>
      <div id="statusBadge" class="badge">Checking...</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Bot Username</div>
        <div class="stat-val" id="botName">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Connects</div>
        <div class="stat-val" id="totalConnects" style="color: #3fb950;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Disconnects</div>
        <div class="stat-val" id="totalDisconnects" style="color: #f85149;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Live Action</div>
        <div class="stat-val" id="lastAction" style="color: #e3b341;">--</div>
      </div>
    </div>

    <div class="split-grid">
      <!-- Section 1: Connect / Disconnect History Logs -->
      <div class="box-card">
        <div class="box-title" style="color: #79c0ff;">
          <span>🔌 Connect / Disconnect Logs</span>
          <span style="font-size: 11px; color: #8b949e;">Live Sync</span>
        </div>
        <div class="log-box" id="connLogBox">Waiting for connection events...</div>
      </div>

      <!-- Section 2: Player Movement & Chat Activity Logs -->
      <div class="box-card">
        <div class="box-title" style="color: #a5d6ff;">
          <span>🎮 In-Game Activities & Chat</span>
          <span style="font-size: 11px; color: #8b949e;">Live Action</span>
        </div>
        <div class="log-box" id="actLogBox">Waiting for game activities...</div>
      </div>
    </div>
  </div>

  <script>
    async function updateDashboard() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        document.getElementById('serverName').innerText = 'Server: ' + data.server;
        document.getElementById('botName').innerText = data.botName;
        document.getElementById('totalConnects').innerText = data.totalConnects;
        document.getElementById('totalDisconnects').innerText = data.totalDisconnects;
        document.getElementById('lastAction').innerText = data.lastAction;

        const badge = document.getElementById('statusBadge');
        badge.innerText = data.status;
        if (data.status === 'Connected') {
          badge.className = 'badge';
        } else if (data.status === 'Connecting...') {
          badge.className = 'badge warning';
        } else {
          badge.className = 'badge offline';
        }

        // Render Connection Logs
        const connLogBox = document.getElementById('connLogBox');
        if (data.connectionLogs && data.connectionLogs.length > 0) {
          connLogBox.innerHTML = data.connectionLogs.map(item => {
            let tagClass = 'tag-connect';
            if (item.type === 'DISCONNECT') tagClass = 'tag-disconnect';
            if (item.type === 'KICK') tagClass = 'tag-kick';
            if (item.type === 'ERROR') tagClass = 'tag-error';
            return '<div class="log-row">[' + item.time + '] <span class="' + tagClass + '">[' + item.type + ']</span> ' + item.message + '</div>';
          }).join('');
        }

        // Render Activity Logs
        const actLogBox = document.getElementById('actLogBox');
        if (data.activityLogs && data.activityLogs.length > 0) {
          actLogBox.innerHTML = data.activityLogs.map(log => '<div class="log-row" style="color: #39d353;">' + log + '</div>').join('');
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    setInterval(updateDashboard, 1500);
    updateDashboard();
  </script>
</body>
</html>
  `);
});

app.listen(WEB_PORT, () => {
  addActivityLog(`Web dashboard started on port ${WEB_PORT}`);
});

// --- 4. Mineflayer Bot Connection & Dedicated Logs ---
let bot;
let behaviorLoop = null;

function createBot() {
  liveState.status = 'Connecting...';
  addConnectionEvent('CONNECT', `Attempting connection to ${SERVER_HOST}:${SERVER_PORT}`);

  bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_NAME,
    version: BOT_VERSION
  });

  bot.on('spawn', () => {
    liveState.status = 'Connected';
    liveState.totalConnects++;
    liveState.lastConnectedAt = new Date().toLocaleTimeString('en-US', { hour12: false });
    liveState.lastAction = 'Spawned in world';

    addConnectionEvent('CONNECT', `SUCCESS: Bot "${BOT_NAME}" joined server successfully!`);
    addActivityLog(`Bot spawned into world at (${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.y)}, ${Math.round(bot.entity.position.z)})`);
    bot.chat('Hey Playfun! AFK Bot online hai.');

    if (settings.bot.antiAfk) {
      startNaturalMovement();
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    addActivityLog(`[CHAT] <${username}>: ${message}`);

    if (!settings.bot.autoChatResponse) return;
    const lower = message.toLowerCase();
    if (lower.includes('hi bot') || lower.includes('hello bot')) {
      bot.chat(`Hello ${username}!`);
      addActivityLog(`[REPLY] Replied to ${username}`);
    } else if (lower.includes('jump')) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
      addActivityLog(`[CMD] Jump performed on command by ${username}`);
    }
  });

  bot.on('kicked', (reason) => {
    liveState.status = 'Kicked';
    liveState.totalDisconnects++;
    liveState.lastAction = 'Kicked from server';
    
    // Parse kick reason if it is JSON
    let cleanReason = reason;
    try {
      const parsed = JSON.parse(reason);
      if (parsed.text) cleanReason = parsed.text;
      else if (parsed.extra) cleanReason = parsed.extra.map(e => e.text || '').join('');
    } catch(e) {}

    addConnectionEvent('KICK', `Kicked by server! Reason: ${cleanReason}`);
    clearInterval(behaviorLoop);
  });

  bot.on('error', (err) => {
    liveState.status = 'Error';
    addConnectionEvent('ERROR', `Socket/Protocol Error: ${err.message}`);
  });

  bot.on('end', () => {
    liveState.status = 'Disconnected';
    liveState.totalDisconnects++;
    liveState.lastDisconnectedAt = new Date().toLocaleTimeString('en-US', { hour12: false });
    liveState.lastAction = 'Waiting to reconnect';

    const delay = settings.bot.reconnectDelaySeconds || 20;
    addConnectionEvent('DISCONNECT', `Connection closed. Reconnecting in ${delay} seconds...`);
    clearInterval(behaviorLoop);
    setTimeout(createBot, delay * 1000);
  });
}

// --- 5. Natural Movement Actions Tracker ---
function startNaturalMovement() {
  if (behaviorLoop) clearInterval(behaviorLoop);

  const intervalTime = (settings.bot.actionIntervalSeconds || 8) * 1000;

  behaviorLoop = setInterval(() => {
    if (!bot || !bot.entity) return;

    const action = Math.floor(Math.random() * 6);

    switch (action) {
      case 0:
        liveState.lastAction = 'Forward Walk + Jump';
        addActivityLog('[ACTION] Walking forward and jumping');
        bot.setControlState('forward', true);
        bot.setControlState('jump', true);
        setTimeout(() => {
          bot.setControlState('jump', false);
          bot.setControlState('forward', false);
        }, 1200);
        break;

      case 1:
        const dir = Math.random() > 0.5 ? 'left' : 'right';
        liveState.lastAction = `Strafe (${dir})`;
        addActivityLog(`[ACTION] Stepping ${dir}`);
        bot.setControlState(dir, true);
        setTimeout(() => bot.setControlState(dir, false), 800);
        break;

      case 2:
        liveState.lastAction = 'Looking around';
        addActivityLog('[ACTION] Head rotation (pitch & yaw)');
        const yaw = (Math.random() * 360 - 180) * (Math.PI / 180);
        const pitch = ((Math.random() * 40) - 20) * (Math.PI / 180);
        bot.look(yaw, pitch, true);
        break;

      case 3:
        liveState.lastAction = 'Sneaking (Crouch)';
        addActivityLog('[ACTION] Sneaking for 1.5s');
        bot.setControlState('sneak', true);
        setTimeout(() => bot.setControlState('sneak', false), 1500);
        break;

      case 4:
        liveState.lastAction = 'Swinging arm (Punch)';
        addActivityLog('[ACTION] Arm swing punch animation');
        bot.swingArm('right');
        break;

      case 5:
        liveState.lastAction = 'Backward step + Jump';
        addActivityLog('[ACTION] Step back and jump');
        bot.setControlState('back', true);
        setTimeout(() => {
          bot.setControlState('jump', true);
          setTimeout(() => {
            bot.setControlState('jump', false);
            bot.setControlState('back', false);
          }, 400);
        }, 300);
        break;
    }
  }, intervalTime);
}

createBot();
