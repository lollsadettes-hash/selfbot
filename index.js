const { Client } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');
const fs = require('fs');
const config = require('./config');

// ═══════════════════════════════════════════════════════════════
// ENV VARS
//   DISCORD_TOKEN   — selfbot user token
//   GROQ_API_KEY    — Groq API key
//   VAULT_INVITE    — invite link sent to approved users
//   GUILD_ID        — server ID for role assignment
//   ROLE_ID         — role ID to assign after approval
//   OWNER_ID        — (optional) user ID to receive proof DMs
//                     defaults to the selfbot account itself
// ═══════════════════════════════════════════════════════════════

const client = new Client({ checkUpdate: false });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── PERSISTENT STATE ──────────────────────────────────────────
const STATE_FILE = './state.json';

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log('[STATE] Loaded', Object.keys(data.userStates || {}).length, 'user states from disk');
      return data;
    }
  } catch (e) {
    console.error('[STATE] Failed to load state:', e.message);
  }
  return { userStates: {}, userPaymentMethod: {} };
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ userStates, userPaymentMethod }, null, 2));
  } catch (e) {
    console.error('[STATE] Failed to save state:', e.message);
  }
}

const _state = loadState();
const userStates = _state.userStates;
const userPaymentMethod = _state.userPaymentMethod;

// ── HUMANIZE & ANTI-DETECTION ─────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const lastResponseTime = {};
function isRateLimited(userId) {
  const now = Date.now();
  if (lastResponseTime[userId] && now - lastResponseTime[userId] < 2000) return true;
  lastResponseTime[userId] = now;
  return false;
}

function getNightMultiplier() {
  const hour = new Date().getUTCHours();
  if (hour >= 2 && hour < 8) return rand(3, 6);
  return 1;
}

function randomIdleCheck() {
  if (Math.random() < 0.08) {
    client.user.setStatus('idle');
    setTimeout(() => client.user.setStatus('online'), rand(20000, 90000));
  }
}

async function simulateTyping(channel, content) {
  const wpm = rand(40, 70);
  const charsPerMs = (wpm * 5) / 60000;
  const typingMs = Math.min(content.length / charsPerMs, 5000) + rand(200, 800);
  const bursts = Math.ceil(typingMs / 3000);
  for (let i = 0; i < bursts; i++) {
    await channel.sendTyping();
    await sleep(Math.min(typingMs - i * 3000, 3000));
  }
}

async function humanSend(channel, content) {
  const multiplier = getNightMultiplier();
  await sleep(rand(400, 1200) * multiplier);
  if (Math.random() < 0.15) await sleep(rand(1500, 4000) * multiplier);
  await simulateTyping(channel, content);
  return channel.send(content);
}

// messageId → userId
const pendingApprovals = {};

// ── AI FALLBACK ───────────────────────────────────────────────

const VALID_INTENTS = {
  main:         new Set(['buy', 'info', 'unknown']),
  payment:      new Set(['paypal', 'crypto', 'robux', 'back', 'unknown']),
  waiting_done: new Set(['finished', 'paypal', 'crypto', 'robux', 'back', 'unknown']),
};

const SYSTEM_PROMPT =
  'You are a strict one-word intent classifier. ' +
  'You ONLY output a single word from the provided list. ' +
  'No punctuation, no explanation, no extra text whatsoever. ' +
  'If the message does not clearly match any intent, output "unknown".';

const CONTEXT_CONFIG = {
  main: {
    intents: 'buy | info | unknown',
    examples: [
      ['i want to buy something',       'buy'],
      ['purchase',                       'buy'],
      ['how much does it cost',          'buy'],
      ['order one please',               'buy'],
      ['how does it work',               'info'],
      ['what do you sell',               'info'],
      ['tell me more about this',        'info'],
      ['give me more details',           'info'],
      ['what is this',                   'info'],
      ['can i get more info',            'info'],
      ['hello',                          'unknown'],
      ['ok',                             'unknown'],
    ],
  },
  payment: {
    intents: 'paypal | crypto | robux | back | unknown',
    examples: [
      ["i'll pay with paypal",           'paypal'],
      ['paypal please',                  'paypal'],
      ['bitcoin',                        'crypto'],
      ['eth',                            'crypto'],
      ['ethereum',                       'crypto'],
      ['ltc',                            'crypto'],
      ['i want to pay with crypto',      'crypto'],
      ['robux',                          'robux'],
      ['pay with robux',                 'robux'],
      ['go back',                        'back'],
      ['back to menu',                   'back'],
      ['return to main',                 'back'],
      ['nvm go back',                    'back'],
      ['wait actually go back',          'back'],
      ['yes',                            'unknown'],
      ['ok',                             'unknown'],
    ],
  },
  waiting_done: {
    intents: 'finished | paypal | crypto | robux | back | unknown',
    examples: [
      ['i sent the payment',             'finished'],
      ['done paying',                    'finished'],
      ['paid',                           'finished'],
      ['transaction complete',           'finished'],
      ['just sent it',                   'finished'],
      ['i already paid',                 'finished'],
      ['done',                           'finished'],
      ['switch to paypal',               'paypal'],
      ['actually use paypal',            'paypal'],
      ['change to crypto',               'crypto'],
      ['actually bitcoin',               'crypto'],
      ['use robux instead',              'robux'],
      ['go back',                        'back'],
      ['back to payment menu',           'back'],
      ['change method',                  'back'],
      ['wait',                           'unknown'],
      ['ok',                             'unknown'],
    ],
  },
};

async function groqCall(prompt, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await groq.chat.completions.create(
      {
        model:       'llama-3.1-8b-instant',
        messages:    [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
        max_tokens:  6,
        temperature: 0,
      },
      { signal: controller.signal },
    );
    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? '';
    return raw.replace(/[^a-z_]/g, '') || null;
  } catch (e) {
    if (e.name === 'AbortError') console.warn('[GROQ] Timeout — falling back to unknown');
    else console.error('[GROQ] API error:', e.message ?? e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(userMessage, cfg) {
  const exampleLines = cfg.examples
    .map(([msg, label]) => `User: "${msg}"\nIntent: ${label}`)
    .join('\n');
  return (
    `Valid intents: ${cfg.intents}\n\n` +
    `Examples:\n${exampleLines}\n\n` +
    `User: "${userMessage}"\n` +
    `Intent:`
  );
}

async function groqFallback(userMessage, context) {
  const ctxKey = context.startsWith('waiting_done') ? 'waiting_done' : context;
  const cfg    = CONTEXT_CONFIG[ctxKey] ?? CONTEXT_CONFIG.main;
  const valid  = VALID_INTENTS[ctxKey]  ?? VALID_INTENTS.main;
  const prompt = buildPrompt(userMessage, cfg);
  let result = await groqCall(prompt);
  if (result && valid.has(result)) return result;
  if (result && !valid.has(result)) {
    const retryPrompt =
      prompt +
      `\n\nIMPORTANT: "${result}" is not valid. ` +
      `You MUST reply with exactly one of: ${[...valid].join(', ')}`;
    result = await groqCall(retryPrompt, 5000);
    if (result && valid.has(result)) return result;
  }
  return 'unknown';
}

// ── CORE MESSAGE HANDLER (reused for both live and catch-up) ──
async function handleMessage(message) {
  const userId = message.author.id;
  const raw    = message.content.trim();
  const msg    = raw.toLowerCase();
  const state  = userStates[userId] || 'start';

  try {
    if (state === 'start') {
      await humanSend(message.channel, config.MESSAGE_WELCOME);
      userStates[userId] = 'main_menu';
      saveState();
      return;
    }

    if (state === 'main_menu') {
      let intent = null;
      if (msg === '1') intent = 'buy';
      else if (msg === '2') intent = 'info';
      else if (/\bbuy\b|purchas|order/.test(msg)) intent = 'buy';
      else if (/\binfo\b|information|details|what.*sell|how.*work|tell me more/.test(msg)) intent = 'info';
      else intent = await groqFallback(raw, 'main');

      if (intent === 'buy') {
        await humanSend(message.channel, config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
        saveState();
      } else if (intent === 'info') {
        await humanSend(message.channel, config.MESSAGE_OPTION_2);
      } else {
        await humanSend(message.channel, config.MESSAGE_WELCOME);
      }
      return;
    }

    if (state === 'payment_menu') {
      let intent = null;
      if (msg === '1') intent = 'paypal';
      else if (msg === '2') intent = 'crypto';
      else if (msg === '3') intent = 'robux';
      else if (/\bpaypal\b/.test(msg)) intent = 'paypal';
      else if (/\bcrypto\b|\bbitcoin\b|\beth\b|\bethereum\b|\bltc\b/.test(msg)) intent = 'crypto';
      else if (/\brobux\b/.test(msg)) intent = 'robux';
      else if (/\bback\b|\breturn\b|\bmenu\b|\bmain\b/.test(msg)) intent = 'back';
      else intent = await groqFallback(raw, 'payment');

      if (intent === 'paypal') {
        await humanSend(message.channel, config.MESSAGE_PAYPAL);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'PayPal';
        saveState();
      } else if (intent === 'crypto') {
        await humanSend(message.channel, config.MESSAGE_CRYPTO);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'Crypto';
        saveState();
      } else if (intent === 'robux') {
        await humanSend(message.channel, config.MESSAGE_ROBUX);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'Robux';
        saveState();
      } else if (intent === 'back') {
        await humanSend(message.channel, config.MESSAGE_WELCOME);
        userStates[userId] = 'main_menu';
        saveState();
      } else {
        await humanSend(message.channel, config.MESSAGE_PAYMENT_MENU);
      }
      return;
    }

    if (state === 'waiting_done') {
      const currentMethod = userPaymentMethod[userId];
      let intent = null;

      if (['finished transaction', 'done', 'finished', 'paid', 'sent'].includes(msg)) intent = 'finished';
      else if (msg === '1') intent = 'paypal';
      else if (msg === '2') intent = 'crypto';
      else if (msg === '3') intent = 'robux';
      else if (/\bpaypal\b/.test(msg)) intent = 'paypal';
      else if (/\bcrypto\b|\bbitcoin\b|\beth\b|\bethereum\b|\bltc\b/.test(msg)) intent = 'crypto';
      else if (/\brobux\b/.test(msg)) intent = 'robux';
      else if (/\bback\b|\breturn\b|\bchange method\b/.test(msg)) intent = 'back';
      else if (/\bfinish\b|\bdone\b|\bpaid\b|\bsent\b|\bcomplete\b|\btransaction\b/.test(msg)) intent = 'finished';
      else intent = await groqFallback(raw, `waiting_done (user paid with ${currentMethod})`);

      if (intent === 'finished') {
        await humanSend(message.channel, config.MESSAGE_PROOF);
        userStates[userId] = 'waiting_proof';
        saveState();
      } else if (intent === 'paypal') {
        await humanSend(message.channel, config.MESSAGE_PAYPAL);
        userPaymentMethod[userId] = 'PayPal';
        saveState();
      } else if (intent === 'crypto') {
        await humanSend(message.channel, config.MESSAGE_CRYPTO);
        userPaymentMethod[userId] = 'Crypto';
        saveState();
      } else if (intent === 'robux') {
        await humanSend(message.channel, config.MESSAGE_ROBUX);
        userPaymentMethod[userId] = 'Robux';
        saveState();
      } else if (intent === 'back') {
        await humanSend(message.channel, config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
        saveState();
      } else {
        if (currentMethod === 'PayPal')      await humanSend(message.channel, config.MESSAGE_PAYPAL);
        else if (currentMethod === 'Crypto') await humanSend(message.channel, config.MESSAGE_CRYPTO);
        else                                 await humanSend(message.channel, config.MESSAGE_ROBUX);
      }
      return;
    }

    if (state === 'waiting_proof') {
      if (message.attachments.size > 0) {
        const imageUrl = message.attachments.first().url;
        const method   = userPaymentMethod[userId] || 'Unknown';
        await sendProofToDM(message.author, imageUrl, method);
        await humanSend(message.channel, config.MESSAGE_PROOF);
        userStates[userId] = 'pending_approval';
        saveState();
      } else {
        await humanSend(message.channel, '⚠️ Please send a screenshot/image as proof.');
      }
      return;
    }

    if (state === 'pending_approval') {
      await humanSend(message.channel, '⏳ Your proof is still under review. Please wait!');
    }

  } catch (err) {
    console.error('Error handling message:', err);
  }
}

// ── SEND PROOF TO OWNER DM ────────────────────────────────────
async function sendProofToDM(user, imageUrl, paymentMethod) {
  const ownerId = process.env.OWNER_ID ?? client.user.id;
  const owner   = await client.users.fetch(ownerId);
  const dm      = await owner.createDM();

  const msg = await dm.send(
    `💳 **New payment proof received**\n\n` +
    `👤 **User:** ${user.tag} \`${user.id}\`\n` +
    `💳 **Method:** ${paymentMethod}\n` +
    `🖼️ **Proof:** ${imageUrl}\n\n` +
    `> React with ✅ to approve or ❌ to deny`,
  );

  await msg.react('✅');
  await msg.react('❌');
  pendingApprovals[msg.id] = user.id;
  console.log(`[PROOF] Review DM sent for user ${user.tag} (${user.id})`);
}

// ── REACTION HANDLER ─────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.id === client.user.id) return;
  const targetId = pendingApprovals[reaction.message.id];
  if (!targetId) return;
  const emoji = reaction.emoji.name;
  if (emoji !== '✅' && emoji !== '❌') return;

  try {
    const targetUser = await client.users.fetch(targetId);

    if (emoji === '✅') {
      await targetUser.send(`${config.MESSAGE_APPROVED} ${process.env.VAULT_INVITE}`);
      try {
        const guild  = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(targetId).catch(() => null);
        if (member) {
          await member.roles.add(process.env.ROLE_ID);
          console.log(`[APPROVE] Role assigned to ${targetUser.tag}`);
        }
      } catch (e) {
        console.error('[APPROVE] Failed to assign role:', e);
      }
      userStates[targetId] = 'approved';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];
      saveState();
      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n✅ **APPROVED** — invite sent to **${targetUser.tag}**`,
      ).catch(() => {});
      await reaction.message.reactions.removeAll().catch(() => {});
      console.log(`[APPROVE] ✅ ${targetUser.tag} (${targetId})`);
    } else {
      await targetUser.send(config.MESSAGE_DECLINED);
      userStates[targetId] = 'start';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];
      saveState();
      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n❌ **DENIED** — **${targetUser.tag}** has been notified`,
      ).catch(() => {});
      await reaction.message.reactions.removeAll().catch(() => {});
      console.log(`[DENY] ❌ ${targetUser.tag} (${targetId})`);
    }
  } catch (e) {
    console.error('[REACTION] Error:', e);
  }
});

// ── AUTO-ROLE ON GUILD JOIN ───────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== process.env.GUILD_ID) return;
  if (userStates[member.id] !== 'approved') return;
  try {
    await member.roles.add(process.env.ROLE_ID);
    console.log(`[guildMemberAdd] Role assigned to ${member.user.tag} (already approved).`);
  } catch (e) {
    console.error(`[guildMemberAdd] Failed to assign role to ${member.user.tag}:`, e);
  }
});

// ── LIVE MESSAGE HANDLER ──────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;
  if (message.channel.type !== 'DM') return;
  if (isRateLimited(message.author.id)) return;
  randomIdleCheck();
  await handleMessage(message);
});

// ── CATCH-UP ON RESTART ───────────────────────────────────────
// For every user with a saved state, check if their last DM message
// was from them (unanswered) and respond to it
async function catchUpOnRestart() {
  const userIds = Object.keys(userStates);
  if (userIds.length === 0) return;

  console.log(`[CATCHUP] Checking ${userIds.length} users for unanswered messages...`);

  for (const userId of userIds) {
    // Skip users who are already done
    if (userStates[userId] === 'approved') continue;

    try {
      const user    = await client.users.fetch(userId).catch(() => null);
      if (!user) continue;

      const dm      = await user.createDM().catch(() => null);
      if (!dm) continue;

      // Fetch last 5 messages in the DM
      const messages = await dm.messages.fetch({ limit: 5 }).catch(() => null);
      if (!messages || messages.size === 0) continue;

      // Sort by timestamp, get the most recent
      const sorted  = [...messages.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      const last    = sorted[0];

      // If the last message is from the user (not the bot), it's unanswered
      if (last.author.id !== client.user.id) {
        console.log(`[CATCHUP] Unanswered message from ${user.tag} (state: ${userStates[userId]})`);
        // Small delay between each user so it doesn't look like a spam burst
        await sleep(rand(2000, 5000));
        await handleMessage(last);
      }
    } catch (e) {
      console.error(`[CATCHUP] Error for user ${userId}:`, e.message);
    }
  }

  console.log('[CATCHUP] Done.');
}

// ── READY ─────────────────────────────────────────────────────
client.on('ready', async () => {
  const ownerId = process.env.OWNER_ID ?? client.user.id;
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📬 Proof DMs → owner ID: ${ownerId}${!process.env.OWNER_ID ? ' (selfbot itself)' : ''}`);

  // Wait a moment for the client to stabilize, then catch up
  setTimeout(catchUpOnRestart, 3000);
});

client.login(process.env.DISCORD_TOKEN);
