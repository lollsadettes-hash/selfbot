const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

// ─────────────────────────────────────────────────────────────────
// COVER DEGLI ALBUM — hardcodati, nessuna API richiesta
// Come ottenere l'hash: apri open.spotify.com → album → tasto destro
// sulla cover → "Copia indirizzo immagine"
// URL tipo: https://i.scdn.co/image/ab67616d0000b273XXXXXX
// L'hash è tutto ciò che viene dopo "/image/"
// ─────────────────────────────────────────────────────────────────
const ALBUM_COVERS = {
  // FKA twigs
  'MAGDALENE':   'ab67616d0000b273c5649add07ed3720b1d5aff1',
  'LP1':         'ab67616d0000b273cdb2c5e9e28e4f89a4ebee54',
  'M3LL155X':    'ab67616d0000b273c1a14b8b01e5bfd32e5f39e1',
  // Nicole Dollanganger
  'Natural Born Losers': 'ab67616d0000b2730c24c8749b5ff42e9cf26a66',
  'Ode to Dawn':         'ab67616d0000b273f1f5a9012f94aba25a4c6a3a',
  // Snowstrippers
  'Forever': 'ab67616d0000b273b0c9a1a6f2b456e71398e3a0',
  'Closer':  'ab67616d0000b273e8f4eb11e3426ee3edcc3099',
  // Ethel Cain
  "Preacher's Daughter": 'ab67616d0000b2732c30e2f6da96f48c1addb8e0',
  // shygirl
  'NYMPH':  'ab67616d0000b273f39ae5ee5d32e78a4d0df2d7',
  'Alias':  'ab67616d0000b273c0f63fa03e2fc9b67a08e89c',
};

// ─────────────────────────────────────────────────────────────────
// PLAYLIST
// spotifyId opzionale — migliora la sincronizzazione con Discord
// ─────────────────────────────────────────────────────────────────
const playlist = [
  { title: 'cellophane',           artist: 'FKA twigs',           album: 'MAGDALENE',            duration: 245000, spotifyId: '7FIWs0pqAYbP91WWM0vlTQ' },
  { title: 'Coma Baby',            artist: 'Nicole Dollanganger', album: 'Natural Born Losers',   duration: 214000, spotifyId: '1UGD3lW3tDmgZiYuqArXpj' },
  { title: 'Way 2 Many',           artist: 'Snowstrippers',       album: 'Forever',              duration: 178000, spotifyId: '6KrWTi2V3ssoRKmDFMTNDn' },
  { title: 'American Teenager',    artist: 'Ethel Cain',          album: "Preacher's Daughter",  duration: 258000, spotifyId: '3qC3PTaULuaeDnULJG5bbP' },
  { title: 'Freak',                artist: 'shygirl',             album: 'NYMPH',                duration: 198000, spotifyId: '5VY8Q4n4cpOlXCbPFfFXRU' },
  { title: 'mary magdalene',       artist: 'FKA twigs',           album: 'MAGDALENE',            duration: 208000, spotifyId: '4j5fBt8fxC6VDiNnLxpFR2' },
  { title: 'Animal',               artist: 'Nicole Dollanganger', album: 'Natural Born Losers',   duration: 198000, spotifyId: '0k5JTBNwn1NqDxjPEYI06w' },
  { title: 'Again',                artist: 'Snowstrippers',       album: 'Forever',              duration: 195000, spotifyId: '5GBpflBNEcFGP1UDwfJo9G' },
  { title: 'Ptolemaea',            artist: 'Ethel Cain',          album: "Preacher's Daughter",  duration: 376000, spotifyId: '2mFnCCHBXvMNOKqpIDmMPX' },
  { title: 'Heaven',               artist: 'shygirl',             album: 'NYMPH',                duration: 212000, spotifyId: '7dHwMJD3LXKF4qrwrZxSuZ' },
  { title: 'thousand eyes',        artist: 'FKA twigs',           album: 'LP1',                  duration: 222000, spotifyId: '6eGLe4waB2MiKJSV9zy3pN' },
  { title: 'Beautiful and Bad',    artist: 'Nicole Dollanganger', album: 'Natural Born Losers',   duration: 231000, spotifyId: '2P3cNJzz73FH4YnVbq7lnL' },
  { title: 'Closer',               artist: 'Snowstrippers',       album: 'Closer',               duration: 163000, spotifyId: '4ILBOb9hQ15qUJGEv3BXTH' },
  { title: 'Gibson Girl',          artist: 'Ethel Cain',          album: "Preacher's Daughter",  duration: 221000, spotifyId: '0U28c0yd6mI2F5GmVWml0d' },
  { title: 'Woe',                  artist: 'shygirl',             album: 'NYMPH',                duration: 187000, spotifyId: '1pALWf6rMzL4Gmc4gBKRKv' },
  { title: 'tears in the club',    artist: 'FKA twigs',           album: 'M3LL155X',             duration: 218000, spotifyId: '1FZKIm3JVDCxTchel6vbou' },
  { title: 'Marry Me',             artist: 'Nicole Dollanganger', album: 'Natural Born Losers',   duration: 189000, spotifyId: '6qyjle5MRT3PeWxHSAHSeC' },
  { title: 'Naked',                artist: 'Snowstrippers',       album: 'Forever',              duration: 187000, spotifyId: '2wWKvWOmFBIXdlJnFg6TvY' },
  { title: 'Strangers',            artist: 'Ethel Cain',          album: "Preacher's Daughter",  duration: 289000, spotifyId: '54IA0sVKGWMFMH4WXhP3O3' },
  { title: 'SLIME',                artist: 'shygirl',             album: 'Alias',                duration: 163000, spotifyId: '3rGM5U7bfkLWJjhB2HNQAM' },
  { title: 'two weeks',            artist: 'FKA twigs',           album: 'LP1',                  duration: 237000, spotifyId: '7nxclE3qUOF9sfVYFMJ6vD' },
  { title: 'Heaven is a Bedroom',  artist: 'Nicole Dollanganger', album: 'Ode to Dawn',          duration: 203000, spotifyId: '4IiHKA0SYMJn6DVjLZkETn' },
  { title: 'Crush',                artist: 'Ethel Cain',          album: "Preacher's Daughter",  duration: 243000, spotifyId: '2gKAbpNvWbuNqFQ0PMGNqw' },
  { title: 'Come For Me',          artist: 'shygirl',             album: 'NYMPH',                duration: 178000, spotifyId: '3Ue8KiHEbhGFnJAcb3Hnd7' },
];

// ─────────────────────────────────────────────────────────────────
// SPOTIFY API — opzionale, solo per aggiornare hash mancanti
// Client Credentials NON richiede Premium
// Lascia vuoti se non vuoi usarla
// ─────────────────────────────────────────────────────────────────
const SPOTIFY_CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID     || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

let spotifyToken  = null;
let tokenExpiry   = 0;
let lastPresence  = null;
let currentIndex  = 0;
let shuffledList  = [];

// ─── Spotify token (Client Credentials, gratuito) ────────────────
async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json();
    if (!data.access_token) return null;
    spotifyToken = data.access_token;
    tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch {
    return null;
  }
}

// ─── Fallback: iTunes Search API (gratuita, niente auth) ─────────
// Restituisce solo la durata — non può fornire hash Spotify
async function getDurationFromItunes(title, artist) {
  try {
    const q   = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=1`);
    const data = await res.json();
    return data.results?.[0]?.trackTimeMillis || null;
  } catch {
    return null;
  }
}

// ─── Recupero info traccia: prima cerca l'hash hardcoded ─────────
async function resolveTrack(track) {
  // 1. Hash già presente in ALBUM_COVERS → nessuna API necessaria
  const hardcodedHash = ALBUM_COVERS[track.album] || null;

  // 2. Prova Spotify API solo se manca l'hash (e credenziali presenti)
  if (!hardcodedHash) {
    const token = await getSpotifyToken();
    if (token) {
      try {
        const query = encodeURIComponent(`track:${track.title} artist:${track.artist}`);
        const res   = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data    = await res.json();
        const hit     = data.tracks?.items?.[0];
        if (hit) {
          const rawUrl = hit.album.images?.[0]?.url || '';
          // es. https://i.scdn.co/image/ab67616d...
          const hash   = rawUrl.split('/image/')?.[1] || null;
          return {
            imageHash:  hash,
            spotifyId:  track.spotifyId || hit.id,
            durationMs: hit.duration_ms || track.duration,
          };
        }
      } catch (e) {
        console.warn(`⚠️  Spotify API fallita per "${track.title}":`, e.message);
      }
    }
  }

  // 3. iTunes per la durata se manca
  let durationMs = track.duration;
  if (!durationMs) {
    durationMs = (await getDurationFromItunes(track.title, track.artist)) || 210000;
  }

  return {
    imageHash:  hardcodedHash,
    spotifyId:  track.spotifyId || null,
    durationMs,
  };
}

// ─── Pre-fetch di tutta la playlist all'avvio ────────────────────
const resolvedCache = new Map();

async function prefetchAll() {
  console.log('🔍 Pre-fetching info tracce...');
  for (const track of playlist) {
    const key  = `${track.title}::${track.artist}`;
    const info = await resolveTrack(track);
    resolvedCache.set(key, info);
    const icon = info.imageHash ? '🖼️ ' : '   ';
    console.log(`  ${icon} ${track.title} — ${track.artist}`);
    await new Promise(r => setTimeout(r, 150)); // rate-limit gentile
  }
  console.log('✅ Pre-fetch completato\n');
}

// ─── Applica la presence ─────────────────────────────────────────
function applyPresence(track, now, durationMs, imageHash, spotifyId) {
  const presence = {
    activities: [
      {
        name: `${track.title} — ${track.artist}`,
        type: 1, // STREAMING (banner viola)
        url:  'https://www.twitch.tv/qualcosa',
      },
      {
        name:    track.title,
        type:    2, // LISTENING
        details: track.title,
        state:   track.artist,
        assets: {
          large_image: imageHash ? `spotify:${imageHash}` : 'spotify',
          large_text:  track.album,
          small_image: 'spotify',
          small_text:  'Spotify',
        },
        timestamps: {
          start: now,
          end:   now + durationMs,
        },
        sync_id: spotifyId || track.title,
        flags:   48,
      },
    ],
  };
  lastPresence = presence;
  client.user.setPresence(presence);
}

// ─── Loop principale ─────────────────────────────────────────────
async function updateTrack() {
  const track = shuffledList[currentIndex];
  const key   = `${track.title}::${track.artist}`;
  const info  = resolvedCache.get(key) || await resolveTrack(track);
  const now   = Date.now();

  applyPresence(track, now, info.durationMs, info.imageHash, info.spotifyId);

  const coverIcon = info.imageHash ? '🖼️' : '(no cover)';
  console.log(`🎵 Now: ${track.title} — ${track.artist}  ${coverIcon}`);

  currentIndex = (currentIndex + 1) % shuffledList.length;
  setTimeout(updateTrack, info.durationMs + Math.floor(Math.random() * 5000));
}

// ─── Shuffle Fisher-Yates ────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Keepalive ogni 4 minuti ─────────────────────────────────────
setInterval(() => {
  if (lastPresence && client.user) {
    client.user.setPresence(lastPresence);
    console.log('🔄 Status refreshato');
  }
}, 4 * 60 * 1000);

// ─── Riconnessione automatica ────────────────────────────────────
client.on('shardDisconnect', () => {
  console.log('⚠️  Disconnesso, riconnessione tra 5s...');
  setTimeout(() => client.login(process.env.TOKEN), 5000);
});

// ─── Ready ───────────────────────────────────────────────────────
client.on('ready', async () => {
  console.log(`✅ Loggato come ${client.user.tag}\n`);
  shuffledList = shuffle(playlist);
  await prefetchAll();
  await updateTrack();
});

process.on('unhandledRejection', (err) => {
  console.error('Errore non gestito:', err);
});

client.login(process.env.TOKEN);
