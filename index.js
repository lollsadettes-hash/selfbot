'use strict';

const { Client, MessageActionRow, MessageButton } = require('discord.js-selfbot-v13');
const fetch = require('node-fetch');
const client = new Client({ checkUpdate: false });



// ==========================================
// CONFIGURAZIONE VARIABILI (RAILWAY)
// ==========================================
const TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.REVIEW_WEBHOOK_URL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ALLOWED_USERS = process.env.ALLOWED_USERS 
  ? new Set(process.env.ALLOWED_USERS.split(',').map(id => id.trim())) 
  : null;

const STATES = Object.freeze({
    INITIAL:                'INITIAL',
    AWAITING_VIDEO_CONFIRM: 'AWAITING_VIDEO_CONFIRM',
    AWAITING_PAYMENT_METHOD: 'AWAITING_PAYMENT_METHOD',
    AWAITING_PAYMENT_CONFIRM: 'AWAITING_PAYMENT_CONFIRM',
    AWAITING_REVIEW:        'AWAITING_REVIEW',
});

const userStates = new Map();



// ==========================================
// INFO E DETTAGLI PAGAMENTO
// ==========================================
const SUB_INFO = {
    1: "📧 **PayPal**: `lollsadettes02@gmail.com` (Friends & Family)\n⚠️ **IMPORTANTE**: Non scrivere nulla nelle note, o il pagamento verrà rifiutato.",
    2: "🪙 **LTC (Crypto)**: `LfXyPCq5zEEtTLTCnKiZoHiRyyq2qT5Z3Z`",
    3: "🎮 **Robux**: [Clicca qui per il Gamepass](https://www.roblox.com/catalog/15331422342/0F-4CCESS)"
};



// ==========================================
// FUNZIONI DI SUPPORTO (AI & UTILITY)
// ==========================================
async function getGroqResponse(userInput) {
    if (!GROQ_API_KEY) return null;
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [{ role: "user", content: `Rispondi brevemente come un venditore di un gioco Roblox: ${userInput}` }]
            })
        });
        const data = await response.json();
        return data.choices[0]?.message?.content;
    } catch (e) { return null; }
}



// ==========================================
// EVENTI CLIENT
// ==========================================
client.on('ready', () => {
    console.log(`✅ [SYSTEM] Selfbot Online: ${client.user.tag}`);
});



client.on('messageCreate', async (message) => {

    // Filtro Whitelist (dall'originale)
    if (ALLOWED_USERS && !ALLOWED_USERS.has(message.author.id)) return;
    
    // Risponde solo ai propri messaggi (Selfbot mode)
    if (message.author.id !== client.user.id) return;

    const content = message.content.trim();
    const lowContent = content.toLowerCase();
    const userId = message.author.id;



    // Comandi di Reset e Avvio
    if (lowContent === '!reset' || lowContent === '!start' || lowContent === 'hello') {
        userStates.set(userId, { state: STATES.INITIAL });
        return message.channel.send("👋 **Benvenuto nel sistema di vendita OF (Roblox)**\n\n1️⃣ **Buy Access**\n2️⃣ **Info Creators/Video**\n\n*Digita il numero per procedere.*");
    }



    let current = userStates.get(userId) || { state: STATES.INITIAL };



    try {
        switch (current.state) {
            
            case STATES.INITIAL:
                if (content === '1') {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_METHOD });
                    await message.channel.send("💳 **Seleziona il metodo di pagamento**:\n1. PayPal\n2. Crypto (LTC)\n3. Robux\n\n*Rispondi con 1, 2 o 3.*");
                } else if (content === '2') {
                    userStates.set(userId, { state: STATES.AWAITING_VIDEO_CONFIRM });
                    await message.channel.send("🎥 **Anteprima Video**: [LINK_VIDEO]\n\nPremi **1** per andare al pagamento o **!reset**.");
                } else {
                    const aiResp = await getGroqResponse(content);
                    if (aiResp) await message.channel.send(aiResp);
                }
                break;



            case STATES.AWAITING_VIDEO_CONFIRM:
                if (content === '1') {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_METHOD });
                    await message.channel.send("💳 **Seleziona Metodo**:\n1. PayPal\n2. Crypto\n3. Robux");
                }
                break;



            case STATES.AWAITING_PAYMENT_METHOD:
                const methodIdx = parseInt(content);
                if ([1, 2, 3].includes(methodIdx)) {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_CONFIRM, method: methodIdx });
                    await message.channel.send(`${SUB_INFO[methodIdx]}\n\n✅ Quando hai finito, scrivi **"done"** e allega lo screenshot della transazione.`);
                }
                break;



            case STATES.AWAITING_PAYMENT_CONFIRM:
                if (lowContent === 'done' || lowContent === 'finished' || lowContent === 'fatto') {
                    if (message.attachments.size > 0) {
                        const proofUrl = message.attachments.first().url;
                        
                        if (WEBHOOK_URL) {
                            await fetch(WEBHOOK_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    embeds: [{
                                        title: "💰 Nuova Prova Ricevuta",
                                        description: `**Metodo**: ${current.method === 1 ? 'PayPal' : current.method === 2 ? 'LTC' : 'Robux'}\n**User ID**: ${userId}`,
                                        image: { url: proofUrl },
                                        color: 0x00ff00
                                    }]
                                })
                            });
                        }

                        userStates.set(userId, { state: STATES.AWAITING_REVIEW });
                        await message.channel.send("✅ **Inviato allo staff!** Ti daremo l'accesso dopo il controllo (8-14 ore).");
                    } else {
                        await message.channel.send("❌ **Errore**: Devi allegare l'immagine della prova!");
                    }
                }
                break;



            case STATES.AWAITING_REVIEW:
                if (lowContent === 'status') {
                    await message.channel.send("⏳ **Stato**: In attesa di approvazione manuale.");
                }
                break;
        }
    } catch (err) {
        console.error('❌ Errore durante l\'esecuzione:', err.message);
    }
});



// Gestione chiusura pulita (dall'originale)
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
process.on('SIGINT', () => { client.destroy(); process.exit(0); });



client.login(TOKEN).catch(e => console.error("❌ Token non valido!"));
