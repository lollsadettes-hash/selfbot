const { Client } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');
const config = require('./config');

const client = new Client();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const userStates = {};
const userPaymentMethod = {};

// messageId → userId  (per sapere quale utente approvare/rifiutare)
const pendingApprovals = {};

// ── AI FALLBACK ───────────────────────────────────────────────────────────────
async function groqFallback(userMessage, context) {
  const prompt = `Discord shop bot. Context: ${context}
User wrote: "${userMessage}"
Reply with ONLY one word: ${context.includes('main') ? '"buy" or "info"' : context.includes('payment') ? '"paypal", "crypto", "robux", or "back"' : '"finished", "paypal", "crypto", "robux", or "back"'}
If nothing matches, reply "unknown".`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 10,
    temperature: 0,
  });

  return response.choices[0]?.message?.content?.trim().toLowerCase() || 'unknown';
}

// ── SEND PROOF MESSAGE CON REACTION (selfbot → payments channel) ──────────────
async function sendProofMessage(user, imageUrl, paymentMethod) {
  const channel = await client.channels.fetch('1504604985663553586');

  const msg = await channel.send(
    `✨ **new payment incoming!!** ✨\n` +
    `🩷 **payment proof received !**\n` +
    `👤 **user:** ${user.tag} \`${user.id}\`\n` +
    `💳 **method:** ${paymentMethod}\n` +
    `${imageUrl}\n\n` +
    `> Reagisci con ✅ per approvare o ❌ per rifiutare`
  );

  // Il selfbot aggiunge le reaction al messaggio
  await msg.react('✅');
  await msg.react('❌');

  // Salva il mapping messageId → userId
  pendingApprovals[msg.id] = user.id;
}

// ── REACTION HANDLER ──────────────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  // Ignora le reaction del selfbot stesso
  if (user.id === client.user.id) return;

  // Controlla se è un messaggio di pagamento pendente
  const targetId = pendingApprovals[reaction.message.id];
  if (!targetId) return;

  const emoji = reaction.emoji.name;

  if (emoji !== '✅' && emoji !== '❌') return;

  try {
    const targetUser = await client.users.fetch(targetId);

    if (emoji === '✅') {
      // ── APPROVE ──
      await targetUser.send(`${config.MESSAGE_APPROVED} ${process.env.VAULT_INVITE}`);

      try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(targetId);
        await member.roles.add(process.env.ROLE_ID);
      } catch (e) {
        console.error('Could not assign role:', e);
      }

      userStates[targetId] = 'approved';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];

      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n✅ **APPROVED** — invite inviato + ruolo assegnato a **${targetUser.tag}**!`
      );
      // Rimuove tutte le reaction
      await reaction.message.reactions.removeAll().catch(() => {});

    } else if (emoji === '❌') {
      // ── DECLINE ──
      await targetUser.send(config.MESSAGE_DECLINED);

      userStates[targetId] = 'start';
      delete userPaymentMethod[targetId];
      delete pendingApprovals[reaction.message.id];

      await reaction.message.edit(
        reaction.message.content.split('\n> ')[0] +
        `\n\n❌ **DECLINED** — **${targetUser.tag}** è stato notificato.`
      );
      await reaction.message.reactions.removeAll().catch(() => {});
    }
  } catch (e) {
    console.error('Reaction handler error:', e);
  }
});

// ── MAIN MESSAGE HANDLER ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;
  if (message.channel.type !== 'DM') return;

  const userId = message.author.id;
  const raw = message.content.trim();
  const msg = raw.toLowerCase();
  const state = userStates[userId] || 'start';

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
      else intent = await groqFallback(raw, 'main menu: 1=buy, 2=info');

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
      else if (msg === 'back' || msg === 'menu') intent = 'back';
      else intent = await groqFallback(raw, 'payment menu: 1=paypal, 2=crypto, 3=robux, back=main menu');

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

      if (msg === 'finished transaction' || msg === 'done' || msg === 'finished') intent = 'finished';
      else if (msg === '1') intent = 'paypal';
      else if (msg === '2') intent = 'crypto';
      else if (msg === '3') intent = 'robux';
      else if (msg === 'back') intent = 'back';
      else intent = await groqFallback(raw, `user paid with ${currentMethod}, waiting for "finished transaction" or switch method`);

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
        await message.channel.send(config.MESSAGE_PROOF);
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
    console.error('Error handling message:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
