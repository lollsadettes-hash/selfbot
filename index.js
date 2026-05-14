// Selfbot che invia proof a webhook con bottoni Approva/Nega
const { Client, MessageActionRow, MessageButton } = require('discord.js-selfbot-v13');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');

// ========== HARDCODED (solo DISCORD_TOKEN in env) ==========
const TOKEN = process.env.DISCORD_TOKEN;   // UNICA variabile su Railway
const GROQ_API_KEY = "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";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1504605126642634833/RjC3dEMNeGXo9PD-amE46lbDCpV_E7okOf5jctj51HSpAMdyRTlSOshRKVkScfTnjThE";
const VIDEO_URL = "https://media.discordapp.net/attachments/1500775257496358912/1504592638593208392/ScreenRecording_01-20-2026_23-16-07_12_2.mp4?ex=6a078c97&is=6a063b17&hm=9c0944b1cc85d9d3636a647105e4ed65f0dc9b81c52cb6adce16a5c2cf337583&";
const GUILD_ID = "1425102156125442140";
const ROLE_ID = "1470846965431664640";
const VAULT_INVITE = "https://discord.gg/EDrrayRvhY";
// ============================================================

const groq = new Groq({ apiKey: GROQ_API_KEY });
const userStates = new Map(); // { step, paymentMethod?, history[] }

// ---------- MESSAGGI VENDITA (IDENTICI ALLA SPECIFICA) ----------
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

// ---------- AI INTENT E ANALISI ----------
async function interpretIntent(userMessage, currentStep, context) {
    const prompt = `You are an AI assistant for a legitimate Discord commerce bot. 
Current step: ${currentStep}.
User message: "${userMessage}"
Previous context: ${JSON.stringify(context)}

Classify intent into:
- "choice1" : wants to buy (like "1")
- "choice2" : wants info (like "2")
- "payment1" : chooses PayPal
- "payment2" : chooses Crypto
- "payment3" : chooses Robux
- "finished" : confirms payment (like "finished transaction")
- "change_method|PayPal" etc.
Reply ONLY with keyword.`;

    try {
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.2,
            max_tokens: 30
        });
        return response.choices[0].message.content.trim().toLowerCase();
    } catch (err) {
        console.error("Groq error:", err);
        return null;
    }
}

async function analyzeProof(userMessage, attachmentUrl) {
    const prompt = `Analyze payment proof: extract payment method, amount, red flags. Keep under 200 chars.
Message: "${userMessage}"
Attachment: ${attachmentUrl}`;
    try {
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.3,
            max_tokens: 100
        });
        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error("AI analysis error:", err);
        return null;
    }
}

// ---------- INVIO PROOF AL WEBHOOK CON BOTTONI ----------
async function sendProofToWebhook(user, paymentMethod, attachmentUrl, userMessageContent, aiSummary = null) {
    const embed = {
        title: "📥 New Payment Proof Received",
        color: 0x2b2d31,
        fields: [
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Payment Method", value: paymentMethod, inline: true },
            { name: "Original Message", value: userMessageContent.substring(0, 256), inline: false },
            { name: "Proof", value: `[Click to view](${attachmentUrl})`, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Staff: use buttons below to approve/deny" }
    };
    if (aiSummary) {
        embed.fields.push({ name: "🤖 AI Analysis", value: aiSummary.substring(0, 300), inline: false });
    }

    // Bottoni Approva/Nega con customId che include l'ID dell'utente
    const approveButton = new MessageButton()
        .setCustomId(`approve_${user.id}`)
        .setLabel('✅ Approve')
        .setStyle('SUCCESS');
    const denyButton = new MessageButton()
        .setCustomId(`deny_${user.id}`)
        .setLabel('❌ Deny')
        .setStyle('DANGER');
    const row = new MessageActionRow().addComponents(approveButton, denyButton);

    const payload = {
        embeds: [embed],
        components: [row]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error("Webhook error:", error);
        return false;
    }
}

// ---------- ASSEGNA RUOLO E INVIA INVITO ----------
async function handleApproval(userId) {
    const client = global.selfbotClient;
    try {
        const user = await client.users.fetch(userId);
        if (!user) return false;
        
        // Invia invito in DM
        await user.send(`✅ Your payment has been approved! Here is your permanent access to the vault:\n${VAULT_INVITE}`);
        
        // Assegna ruolo nel server
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                await member.roles.add(ROLE_ID);
                console.log(`✅ Role added to ${user.tag}`);
            } else {
                console.log(`⚠️ User ${user.tag} not in guild, invite sent but role not assigned.`);
            }
        }
        return true;
    } catch (err) {
        console.error("Approval error:", err);
        return false;
    }
}

// ---------- SELFBOT ----------
const client = new Client({ checkUpdate: false });
global.selfbotClient = client; // per accesso in handleApproval

client.on('ready', () => {
    console.log(`✅ Selfbot online as ${client.user.tag}`);
    console.log("🤖 Groq AI active");
    console.log("📨 Listening for button interactions...");
});

// Ascolta le interazioni dei bottoni
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    if (customId.startsWith('approve_')) {
        const userId = customId.replace('approve_', '');
        await handleApproval(userId);
        await interaction.reply({ content: `✅ Approved! User will receive the vault invite.`, ephemeral: true });
    } else if (customId.startsWith('deny_')) {
        const userId = customId.replace('deny_', '');
        await interaction.reply({ content: `❌ Denied. No action taken.`, ephemeral: true });
    }
});

// Gestione DM per la vendita (identica al codice precedente)
client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id || message.channel.type !== 'DM') return;

    const userId = message.author.id;
    const content = message.content.trim();
    const lowerContent = content.toLowerCase();
    let state = userStates.get(userId) || { step: 'initial', history: [] };

    if (lowerContent === '!reset') {
        userStates.delete(userId);
        await message.reply('Conversation reset. Start again!');
        return;
    }

    state.history = state.history || [];
    state.history.push({ role: 'user', content: content.slice(0, 200) });
    if (state.history.length > 6) state.history.shift();

    let action = null;
    const currentStep = state.step;

    if (currentStep === 'initial') {
        await message.reply(getInitialMenu());
        userStates.set(userId, { step: 'awaiting_choice', history: state.history });
        return;
    }

    if (currentStep === 'awaiting_choice') {
        if (lowerContent === '1') action = 'choice1';
        else if (lowerContent === '2') action = 'choice2';
        if (!action && groq) {
            const intent = await interpretIntent(content, currentStep, { history: state.history });
            if (intent === 'choice1') action = 'choice1';
            else if (intent === 'choice2') action = 'choice2';
        }
        if (action === 'choice1') {
            await message.reply(getPaymentOptionsMenu());
            userStates.set(userId, { step: 'awaiting_payment_method', history: state.history });
        } else if (action === 'choice2') {
            await message.reply(getInfoWithVideo());
            userStates.set(userId, { step: 'awaiting_continue_after_info', history: state.history });
        } else {
            await message.reply("❌ Please send **1** or **2**.");
        }
        return;
    }

    if (currentStep === 'awaiting_continue_after_info') {
        if (lowerContent === '1') {
            await message.reply(getPaymentOptionsMenu());
            userStates.set(userId, { step: 'awaiting_payment_method', history: state.history });
        } else {
            await message.reply("❌ Send **1** to continue.");
        }
        return;
    }

    if (currentStep === 'awaiting_payment_method') {
        if (lowerContent === '1') action = 'payment1';
        else if (lowerContent === '2') action = 'payment2';
        else if (lowerContent === '3') action = 'payment3';
        if (!action && groq) {
            const intent = await interpretIntent(content, currentStep, { history: state.history });
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
        } else {
            await message.reply("❌ Send **1**, **2** or **3**.");
        }
        return;
    }

    if (currentStep === 'awaiting_payment_confirmation') {
        // Cambio metodo
        if (lowerContent === '1') action = 'change_method|PayPal';
        else if (lowerContent === '2') action = 'change_method|Crypto';
        else if (lowerContent === '3') action = 'change_method|Robux';
        else if (lowerContent.includes('finished transaction')) action = 'finished';
        
        if (!action && groq) {
            const intent = await interpretIntent(content, currentStep, { history: state.history, paymentMethod: state.paymentMethod });
            if (intent === 'finished') action = 'finished';
            else if (intent.startsWith('change_method')) action = intent;
        }

        if (action && action.startsWith('change_method')) {
            const newMethod = action.split('|')[1];
            if (newMethod === 'PayPal') {
                await message.reply(getPaypalInfo());
                userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'PayPal', history: state.history });
            } else if (newMethod === 'Crypto') {
                await message.reply(getCryptoInfo());
                userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'Crypto', history: state.history });
            } else if (newMethod === 'Robux') {
                await message.reply(getRobuxInfo());
                userStates.set(userId, { step: 'awaiting_payment_confirmation', paymentMethod: 'Robux', history: state.history });
            }
            return;
        }

        if (action === 'finished') {
            if (!message.attachments || message.attachments.size === 0) {
                await message.reply('❌ You must attach a screenshot/image as proof. Send `finished transaction` again with the file attached.');
                return;
            }
            const attachment = message.attachments.first();
            let aiSummary = null;
            if (groq) {
                aiSummary = await analyzeProof(content, attachment.url);
            }
            const success = await sendProofToWebhook(
                message.author,
                state.paymentMethod || 'Unknown',
                attachment.url,
                content,
                aiSummary
            );
            if (success) {
                await message.reply(getFinalConfirmation());
            } else {
                await message.reply('❌ Failed to send proof to staff. Please try again.');
            }
            userStates.delete(userId);
            return;
        }
        await message.reply("❌ Send `finished transaction` with your proof attached, or change method with 1/2/3.");
        return;
    }

    await message.reply('Internal error. Use `!reset`.');
});

client.login(TOKEN).catch(err => {
    console.error("Login error:", err);
    process.exit(1);
});
