const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let currentIndex = 0;

function updateTrack() {
  const track = playlist[currentIndex];
  const now = Date.now();

  client.user.setActivity(track.title, {
    type: 'LISTENING',
    details: track.title,
    state: track.artist,
    assets: {
      largeText: track.album,
    },
    timestamps: {
      start: now,
      end: now + track.duration,
    },
  });

  console.log(`🎵 Now: ${track.title} — ${track.artist}`);
  currentIndex = (currentIndex + 1) % playlist.length;
  setTimeout(updateTrack, track.duration + Math.floor(Math.random() * 5000));
}

client.on('ready', async () => {
  console.log(`✅ Loggato come ${client.user.tag}`);
  shuffle(playlist);
  updateTrack();
});

process.on('unhandledRejection', (err) => {
  console.error('Errore:', err);
});

client.login(process.env.TOKEN);
