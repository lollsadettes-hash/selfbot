// index.js — Discord Selfbot (versione stabile, nessun errore di sintassi)
// Imposta le variabili d'ambiente: DISCORD_TOKEN, GROQ_API_KEY, REVIEW_WEBHOOK_URL, ecc.

'use strict';

const { Client, MessageActionRow, MessageButton } = require('discord.js-selfbot-v13');
const client = new Client({ checkUpdate: false });

// =============================== STATI =================================
const STATES = Object.freeze({
  INITIAL:                'INITIAL',
  AWAITING_VIDEO_CONFIRM: 'AWAITING_VIDEO_CONFIRM',
  AWAITING_SUBMENU:       'AWAITING_SUBMENU',
  AWAITING_DONE:          'AWAITING_DONE',
  AWAITING_ATTACHMENT:    'AWAITING_ATTACHMENT',
  AWAITING_REVIEW:        'AWAITING_REVIEW',
});

// =============================== UTILITY ===============================
function errMsg(err) {
  if (err instanceof Error) return err.message;
  return String(err ?? 'errore sconosciuto');
}

function strictInt(str) {
  const n = Number(str);
  return Number.isInteger(n) ? n : NaN;
}

// =============================== WHITELIST =============================
const ALLOWED_USERS = process.env.ALLOWED_USERS
  ? new Set(process.env.ALLOWED_USERS.split(',').map(id => id.trim()))
  : null;
function isUserAllowed(userId) {
  if (!ALLOWED_USERS) return true;
  return ALLOWED_USERS.has(userId);
}

// =============================== GESTIONE STATI (con TTL) ==============
const userStates = new Map();
const STATE_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [uid, s] of userStates) {
    if (now - s.lastActivity > STATE_TTL_MS) userStates.delete(uid);
  }
}, 5 * 60 * 1000).unref();

function setState(userId, stateObj) {
  userStates.set(userId, { ...stateObj, lastActivity: Date.now() });
}

function touchState(userId) {
  const s = userStates.get(userId);
  if (s) s.lastActivity = Date.now();
}

// =============================== TESTI ORIGINALI (VOLGARI) =============
function getInitialMenu() {
  return `Hello , are you interested in 

- 1 : Buying **permanent** 0F access & see the payment options and price
- 2 : Get **info** on the 0F creators & get them listed

> ⚠️ ! Make sure to send one of the two __**numbers**__ to continue`;
}

function getPaymentOptionsMenu() {
  return `If you're interested in buying **permanent** access: 

- **ALL** our payment options ( for you to choose) 

> 1. PayPal
> 2. Crypto
> 3. Robux

- for only the **PRICE** of 
> __**6,80**__ 💸 
> __**700**__ robux

> ⚠️ ! Make sure to send one of the three __**numbers**__ to continue`;
}

function getInfoWithVideo() {
  const VIDEO_URL = "https://media.discordapp.net/attachments/1500775257496358912/1504592638593208392/ScreenRecording_01-20-2026_23-16-07_12_2.mp4?ex=6a078c97&is=6a063b17&hm=9c0944b1cc85d9d3636a647105e4ed65f0dc9b81c52cb6adce16a5c2cf337583&";
  return `For all the **info** on our 0f creators we have : 

- **OVER 100+** for you to enjoy & pleasure yourself with forever listed right under this video.

> ⚠️ ! Make sure to send  __**1**__  to continue with the payment !

${VIDEO_URL}`;
}

function getPaypalInfo() {
  return `To proceed to buy **YOUR** permanent access today *!*

- __PayPal Information__

📧 **Email**

> \`lollsadettes02@gmail.com\`

- __IMPORTANT__
Send as **Friends & Family — no notes**.
If not sent as requested, no refunds will be provided.

> ⚠️ ! Make sure to send  __**finished transaction**__  after sending the money along with the proof of payment , and to use other payment options either send 2 ( crypto info ) or 3 ( Robux info ) !`;
}

function getCryptoInfo() {
  return `To proceed to buy **YOUR** permanent access today *!*

- __Crypto Information__

📧 **LTC Adress**

> \`LfXyPCq5zEEtTLTCnKiZoHiRyyq2qT5Z3Z\`

> ⚠️ ! Make sure to send  ' __**finished transaction**__ ' after sending the money along with the **proof of payment** 
-# ( screenshot of the money being sent , ss of the transaction)
**--**
> and to use other payment options either send 1 ( PayPal info ) or 3 ( Robux info ) !`;
}

function getRobuxInfo() {
  return `To proceed to buy **YOUR** permanent access today *!*

- __Robux Information__

📧 **Gamepass**

> [gamepass](https://www.roblox.com/catalog/15331422342/0F-4CCESS)

> ⚠️ ! Make sure to send  ' __**finished transaction**__ ' after sending the money along with the **proof of payment** 
-# ( screenshot of the money being sent , ss of the transaction)
**--**
> and to use other payment options either send 1 ( PayPal info ) or 2 ( Crypto info ) !`;
}

function getFinalConfirmation() {
  return `** MAKE SURE TO SEND PROOF OF THE PAYMENT IF YOU HAVEN'T ALREADY! ** 
- ( Right below this message. Proof will be reviewed to check it's authentication by staff )

> ** Be patient ** , the vault will be send within 8-14 hours ⌚ *!*`;
}

const SUB_INFO = Object.freeze({
  1: getPaypalInfo(),
  2: getCryptoInfo(),
  3: getRobuxInfo(),
});

// =============================== MESSAGGI CON PULSANTI ==================
function msgInitialMenu() {
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('menu_submenu').setLabel('1️⃣ Acquista').setStyle('PRIMARY'),
    new MessageButton().setCustomId('menu_video').setLabel('2️⃣ Info creators').setStyle('SECONDARY'),
  );
  return { content: getInitialMenu(), components: [row] };
}

function msgSubMenu() {
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('sub_1').setLabel('💸 PayPal').setStyle('PRIMARY'),
    new MessageButton().setCustomId('sub_2').setLabel('₿ Crypto').setStyle('PRIMARY'),
    new MessageButton().setCustomId('sub_3').setLabel('🎮 Robux').setStyle('PRIMARY'),
  );
  return { content: getPaymentOptionsMenu(), components: [row] };
}

function msgVideoConfirm() {
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('video_continue').setLabel('▶ Continua').setStyle('PRIMARY'),
  );
  return { content: getInfoWithVideo(), components: [row] };
}

function msgInfoWithConfirm(text) {
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('confirm_done').setLabel('✅ Conferma pagamento').setStyle('SUCCESS'),
    new MessageButton().setCustomId('confirm_change').setLabel('🔄 Cambia metodo').setStyle('SECONDARY'),
  );
  return { content: text, components: [row] };
}

// =============================== GROQ (opzionale) =======================
async function groqChat(messages, maxTokens = 512, timeoutMs = 10000) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama3-8b-8192', max_tokens: maxTokens, messages }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function classifyIntent(text) {
  const prompt = `Classify intent as one word: menu, submenu, video, option_a, option_b, option_c, confirm, change, reset, unknown. Message: "${text}"`;
  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], 20, 5000);
    const intent = raw.toLowerCase().trim().split(/[\s,.\n]/)[0];
    const valid = ['menu','submenu','video','option_a','option_b','option_c','confirm','change','reset','unknown'];
    return valid.includes(intent) ? intent : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function analyzeAttachment(url, name) {
  try {
    const prompt = `Briefly describe this attachment (max 200 chars). Name: ${name}, URL: ${url}`;
    const result = await groqChat([{ role: 'user', content: prompt }], 80, 8000);
    return result?.slice(0, 200) || null;
  } catch {
    return null;
  }
}

// =============================== AZIONI REALI ===========================
async function assignRoleAndInvite(userId) {
  const guildId = process.env.GUILD_ID;
  const roleId = process.env.ROLE_ID;
  const invite = process.env.VAULT_INVITE;
  if (guildId && roleId) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.roles.add(roleId);
      console.log(`[ROLE] Assegnato ruolo ${roleId} a ${userId}`);
    } catch (err) {
      console.error('[ROLE] Errore:', errMsg(err));
    }
  } else {
    console.log(`[SIM] Ruolo ${roleId ?? 'N/A'} a ${userId}`);
  }
  if (invite) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(`✅ Payment approved! Here is your permanent access:\n${invite}`);
      console.log(`[DM] Invito inviato a ${userId}`);
    } catch (err) {
      console.error('[DM] Errore:', errMsg(err));
    }
  } else {
    console.log(`[SIM] Invio invito: ${invite ?? 'N/A'}`);
  }
}

// =============================== WEBHOOK REVIEW =========================
async function sendReviewWebhook(userId, username, subOption, attachmentInfo, aiAnalysis) {
  const webhookUrl = process.env.REVIEW_WEBHOOK_URL;
  if (!webhookUrl) return false;
  const optionLabel = {1:'PayPal',2:'Crypto',3:'Robux'}[subOption] ?? `Opzione ${subOption}`;
  const firstAtt = attachmentInfo[0];
  const attValue = firstAtt ? `[${firstAtt.name}](${firstAtt.url}) (${(firstAtt.size/1024).toFixed(1)} KB)` : '_nessun allegato_';
  const fields = [
    { name: '👤 Utente', value: username, inline: true },
    { name: '🆔 User ID', value: userId, inline: true },
    { name: '💳 Metodo', value: optionLabel, inline: true },
    { name: '📎 Proof', value: attValue, inline: false },
  ];
  if (aiAnalysis) fields.push({ name: '🤖 AI Analysis', value: aiAnalysis, inline: false });
  const payload = {
    embeds: [{
      title: '💸 Nuova prova di pagamento',
      color: 0x5865F2,
      timestamp: new Date().toISOString(),
      fields,
      footer: { text: 'Staff: Approva o Nega' }
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 3, label: '✅ Approva', custom_id: `review_approve_${userId}` },
        { type: 2, style: 4, label: '❌ Nega', custom_id: `review_deny_${userId}` }
      ]
    }]
  };
  try {
    const res = await fetch(webhookUrl + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleCompletion(channel, userId, username, subOption, attachments) {
  if (!attachments || attachments.size === 0) {
    await channel.send('📎 **Allega uno screenshot della prova di pagamento** prima di completare.');
    return false;
  }
  const attachmentInfo = [];
  for (const [, att] of attachments) {
    console.log(`[ALLEGATO] ${att.name} (${att.size}B) ${att.url}`);
    attachmentInfo.push({ name: att.name, url: att.url, size: att.size });
  }
  let aiAnalysis = null;
  if (process.env.GROQ_ANALYZE_ATTACHMENT === 'true' && process.env.GROQ_API_KEY && attachmentInfo[0]) {
    aiAnalysis = await analyzeAttachment(attachmentInfo[0].url, attachmentInfo[0].name);
  }
  if (process.env.REVIEW_WEBHOOK_URL) {
    const sent = await sendReviewWebhook(userId, username, subOption, attachmentInfo, aiAnalysis);
    if (!sent) {
      await channel.send('⚠️ Errore nell’invio della prova. Riprova.');
      return false;
    }
    setState(userId, { state: STATES.AWAITING_REVIEW, subOption });
    await channel.send('⏳ **Prova inviata!** Lo staff la verificherà. Riceverai il vault entro 8-14 ore.');
    return true;
  } else {
    await assignRoleAndInvite(userId);
    userStates.delete(userId);
    await channel.send(getFinalConfirmation());
    return true;
  }
}

// =============================== COMANDI =================================
async function handleAnalyze(channel, rawArg) {
  if (!process.env.GROQ_API_KEY) return channel.send('⚠️ GROQ_API_KEY mancante.');
  if (!rawArg?.trim()) return channel.send('⚠️ Uso: !analyze <testo>');
  const thinking = await channel.send('🤖 _Analisi in corso…_').catch(() => null);
  try {
    const reply = await groqChat([{ role: 'user', content: rawArg.trim() }]);
    if (!reply) return channel.send('⚠️ Risposta vuota.');
    const out = reply.length > 1900 ? reply.slice(0,1900)+'…_(troncata)_' : reply;
    await channel.send(`🤖 **Risposta AI:**\n\n${out}`);
  } catch (err) {
    await channel.send('⚠️ Errore analisi.');
  } finally {
    thinking?.delete().catch(() => {});
  }
}

async function handleNotify(channel, user) {
  const url = process.env.CALLBACK_URL;
  if (!url) return channel.send('⚠️ CALLBACK_URL non definita.');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user.tag, action: 'test_notification', timestamp: Date.now() })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await channel.send('📡 Notifica inviata.');
  } catch (err) {
    await channel.send(`⚠️ Errore: ${errMsg(err)}`);
  }
}

// =============================== APPLICA INTENT ==========================
async function applyIntent(intent, channel, userId, userState) {
  switch (intent) {
    case 'menu':
      setState(userId, { state: STATES.INITIAL });
      await channel.send(msgInitialMenu());
      return true;
    case 'submenu':
      setState(userId, { state: STATES.AWAITING_SUBMENU });
      await channel.send(msgSubMenu());
      return true;
    case 'video':
      setState(userId, { state: STATES.AWAITING_VIDEO_CONFIRM });
      await channel.send(msgVideoConfirm());
      return true;
    case 'option_a':
    case 'option_b':
    case 'option_c': {
      const optNum = { option_a:1, option_b:2, option_c:3 }[intent];
      setState(userId, { state: STATES.AWAITING_DONE, subOption: optNum });
      await channel.send(msgInfoWithConfirm(SUB_INFO[optNum]));
      return true;
    }
    case 'confirm': {
      const curr = userStates.get(userId);
      if (curr?.state === STATES.AWAITING_ATTACHMENT) return true;
      setState(userId, { state: STATES.AWAITING_ATTACHMENT, subOption: curr?.subOption });
      await channel.send('📎 **Allega la prova del pagamento** (screenshot) per completare.');
      return true;
    }
    case 'change':
      setState(userId, { state: STATES.AWAITING_SUBMENU });
      await channel.send(msgSubMenu());
      return true;
    case 'reset':
      setState(userId, { state: STATES.INITIAL });
      await channel.send(msgInitialMenu());
      return true;
    default:
      return false;
  }
}

// =============================== EVENTI =================================
client.on('ready', () => {
  console.log(`✅ Selfbot online come ${client.user.tag}`);
  console.log(`🔑 GROQ: ${process.env.GROQ_API_KEY ? 'presente' : 'assente'}`);
  console.log(`🔔 Webhook review: ${process.env.REVIEW_WEBHOOK_URL ? 'attivo' : 'disattivo'}`);
  console.log(`👥 Whitelist: ${ALLOWED_USERS ? Array.from(ALLOWED_USERS).join(',') : 'tutti'}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const id = interaction.customId;

  // Pulsanti di review (staff)
  if (id.startsWith('review_approve_') || id.startsWith('review_deny_')) {
    await interaction.deferUpdate().catch(() => {});
    const isApprove = id.startsWith('review_approve_');
    const targetUserId = id.replace(isApprove ? 'review_approve_' : 'review_deny_', '');
    if (isApprove) {
      await assignRoleAndInvite(targetUserId);
      userStates.delete(targetUserId);
      await interaction.channel.send(`✅ Pagamento approvato per <@${targetUserId}>`);
    } else {
      try {
        const user = await client.users.fetch(targetUserId);
        await user.send('❌ La tua prova di pagamento è stata respinta.');
      } catch(e) {}
      userStates.delete(targetUserId);
      await interaction.channel.send(`❌ Pagamento negato per <@${targetUserId}>`);
    }
    return;
  }

  // Altri pulsanti: solo per il proprietario
  if (!interaction.user || interaction.user.id !== client.user.id) return;
  await interaction.deferUpdate().catch(() => {});
  const userId = interaction.user.id;
  touchState(userId);

  try {
    if (id === 'menu_submenu') {
      setState(userId, { state: STATES.AWAITING_SUBMENU });
      await interaction.channel.send(msgSubMenu());
    } else if (id === 'menu_video') {
      setState(userId, { state: STATES.AWAITING_VIDEO_CONFIRM });
      await interaction.channel.send(msgVideoConfirm());
    } else if (id === 'video_continue') {
      setState(userId, { state: STATES.AWAITING_SUBMENU });
      await interaction.channel.send(msgSubMenu());
    } else if (id === 'sub_1' || id === 'sub_2' || id === 'sub_3') {
      const opt = strictInt(id.split('_')[1]);
      setState(userId, { state: STATES.AWAITING_DONE, subOption: opt });
      await interaction.channel.send(msgInfoWithConfirm(SUB_INFO[opt]));
    } else if (id === 'confirm_done') {
      const curr = userStates.get(userId);
      if (curr?.state !== STATES.AWAITING_ATTACHMENT) {
        setState(userId, { state: STATES.AWAITING_ATTACHMENT, subOption: curr?.subOption });
      }
      await interaction.channel.send('📎 **Invia lo screenshot della transazione** (PayPal/Crypto/Robux) come allegato.');
    } else if (id === 'confirm_change') {
      setState(userId, { state: STATES.AWAITING_SUBMENU });
      await interaction.channel.send(msgSubMenu());
    }
  } catch (err) {
    console.error('❌ Errore interazione:', errMsg(err));
  }
});

client.on('messageCreate', async (message) => {
  if (!message.author) return;
  if (message.author.id !== client.user.id) return;
  if (!message.content && message.attachments.size === 0) return;
  if (!isUserAllowed(message.author.id)) return;

  const userId = message.author.id;
  const username = message.author.tag;
  const content = message.content.trim().toLowerCase();
  const channel = message.channel;
  const attachments = message.attachments;

  try {
    if (content === '!reset') {
      setState(userId, { state: STATES.INITIAL });
      await channel.send(msgInitialMenu());
      return;
    }
    if (content.startsWith('!analyze ')) {
      await handleAnalyze(channel, message.content.slice('!analyze '.length));
      return;
    }
    if (content === '!analyze') {
      await channel.send('⚠️ Uso: !analyze <testo>');
      return;
    }
    if (content === '!notify') {
      await handleNotify(channel, message.author);
      return;
    }

    let userState = userStates.get(userId);
    if (!userState) {
      setState(userId, { state: STATES.INITIAL });
      await channel.send(msgInitialMenu());
      return;
    }
    touchState(userId);

    if (userState.state === STATES.AWAITING_REVIEW) {
      await channel.send('⏳ La tua prova è in attesa di verifica. Riceverai il vault entro 8-14 ore. Usa !reset solo per annullare.');
      return;
    }

    const optNum = strictInt(content);

    if (userState.state === STATES.INITIAL) {
      if (content === '1') {
        setState(userId, { state: STATES.AWAITING_SUBMENU });
        await channel.send(msgSubMenu());
        return;
      }
      if (content === '2') {
        setState(userId, { state: STATES.AWAITING_VIDEO_CONFIRM });
        await channel.send(msgVideoConfirm());
        return;
      }
      if (process.env.GROQ_INTENT === 'true' && process.env.GROQ_API_KEY) {
        const intent = await classifyIntent(message.content.trim());
        if (await applyIntent(intent, channel, userId, userState)) return;
      }
      await channel.send('❌ Invia 1 o 2.');
      return;
    }

    if (userState.state === STATES.AWAITING_VIDEO_CONFIRM) {
      if (content === '1') {
        setState(userId, { state: ST
