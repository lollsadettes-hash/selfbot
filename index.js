'use strict';

const { Client } = require('discord.js-selfbot-v13');
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



// ==========================================
// STATI E MESSAGGI (FIXED REFERENCE ERRORS)
// ==========================================
const STATES = Object.freeze({
    INITIAL: 'INITIAL',
    AWAITING_VIDEO_CONFIRM: 'AWAITING_VIDEO_CONFIRM',
    AWAITING_PAYMENT_METHOD: 'AWAITING_PAYMENT_METHOD',
    AWAITING_PAYMENT_CONFIRM: 'AWAITING_PAYMENT_CONFIRM',
    AWAITING_REVIEW: 'AWAITING_REVIEW',
});

const userStates = new Map();

// Helper per i messaggi (Fix per le funzioni mancanti nei log)
const msgInitial = () => "👋 **Benvenuto nel sistema OF (Roblox)**\n\n1️⃣ **Buy Access**\n2️⃣ **Info Creators/Video**\n\n*Rispondi con il numero.*";
const msgPaymentMethods = () => "💳 **Seleziona il metodo di pagamento**:\n1. PayPal\n2. Crypto (LTC)\n3. Robux";
const msgVideoInfo = () => "🎥 **Anteprima Video**: [LINK_VIDEO]\n\nPremi **1** per andare al pagamento o **!reset**.";

const SUB_INFO = {
    1: "📧 **PayPal**: `lollsadettes02@gmail.com` (Friends & Family)\n⚠️ No note nel pagamento.",
    2: "🪙 **LTC**: `LfXyPCq5zEEtTLTCnKiZoHiRyyq2qT5Z3Z`",
    3: "🎮 **Robux**: [Link Gamepass](https://www.roblox.com/catalog/15331422342/0F-4CCESS)"
};



// ==========================================
// LOGICA AI E WEBHOOK
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
// GESTORE EVENTI
// ==========================================
client.on('ready', () => {
    console.log(`✅ [SYSTEM] Selfbot Online: ${client.user.tag}`);
});



client.on('messageCreate', async (message) => {
    
    // Filtri sicurezza
    if (ALLOWED_USERS && !ALLOWED_USERS.has(message.author.id)) return;
    if (message.author.id !== client.user.id) return;

    const content = message.content.trim();
    const lowContent = content.toLowerCase();
    const userId = message.author.id;



    // Comandi Reset
    if (lowContent === '!reset' || lowContent === '!start') {
        userStates.set(userId, { state: STATES.INITIAL });
        return message.channel.send(msgInitial());
    }



    let current = userStates.get(userId) || { state: STATES.INITIAL };



    try {
        switch (current.state) {
            
            case STATES.INITIAL:
                if (content === '1') {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_METHOD });
                    await message.channel.send(msgPaymentMethods());
                } else if (content === '2') {
                    userStates.set(userId, { state: STATES.AWAITING_VIDEO_CONFIRM });
                    await message.channel.send(msgVideoInfo());
                } else {
                    const aiResp = await getGroqResponse(content);
                    if (aiResp) await message.channel.send(aiResp);
                }
                break;



            case STATES.AWAITING_VIDEO_CONFIRM:
                if (content === '1') {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_METHOD });
                    await message.channel.send(msgPaymentMethods());
                }
                break;



            case STATES.AWAITING_PAYMENT_METHOD:
                const idx = parseInt(content);
                if ([1, 2, 3].includes(idx)) {
                    userStates.set(userId, { state: STATES.AWAITING_PAYMENT_CONFIRM, method: idx });
                    await message.channel.send(`${SUB_INFO[idx]}\n\n✅ Scrivi **"done"** e allega lo screenshot.`);
                }
                break;



            case STATES.AWAITING_PAYMENT_CONFIRM:
                if (lowContent === 'done' || lowContent === 'finished') {
                    if (message.attachments.size > 0) {
                        const proof = message.attachments.first().url;
                        
                        if (WEBHOOK_URL) {
                            await fetch(WEBHOOK_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    embeds: [{
                                        title: "💰 Nuova Prova Ricevuta",
                                        description: `User: ${userId}\nMetodo: ${current.method}`,
                                        image: { url: proof },
                                        color: 0x00ff00
                                    }]
                                })
                            });
                        }
                        userStates.set(userId, { state: STATES.AWAITING_REVIEW });
                        await message.channel.send("✅ Inviato allo staff! Attendi controllo.");
                    } else {
                        await message.channel.send("❌ Devi allegare lo screenshot!");
                    }
                }
                break;



            case STATES.AWAITING_REVIEW:
                if (lowContent === 'status') await message.channel.send("⏳ In revisione...");
                break;
        }
    } catch (err) { 
        console.error('Errore durante l\'esecuzione:', err.message); 
    }
});



process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
process.on('SIGINT', () => { client.destroy(); process.exit(0); });



client.login(TOKEN).catch(e => console.error("❌ Errore Token!"));
                        
