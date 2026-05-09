const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const playlist = [
  { title: 'cellophane', artist: 'FKA twigs', album: 'MAGDALENE', duration: 245000 },
  { title: 'Coma Baby', artist: 'Nicole Dollanganger', album: 'Natural Born Losers', duration: 214000 },
  { title: 'Way 2 Many', artist: 'Snowstrippers', album: 'Forever', duration: 178000 },
  { title: 'American Teenager', artist: 'Ethel Cain', album: "Preacher's Daughter", duration: 258000 },
  { title: 'Freak', artist: 'shygirl', album: 'NYMPH', duration: 198000 },
  { title: 'mary magdalene', artist: 'FKA twigs', album: 'MAGDALENE', duration: 208000 },
  { title: 'Animal', artist: 'Nicole Dollanganger', album: 'Natural Born Losers', duration: 198000 },
  { title: 'Again', artist: 'Snowstrippers', album: 'Forever', duration: 195000 },
  { title: 'Ptolemaea', artist: 'Ethel Cain', album: "Preacher's Daughter", duration: 376000 },
  { title: 'Heaven', artist: 'shygirl', album: 'NYMPH', duration: 212000 },
  { title: 'thousand eyes', artist: 'FKA twigs', album: 'LP1', duration: 222000 },
  { title: 'Beautiful and Bad', artist: 'Nicole Dollanganger', album: 'Natural Born Losers', duration: 231000 },
  { title: 'Closer', artist: 'Snowstrippers', album: 'Closer', duration: 163000 },
  { title: 'Gibson Girl', artist: 'Ethel Cain', album: "Preacher's Daughter", duration: 221000 },
  { title: 'Woe', artist: 'shygirl', album: 'NYMPH', duration: 187000 },
  { title: 'tears in the club', artist: 'FKA twigs', album: 'M3LL155X', duration: 218000 },
  { title: 'Marry Me', artist: 'Nicole Dollanganger', album: 'Natural Born Losers', duration: 189000 },
  { title: 'Naked', artist: 'Snowstrippers', album: 'Forever', duration: 187000 },
  { title: 'Strangers', artist: 'Ethel Cain', album: "Preacher's Daughter", duration: 289000 },
  { title: 'SLIME', artist: 'shygirl', album: 'Alias', duration: 163000 },
  { title: 'two weeks', artist: 'FKA twigs', album: 'LP1', duration: 237000 },
  { title: 'Heaven is a Bedroom', artist: 'Nicole Dollanganger', album: 'Ode to Dawn', duration: 203000 },
  { title: 'Crush', artist: 'Ethel Cain', album: "Preacher's Daughter", duration: 243000 },
  { title: 'Come For Me', artist: 'shygirl', album: 'NYMPH', duration: 178000 },
];

let spotifyToken = null;
let tokenExpiry = 0;
let lastPresence = null;
let currentIndex = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  spotifyToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

async function getTrackInfo(title, artist) {
  try {
    const token = await getSpotifyToken();
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    const track = data.tracks?.items?.[0];
    if (!track) return null;
    return {
      spotifyId: track.id,
      albumImageHash: track.album.images?.[0]?.url?.split('/image/')?.[1] || null,
      durationMs: track.duration_ms,
    };
  } catch (e) {
    console.error('Spotify API error:', e.message);
    return null;
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function applyPresence(track, now, duration, imageHash, spotifyId) {
  const presence = {
    activities: [
      // Streaming status (banner viola)
      {
        name: `${track.title} — ${track.artist}`,
        type: 1, // STREAMING
        url: 'https://www.twitch.tv/qualcosa',
      },
      // Listening status (con cover e barra)
      {
        name: track.title,
        type: 2, // LISTENING
        details: track.title,
        state: track.artist,
        assets: {
          large_image: imageHash ? `spotify:${imageHash}` : 'spotify',
          large_text: track.album,
          small_image: 'spotify',
          small_text: 'Spotify',
        },
        timestamps: {
          start: now,
          end: now + duration,
        },
        sync_id: spotifyId || track.title,
        flags: 48,
      },
    ],
  };
  lastPresence = presence;
  client.user.setPresence(presence);
}

async function updateTrack() {
  const track = playlist[currentIndex];
  const now = Date.now();
  const info = await getTrackInfo(track.title, track.artist);
  const duration = info?.durationMs || track.duration;

  applyPresence(track, now, duration, info?.albumImageHash, info?.spotifyId);
  console.log(`🎵 Now: ${track.title} — ${track.artist} ${info?.albumImageHash ? '🖼️' : '(no cover)'}`);

  currentIndex = (currentIndex + 1) % playlist.length;
  setTimeout(updateTrack, duration + Math.floor(Math.random() * 5000));
}

// Keepalive ogni 4 minuti
setInterval(() => {
  if (lastPresence && client.user) {
    client.user.setPresence(lastPresence);
    console.log('🔄 Status refreshato');
  }
}, 4 * 60 * 1000);

client.on('shardDisconnect', () => {
  console.log('⚠️ Disconnesso, riconnessione...');
  setTimeout(() => client.login(process.env.TOKEN), 5000);
});

client.on('ready', async () => {
  console.log(`✅ Loggato come ${client.user.tag}`);
  shuffle(playlist);
  await updateTrack();
});

process.on('unhandledRejection', (err) => {
  console.error('Errore:', err);
});

client.login(process.env.TOKEN);
