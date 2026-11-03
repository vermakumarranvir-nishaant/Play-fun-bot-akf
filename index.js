const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const express = require('express');

// --- 1. Load settings.json ---
let settings = {
  server: {
    host: "Playfun-C1IM.aternos.me",
    port: 52411,
    version: false
  },
  bot: {
    username: "Nishant_AFK_Bot",
    antiAfk: true,
    actionIntervalSeconds: 7,
    autoChatResponse: true,
    reconnectDelaySeconds: 20
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
    console.log('[CONFIG] settings.json successfully load ho gaya!');
  } catch (err) {
    console.error('[CONFIG ERROR] settings.json read error, using default config:', err.message);
  }
} else {
  console.log('[CONFIG] settings.json nahi mila, default values use ho rahi hain.');
}

// Config variables
const SERVER_HOST = process.env.SERVER_HOST || settings.server.host;
const SERVER_PORT = parseInt(process.env.SERVER_PORT || settings.server.port);
const BOT_NAME = process.env.BOT_NAME || settings.bot.username;
const BOT_VERSION = settings.server.version || false;
const WEB_PORT = process.env.PORT || settings.webServer.port || 3000;

// --- 2. Express Web Server (Render 24/7 Uptime ke liye) ---
const app = express();
app.get('/', (req, res) => {
  res.send(`AFK Bot is running!<br>Connected Server: ${SERVER_HOST}:${SERVER_PORT}<br>Bot Name: ${BOT_NAME}`);
});

app.listen(WEB_PORT, () => {
  console.log(`[WEB SERVER] Listening on port ${WEB_PORT}`);
});

// --- 3. Mineflayer Bot Connection & Actions ---
let bot;
let behaviorLoop = null;

function createBot() {
  console.log(`[BOT] Connecting ${BOT_NAME} to ${SERVER_HOST}:${SERVER_PORT}...`);

  bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_NAME,
    version: BOT_VERSION
  });

  bot.on('spawn', () => {
    console.log(`[SUCCESS] Bot "${BOT_NAME}" server me join ho chuka hai!`);
    bot.chat('Hey! Main Playfun server me aa gaya hoon.');

    if (settings.bot.antiAfk) {
      startNaturalMovement();
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`[CHAT] <${username}>: ${message}`);

    if (!settings.bot.autoChatResponse) return;

    const lower = message.toLowerCase();
    if (lower.includes('hi bot') || lower.includes('hello bot')) {
      bot.chat(`Hello ${username}!`);
    } else if (lower.includes('jump')) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`[KICKED] Server kicked bot: ${reason}`);
    clearInterval(behaviorLoop);
  });

  bot.on('error', (err) => {
    console.error(`[ERROR] Connection error: ${err.message}`);
  });

  bot.on('end', () => {
    const delay = (settings.bot.reconnectDelaySeconds || 20) * 1000;
    console.log(`[DISCONNECTED] Disconnect hua. ${settings.bot.reconnectDelaySeconds || 20}s me reconnect karega...`);
    clearInterval(behaviorLoop);
    setTimeout(createBot, delay);
  });
}

// --- 4. Natural Player Movement & Actions ---
function startNaturalMovement() {
  if (behaviorLoop) clearInterval(behaviorLoop);

  const intervalTime = (settings.bot.actionIntervalSeconds || 7) * 1000;

  behaviorLoop = setInterval(() => {
    if (!bot || !bot.entity) return;

    const action = Math.floor(Math.random() * 6);

    switch (action) {
      case 0:
        // Forward walk + Jump (Sprint-jump feel)
        bot.setControlState('forward', true);
        bot.setControlState('jump', true);
        setTimeout(() => {
          bot.setControlState('jump', false);
          bot.setControlState('forward', false);
        }, 1200);
        break;

      case 1:
        // Left ya Right strafe (sideways step)
        const dir = Math.random() > 0.5 ? 'left' : 'right';
        bot.setControlState(dir, true);
        setTimeout(() => bot.setControlState(dir, false), 800);
        break;

      case 2:
        // Head look around (Natural angle)
        const yaw = (Math.random() * 360 - 180) * (Math.PI / 180);
        const pitch = ((Math.random() * 40) - 20) * (Math.PI / 180);
        bot.look(yaw, pitch, true);
        break;

      case 3:
        // Sneak / Crouch
        bot.setControlState('sneak', true);
        setTimeout(() => bot.setControlState('sneak', false), 1500);
        break;

      case 4:
        // Hand swing (Punch animation)
        bot.swingArm('right');
        break;

      case 5:
        // Backward step + jump
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

// Start bot
createBot();
