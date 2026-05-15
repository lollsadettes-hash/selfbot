const { Client } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');
const config = require('./config');

// ── FIX #1: Intents espliciti per ricevere i DM ──────────────────────────────
const client = new Client({
  checkUpdate: false,
  readyStatus: false,
  // selfbot v13 usa ancora i bitmask numerici
  ws: { properties: { $browser: 'Discord iOS' } },
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const userStates = {};
const userPaymentMethod = {};
const pendingApprovals = {};

// ── DEBUG HELPER ──────────────────────────────────────────────────────────────
function log(tag, ...args) {
  console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);
}

// ── AI FALLBACK ───────────────────────────────────────────────────────────────
async function groqFallback(userMessage, context) {
  let validOptions = '';
  let examples = '';

  if (context === 'main') {
    validOptions = '"buy" or "info"';
    examples = `
Examples:
- "i want to buy" → buy
- "purchase" → buy
- "how does it work" → info
- "what do you sell" → info
- "tell me more" → info
- "back to info" → info
- "actually info" → info
- "show me info" → info
- "wait no info" → info
- "go back to info" → info`;
  } else if (context === 'payment') {
    validOptions = '"paypal", "crypto", "robux", or "back"';
    examples = `
Examples:
- "i'll pay with paypal" → paypal
- "bitcoin" → crypto
- "ethereum" → crypto
- "pay with robux" → robux
- "go back" → back
- "back to menu" → back
- "wait no go back" → back
- "back to main" → back
- "actually go back" → back
- "nvm back" → back
- "return to menu" → back`;
  } else {
    validOptions = '"finished", "paypal", "crypto", "robux", or "back"';
    examples = `
Examples:
- "i sent the payment" → finished
- "done paying" → finished
- "transaction complete" → finished
- "paid" → finished
- "switch to paypal" → paypal
- "actually crypto" → crypto
- "change to robux" → robux
- "go back" → back
- "back to payment menu" → back
- "wait no go back" → back
- "actually go back" → back
- "nvm back" → back
- "return" → back`;
  }

  const prompt = `You are an intent classifier for a Discord shop bot.
The user is in this context: ${context}.
Valid intents: ${validOptions}.
${examples}

User message: "${userMessage}"

Reply with ONLY one word from the valid intents list. If nothing matches, reply "unknown".`;

  log('GROQ', `Calling AI — context: ${context} | message: "${userMessage}"`);

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 10,
    temperature: 0,
  });

  const intent = response.choices[0]?.message?.content?.trim().toLowerCase() || 'unknown';
  log('GROQ', `AI intent → "${intent}"`);
  return intent;
}

// ── SEND PROOF MESSAGE WITH REACTIONS ─────────────────────────────────────────
async function sendProofMessage(user, imageUrl, paymentMethod) {
  log('PROOF', `Sending proof for ${user.tag} via ${paymentMethod}`);
  const channel = await client.channels.fetch('1504604985663553586');

  const msg = await channel.send(
    `✨ **new payment incoming!!** ✨\n` +
    `🩷 **payment proof received !**\n` +
    `👤 **user:** ${user.tag} \`${user.id}\`\n` +
    `💳 **method:** ${paymentMethod}\n` +
    `${imageUrl}\n\n` +
    `> React with ✅ to approve or ❌ to decline`
  );

  await msg.react('✅');
  await msg.react('❌');

  pendingApprovals[msg.id] = user.id;
  log('PROOF', `Proof message sent — id: ${msg.id}`);
}

// ── REACTION HANDLER ──────────────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.id === client.user.id) return;

  const targetId = pendingApprovals[reaction.message.id];
  if (!targetId) return;

  const emoji = reaction.emoji.name;
  if (emoji !== '✅' && emoji !== '❌') return;

  log('REACTION', `${emoji} from ${user.tag} on message ${reaction.message.id} → targetUser: ${targetId}`);

  try {
    const targetUser = await client.users.fetch(targetId);

    if (emoji === '✅') {
      await targetUser.send(`${config.MESSAGE_APPROVED} ${process.env.VAULT_INVITE}`);

      try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(targetId).catch(() => null);
        if (member) {
          await member.roles.add(process.env.ROLE_ID);
          log('ROLE', `Role assigned to ${targetUser.tag}`);
        } else {
          log('ROLE', `Member not in guild yet — will assign on join`);
        }
      } catch (e) {
        console.error('Could not assign role:', e);
      }

      userStates[targetId] = 'approved';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];

      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n✅ **APPROVED** — invite sent + role assigned to **${targetUser.tag}**!`
      );
      await reaction.message.reactions.removeAll().catch(() => {});

    } else if (emoji === '❌') {
      await targetUser.send(config.MESSAGE_DECLINED);

      userStates[targetId] = 'start';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];

      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n❌ **DECLINED** — **${targetUser.tag}** has been notified.`
      );
      await reaction.message.reactions.removeAll().catch(() => {});
    }
  } catch (e) {
    console.error('Reaction handler error:', e);
  }
});

// ── AUTO-ROLE ON GUILD JOIN ───────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== process.env.GUILD_ID) return;
  if (userStates[member.id] !== 'approved') return;

  try {
    await member.roles.add(process.env.ROLE_ID);
    log('ROLE', `[guildMemberAdd] Role assigned to ${member.user.tag} (pre-approved).`);
  } catch (e) {
    console.error(`[guildMemberAdd] Could not assign role to ${member.user.tag}:`, e);
  }
});

// ── READY ─────────────────────────────────────────────────────────────────────
client.on('ready', () => {
  log('READY', `Logged in as ${client.user.tag} (${client.user.id})`);
  log('READY', `Listening for DMs...`);
});

// ── FIX #2: Catch errori di connessione ───────────────────────────────────────
client.on('error', (err) => {
  console.error('[WS ERROR]', err);
});

client.on('warn', (msg) => {
  console.warn('[WARN]', msg);
});

// ── MAIN MESSAGE HANDLER ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  // ── FIX #3: Log ogni messaggio ricevuto per verificare che l'evento scatti ──
  log('MSG', `From: ${message.author.tag} | Channel type: ${message.channel.type} | Content: "${message.content}"`);

  if (message.author.id === client.user.id) return;

  // ── FIX #4: 'DM' → tipo corretto per selfbot v13 ─────────────────────────
  // In selfbot v13 il tipo dei canali DM è la stringa 'DM' oppure il numero 1
  const isDM = message.channel.type === 'DM' || message.channel.type === 1;
  if (!isDM) {
    log('MSG', `Ignored — not a DM (type: ${message.channel.type})`);
    return;
  }

  const userId = message.author.id;
  const raw = message.content.trim();
  const msg = raw.toLowerCase();
  const state = userStates[userId] || 'start';

  log('STATE', `User ${message.author.tag} | state: "${state}" | msg: "${raw}"`);

  try {
    if (state === 'start') {
      await message.channel.send(config.MESSAGE_WELCOME);
      userStates[userId] = 'main_menu';
      return;
    }

    if (state === 'main_menu') {
      let intent = null;

      if (msg === '1') intent = 'buy';
      else if (msg === '2') intent = 'info';
      else if (/\bbuy\b|purchas|order/.test(msg)) intent = 'buy';
      else if (/\binfo\b|information|details|what.*sell|how.*work|tell me more/.test(msg)) intent = 'info';
      else intent = await groqFallback(raw, 'main');

      log('INTENT', `main_menu → "${intent}"`);

      if (intent === 'buy') {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
      } else if (intent === 'info') {
        await message.channel.send(config.MESSAGE_OPTION_2);
      } else {
        await message.channel.send(config.MESSAGE_WELCOME);
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

      log('INTENT', `payment_menu → "${intent}"`);

      if (intent === 'paypal') {
        await message.channel.send(config.MESSAGE_PAYPAL);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'PayPal';
      } else if (intent === 'crypto') {
        await message.channel.send(config.MESSAGE_CRYPTO);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'Crypto';
      } else if (intent === 'robux') {
        await message.channel.send(config.MESSAGE_ROBUX);
        userStates[userId] = 'waiting_done';
        userPaymentMethod[userId] = 'Robux';
      } else if (intent === 'back') {
        await message.channel.send(config.MESSAGE_WELCOME);
        userStates[userId] = 'main_menu';
      } else {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
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

      log('INTENT', `waiting_done → "${intent}"`);

      if (intent === 'finished') {
        await message.channel.send(config.MESSAGE_PROOF);
        userStates[userId] = 'waiting_proof';
      } else if (intent === 'paypal') {
        await message.channel.send(config.MESSAGE_PAYPAL);
        userPaymentMethod[userId] = 'PayPal';
      } else if (intent === 'crypto') {
        await message.channel.send(config.MESSAGE_CRYPTO);
        userPaymentMethod[userId] = 'Crypto';
      } else if (intent === 'robux') {
        await message.channel.send(config.MESSAGE_ROBUX);
        userPaymentMethod[userId] = 'Robux';
      } else if (intent === 'back') {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
      } else {
        if (currentMethod === 'PayPal') await message.channel.send(config.MESSAGE_PAYPAL);
        else if (currentMethod === 'Crypto') await message.channel.send(config.MESSAGE_CRYPTO);
        else await message.channel.send(config.MESSAGE_ROBUX);
      }
      return;
    }

    if (state === 'waiting_proof') {
      if (message.attachments.size > 0) {
        const imageUrl = message.attachments.first().url;
        const method = userPaymentMethod[userId] || 'Unknown';
        await sendProofMessage(message.author, imageUrl, method);
        // ── FIX #5: Era MESSAGE_PROOF (sbagliato), ora manda il messaggio corretto
        await message.channel.send(config.MESSAGE_PROOF_RECEIVED ?? '✅ Proof received! Please wait for approval.');
        userStates[userId] = 'pending_approval';
      } else {
        await message.channel.send('⚠️ Please send a screenshot/image as proof.');
      }
      return;
    }

    if (state === 'pending_approval') {
      await message.channel.send('⏳ Your proof is still under review. Please wait!');
    }

  } catch (err) {
    console.error('[ERROR] Message handler:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
