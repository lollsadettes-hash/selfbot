const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');
const Groq = require('groq-sdk');
const config = require('./config');

const client = new Client();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tracks each user's state AND payment method
const userStates = {};
const userPaymentMethod = {};

// ── AI INTENT DETECTOR ────────────────────────────────────────────────────────
async function detectIntent(userMessage, expectedOptions, context) {
  const prompt = `You are helping a Discord shop bot understand what a user wants.
Current step: ${context}
Available options: ${expectedOptions.join(', ')}
The user wrote: "${userMessage}"

Match what the user means to one of the available options, even if they use slang, typos, or different phrasing.
Examples:
- "go back", "back", "return", "menu", "main menu" → "back"
- "info", "tell me more", "what is it" → "info"
- "paypal", "pp", "pay pal", "1" → "paypal"
- "crypto", "btc", "ltc", "coin", "2" → "crypto"
- "robux", "roblox", "rbx", "3" → "robux"
- "done", "finished", "paid", "sent", "finish transaction", "finished transaction", "i paid", "payment done" → "finished transaction"

Reply with ONLY the matching option from the list, or "unknown" if nothing matches.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 15,
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
  const state = userStates[userId] || 'start';

  try {
    // ── START ──────────────────────────────────────────────
    if (state === 'start') {
      await message.channel.send(config.MESSAGE_WELCOME);
      userStates[userId] = 'main_menu';
      return;
    }

    // ── MAIN MENU ──────────────────────────────────────────
    if (state === 'main_menu') {
      const intent = await detectIntent(raw, ['buy', 'info'], 'Main menu: buy permanent access or get info');
      if (intent === 'buy' || intent === '1') {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
      } else if (intent === 'info' || intent === '2') {
        await message.channel.send(config.MESSAGE_OPTION_2);
        userStates[userId] = 'main_menu';
      } else {
        await message.channel.send(config.MESSAGE_WELCOME);
      }
      return;
    }

    // ── PAYMENT MENU ───────────────────────────────────────
    if (state === 'payment_menu') {
      const intent = await detectIntent(raw, ['paypal', 'crypto', 'robux', 'back'], 'Choose a payment method: PayPal, Crypto, Robux, or go back to main menu');
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

    // ── WAITING FOR "finished transaction" ─────────────────
    if (state === 'waiting_done') {
      const currentMethod = userPaymentMethod[userId];
      const intent = await detectIntent(raw, ['finished transaction', 'paypal', 'crypto', 'robux', 'back'], `User chose ${currentMethod}. They can confirm payment, switch method, or go back`);

      if (intent === 'finished transaction') {
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
        // Resend current method instructions
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
