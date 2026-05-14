const { Client, MessageActionRow, MessageButton } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');

// ========== HARDCODED ==========
const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = "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";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1504605126642634833/RjC3dEMNeGXo9PD-amE46lbDCpV_E7okOf5jctj51HSpAMdyRTlSOshRKVkScfTnjThE";
const VIDEO_URL = "https://media.discordapp.net/attachments/1500775257496358912/1504592638593208392/ScreenRecording_01-20-2026_23-16-07_12_2.mp4?ex=6a078c97&is=6a063b17&hm=9c0944b1cc85d9d3636a647105e4ed65f0dc9b81c52cb6adce16a5c2cf337583&";
const GUILD_ID = "1425102156125442140";
const ROLE_ID = "1470846965431664640";
const VAULT_INVITE = "https://discord.gg/EDrrayRvhY";
// ===============================

const groq = new Groq({ apiKey: GROQ_API_KEY });
const userStates = new Map();

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

async function interpretIntent(userMessage, currentStep, context) {
    const prompt = `You are an AI assistant for a Discord commerce bot. 
Current step: ${currentStep}.
User message: "${userMessage}"
Context: ${JSON.stringify(context)}
Classify intent: "choice1", "choice2", "payment1", "payment2", "payment3", "finished", "change_method|PayPal", etc. Reply ONLY keyword.`;
    try {
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.2,
            max_tokens: 30
        });
        return response.choices[0].message.content.trim().toLowerCase();
    } catch (err) {
        return null;
    }
}

async function analyzeProof(userMessage, attachmentUrl) {
    const prompt = `Analyze payment proof: extract method, amount, red flags. Keep under 200 chars.`;
    try {
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "system", content: prompt }, { role: "user", content: `Message: ${userMessage}\nAttachment: ${attachmentUrl}` }],
            temperature: 0.3,
            max_tokens: 100
        });
        return response.choices[0].message.content.trim();
    } catch (err) {
        return null;
    }
}

async function sendProofToWebhook(user, paymentMethod, attachmentUrl, userMessageContent, aiSummary = null) {
    const embed = {
        title: "📥 New Payment Proof Received",
        color: 0x2b2d31,
        fields: [
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Payment Method", value: paymentMethod, inline: true },
            { name: "Message", value: userMessageContent.substring(0, 256), inline: false },
            { name: "Proof", value: `[Click to view](${attachmentUrl})`, inline: false }
        ],
        timestamp: new Date().toISOString()
    };
    if (aiSummary) embed.fields.push({ name: "🤖 AI Analysis", value: aiSummary.substring(0, 300), inline: false });

    const approve = new MessageButton().setCustomId(`approve_${user.id}`).setLabel('✅ Approve').setStyle('SUCCESS');
    const deny = new MessageButton().setCustomId(`deny_${user.id}`).setLabel('❌ Deny').setStyle('DANGER');
    const row = new MessageActionRow().addComponents(approve, deny);

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed], components: [row] })
        });
        return res.ok;
    } catch (err) {
        return false;
    }
}

async function handleApproval(userId) {
    const client = global.selfbotClient;
    try {
        const user = await client.users.fetch(userId);
        if (!user) return false;
        await user.send(`✅ Your payment has been approved! Here is your permanent access:\n${VAULT_INVITE}`);
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) await member.roles.add(ROLE_ID);
        }
        return true;
    } catch (err) {
        return false;
    }
}

const client = new Client({ checkUpdate: false });
global.selfbotClient = client;

client.on('ready', () => console.log(`✅ Selfbot online as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const id = interaction.customId;
    if (id.startsWith('approve_')) {
        await handleApproval(id.replace('approve_', ''));
        await interaction.reply({ content: '✅ Approved!', ephemeral: true });
    } else if (id.startsWith('deny_')) {
        await interaction.reply({ content: '❌ Denied.', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id || message.channel.type !== 'DM') return;
    const userId = message.author.id;
    const content = message.content.trim();
    const lower = content.toLowerCase();
    let state = userStates.get(userId) || { step: 'initial', history: [] };
    if (lower === '!reset') {
        userStates.delete(userId);
        await message.reply('Reset.');
        return;
    }
    state.history = state.history || [];
    state.history.push(content.slice(0, 200));
    if (state.history.length > 6) state.history.shift();
    let action = null;
    const step = state.step;

    if (step === 'initial') {
        await message.reply(getInitialMenu());
        userStates.set(userId, { step: 'awaiting_choice', history: state.history });
        return;
    }
    if (step === 'awaiting_choice') {
        if (lower === '1') action = 'choice1';
        else if (lower === '2') action = 'choice2';
        if (!action) {
            const intent = await interpretIntent(content, step, { history: state.history });
            if (intent === 'choice1') action = 'choice1';
            else if (intent === 'choice2') action = 'choice2';
        }
        if (action === 'choice1') {
            await message.reply(getPaymentOptionsMenu());
            userStates.set(userId, { step: 'awaiting_payment_method', history: state.history });
        } else if (action === 'choice2') {
            await message.reply(getInfoWithVideo());
            userStates.set(userId, { step: 'awaiting_continue_after_info', history: state.history });
        } else await message.reply("❌ Send 1 or 2.");
        return;
    }
    if (step === 'awaiting_continue_after_info') {
        if (lower === '1' || (await interpretIntent(content, step, {})) === 'payment1') {
            await message.reply(getPaymentOptionsMenu());
            userStates.set(userId, { step: 'awaiting_payment_method', history: state.history });
        } else await message.reply("❌ Send 1 to continue.");
        return;
    }
    if (step === 'awaiting_payment_method') {
        if (lower === '1') action = 'payment1';
        else if (lower === '2') action = 'payment2';
        else if (lower === '3') action = 'payment3';
        if (!action) {
            const intent = await interpretIntent(content, step, { history: state.history });
            if (intent === 'payment1') action = 'payment1';
            else if (intent === 'payment2') action = 'payment2';
            else if (intent === 'payment3') action = 'payment3';
        }
        if (action === 'payment1') {
            await message.reply(getPaypalInfo());
            userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'PayPal', history: state.history });
        } else if (action === 'payment2') {
            await message.reply(getCryptoInfo());
            userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'Crypto', history: state.history });
        } else if (action === 'payment3') {
            await message.reply(getRobuxInfo());
            userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'Robux', history: state.history });
        } else await message.reply("❌ Send 1,2,3.");
        return;
    }
    if (step === 'awaiting_payment_confirmation') {
        if (lower === '1') action = 'change_method|PayPal';
        else if (lower === '2') action = 'change_method|Crypto';
        else if (lower === '3') action = 'change_method|Robux';
        else if (lower.includes('finished transaction')) action = 'finished';
        if (!action) {
            const intent = await interpretIntent(content, step, { history: state.history, paymentMethod: state.paymentMethod });
            if (intent === 'finished') action = 'finished';
            else if (intent.startsWith('change_method')) action = intent;
        }
        if (action && action.startsWith('change_method')) {
            const newMethod = action.split('|')[1];
            if (newMethod === 'PayPal') await message.reply(getPaypalInfo());
            else if (newMethod === 'Crypto') await message.reply(getCryptoInfo());
            else if (newMethod === 'Robux') await message.reply(getRobuxInfo());
            userStates.set(userId, { ...state, paymentMethod: newMethod, history: state.history });
            return;
        }
        if (action === 'finished') {
            if (!message.attachments || message.attachments.size === 0) {
                await message.reply('❌ Attach a screenshot proof and send `finished transaction` again.');
                return;
            }
            const att = message.attachments.first();
            const aiSummary = await analyzeProof(content, att.url);
            const ok = await sendProofToWebhook(message.author, state.paymentMethod || 'Unknown', att.url, content, aiSummary);
            await message.reply(ok ? getFinalConfirmation() : '❌ Failed to send proof.');
            userStates.delete(userId);
            return;
        }
        await message.reply("❌ Send `finished transaction` with your proof attached, or change method with 1/2/3.");
        return;
    }
    await message.reply('Error. Use !reset');
});

client.login(TOKEN).catch(console.error);
