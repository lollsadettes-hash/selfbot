const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');
const Groq = require('groq-sdk');
const config = require('./config');

const client = new Client();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const userStates = {};
const userPaymentMethod = {};

// ── AI FALLBACK (only for weird/natural language input) ───────────────────────
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

// ── WEBHOOK SENDER ────────────────────────────────────────────────────────────
async function sendProofWebhook(user, imageUrl, paymentMethod) {
  await axios.post(process.env.REVIEW_WEBHOOK_URL, {
    content: `React ✅ to **approve** (send invite + role) | React ❌ to **decline**`,
    embeds: [
      {
        title: '📥 New Payment Proof',
        color: 0xf5a623,
        fields: [
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Payment Method', value: paymentMethod, inline: true },
        ],
        image: { url: imageUrl },
      },
    ],
  });
}

// ── MAIN MESSAGE HANDLER ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;
  if (message.channel.type !== 'DM') return;

  const userId = message.author.id;
  const raw = message.content.trim();
  const msg = raw.toLowerCase();
  const state = userStates[userId] || 'start';

  try {

    // ── START ──────────────────────────────────────────────
    if (state === 'start') {
      await message.channel.send(config.MESSAGE_WELCOME);
      userStates[userId] = 'main_menu';
      return;
    }

    // ── MAIN MENU → 1 = buy, 2 = info ─────────────────────
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
        // stays on main_menu, user sends 1 to continue
      } else {
        await message.channel.send(config.MESSAGE_WELCOME);
      }
      return;
    }

    // ── PAYMENT MENU → 1 = PayPal, 2 = Crypto, 3 = Robux ──
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

    // ── WAITING DONE → "finished transaction" or switch method
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

    // ── WAITING PROOF ──────────────────────────────────────
    if (state === 'waiting_proof') {
      if (message.attachments.size > 0) {
        const imageUrl = message.attachments.first().url;
        const method = userPaymentMethod[userId] || 'Unknown';
        await sendProofWebhook(message.author, imageUrl, method);
        await message.channel.send(config.MESSAGE_PROOF);
        userStates[userId] = 'pending_approval';
      } else {
        await message.channel.send('⚠️ Please send a screenshot/image as proof.');
      }
      return;
    }

    // ── PENDING APPROVAL ───────────────────────────────────
    if (state === 'pending_approval') {
      await message.channel.send('⏳ Your proof is still under review. Please wait!');
    }

  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// ── WEBHOOK REACTION HANDLER ──────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.id === client.user.id) return;

  const embed = reaction.message.embeds[0];
  if (!embed) return;

  const userField = embed.fields?.find(f => f.name === 'User');
  if (!userField) return;

  const targetUserId = userField.value.match(/\((\d+)\)/)?.[1];
  if (!targetUserId) return;

  const targetUser = await client.users.fetch(targetUserId);
  if (!targetUser) return;

  if (reaction.emoji.name === '✅') {
    await targetUser.send(`${config.MESSAGE_APPROVED} ${process.env.VAULT_INVITE}`);
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(targetUserId);
      await member.roles.add(process.env.ROLE_ID);
    } catch (e) {
      console.error('Could not assign role:', e);
    }
    userStates[targetUserId] = 'approved';
    delete userPaymentMethod[targetUserId];
  } else if (reaction.emoji.name === '❌') {
    await targetUser.send(config.MESSAGE_DECLINED);
    userStates[targetUserId] = 'start';
    delete userPaymentMethod[targetUserId];
  }
});

client.login(process.env.DISCORD_TOKEN);
