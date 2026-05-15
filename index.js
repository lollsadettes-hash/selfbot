const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');
const Groq = require('groq-sdk');
const config = require('./config');

const client = new Client();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tracks each user's state in the flow
const userStates = {};

// ── AI INTENT DETECTOR ────────────────────────────────────────────────────────
// Uses Groq to understand what the user means even with typos or weird phrasing
async function detectIntent(userMessage, expectedOptions) {
  const prompt = `The user is in a Discord DM shop flow. They need to pick one of these options: ${expectedOptions.join(', ')}.
The user wrote: "${userMessage}"
Reply with ONLY the option they most likely meant (exactly as written in the list), or "unknown" if unclear.`;

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
    embeds: [
      {
        title: '📥 New Payment Proof',
        color: 0xf5a623,
        fields: [
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Method', value: paymentMethod, inline: true },
        ],
        image: { url: imageUrl },
        footer: {
          text: `React ✅ to approve and give role | React ❌ to decline`,
        },
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
      const intent = await detectIntent(raw, ['1', '2']);
      if (intent === '1') {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
        userStates[userId] = 'payment_menu';
      } else if (intent === '2') {
        await message.channel.send(config.MESSAGE_OPTION_2);
        userStates[userId] = 'main_menu';
      } else {
        await message.channel.send(config.MESSAGE_WELCOME);
      }
      return;
    }

    // ── PAYMENT MENU ───────────────────────────────────────
    if (state === 'payment_menu') {
      const intent = await detectIntent(raw, ['a', 'b', 'c']);
      if (intent === 'a') {
        await message.channel.send(config.MESSAGE_PAYPAL);
        userStates[userId] = 'waiting_done_paypal';
      } else if (intent === 'b') {
        await message.channel.send(config.MESSAGE_CRYPTO);
        userStates[userId] = 'waiting_done_crypto';
      } else if (intent === 'c') {
        await message.channel.send(config.MESSAGE_ROBUX);
        userStates[userId] = 'waiting_done_robux';
      } else {
        await message.channel.send(config.MESSAGE_PAYMENT_MENU);
      }
      return;
    }

    // ── WAITING DONE - PAYPAL ──────────────────────────────
    if (state === 'waiting_done_paypal') {
      const intent = await detectIntent(raw, ['done', 'b', 'c']);
      if (intent === 'done') {
        await message.channel.send(config.MESSAGE_PROOF);
        userStates[userId] = 'waiting_proof_paypal';
      } else if (intent === 'b') {
        await message.channel.send(config.MESSAGE_CRYPTO);
        userStates[userId] = 'waiting_done_crypto';
      } else if (intent === 'c') {
        await message.channel.send(config.MESSAGE_ROBUX);
        userStates[userId] = 'waiting_done_robux';
      } else {
        await message.channel.send(config.MESSAGE_PAYPAL);
      }
      return;
    }

    // ── WAITING DONE - CRYPTO ──────────────────────────────
    if (state === 'waiting_done_crypto') {
      const intent = await detectIntent(raw, ['done', 'a', 'c']);
      if (intent === 'done') {
        await message.channel.send(config.MESSAGE_PROOF);
        userStates[userId] = 'waiting_proof_crypto';
      } else if (intent === 'a') {
        await message.channel.send(config.MESSAGE_PAYPAL);
        userStates[userId] = 'waiting_done_paypal';
      } else if (intent === 'c') {
        await message.channel.send(config.MESSAGE_ROBUX);
        userStates[userId] = 'waiting_done_robux';
      } else {
        await message.channel.send(config.MESSAGE_CRYPTO);
      }
      return;
    }

    // ── WAITING DONE - ROBUX ───────────────────────────────
    if (state === 'waiting_done_robux') {
      const intent = await detectIntent(raw, ['done', 'a', 'b']);
      if (intent === 'done') {
        await message.channel.send(config.MESSAGE_PROOF);
        userStates[userId] = 'waiting_proof_robux';
      } else if (intent === 'a') {
        await message.channel.send(config.MESSAGE_PAYPAL);
        userStates[userId] = 'waiting_done_paypal';
      } else if (intent === 'b') {
        await message.channel.send(config.MESSAGE_CRYPTO);
        userStates[userId] = 'waiting_done_crypto';
      } else {
        await message.channel.send(config.MESSAGE_ROBUX);
      }
      return;
    }

    // ── WAITING PROOF ──────────────────────────────────────
    if (state.startsWith('waiting_proof')) {
      if (message.attachments.size > 0) {
        const imageUrl = message.attachments.first().url;
        const method = state.includes('paypal') ? 'PayPal' : state.includes('crypto') ? 'Crypto' : 'Robux';
        await sendProofWebhook(message.author, imageUrl, method);
        await message.channel.send(config.MESSAGE_THANKYOU);
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
// When you react ✅ or ❌ on the proof message in the webhook channel
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.id === client.user.id) return;
  if (reaction.message.channel.id !== process.env.GUILD_ID) return;

  const embed = reaction.message.embeds[0];
  if (!embed) return;

  const userField = embed.fields?.find(f => f.name === 'User');
  if (!userField) return;

  const targetUserId = userField.value.match(/\((\d+)\)/)?.[1];
  if (!targetUserId) return;

  const targetUser = await client.users.fetch(targetUserId);
  if (!targetUser) return;

  if (reaction.emoji.name === '✅') {
    // Send invite + give role
    await targetUser.send(`${config.MESSAGE_APPROVED} ${process.env.VAULT_INVITE}`);
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(targetUserId);
      await member.roles.add(process.env.ROLE_ID);
    } catch (e) {
      console.error('Could not assign role:', e);
    }
    userStates[targetUserId] = 'approved';
  } else if (reaction.emoji.name === '❌') {
    await targetUser.send(config.MESSAGE_DECLINED);
    userStates[targetUserId] = 'start';
  }
});

client.login(process.env.DISCORD_TOKEN);
