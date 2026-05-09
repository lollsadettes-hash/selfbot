const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

const playlist = [
  { title: 'cellophane', artist: 'FKA twigs' },
  { title: 'Coma Baby', artist: 'Nicole Dollanganger' },
  { title: 'Way 2 Many', artist: 'Snowstrippers' },
  { title: 'American Teenager', artist: 'Ethel Cain' },
  { title: 'Freak', artist: 'shygirl' },
  { title: 'mary magdalene', artist: 'FKA twigs' },
  { title: 'Animal', artist: 'Nicole Dollanganger' },
  { title: 'Again', artist: 'Snowstrippers' },
  { title: 'Ptolemaea', artist: 'Ethel Cain' },
  { title: 'Heaven', artist: 'shygirl' },
  { title: 'thousand eyes', artist: 'FKA twigs' },
  { title: 'Beautiful and Bad', artist: 'Nicole Dollanganger' },
  { title: 'Closer', artist: 'Snowstrippers' },
  { title: 'Gibson Girl', artist: 'Ethel Cain' },
  { title: 'Woe', artist: 'shygirl' },
  { title: 'tears in the club', artist: 'FKA twigs' },
  { title: 'Marry Me', artist: 'Nicole Dollanganger' },
  { title: 'Naked', artist: 'Snowstrippers' },
  { title: 'Strangers', artist: 'Ethel Cain' },
  { title: 'SLIME', artist: 'shygirl' },
  { title: 'two weeks', artist: 'FKA twigs' },
  { title: 'Heaven is a Bedroom', artist: 'Nicole Dollanganger' },
  { title: 'Crush', artist: 'Ethel Cain' },
  { title: 'Come For Me', artist: 'shygirl' },
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let currentIndex = 0;

function updateStream() {
  const track = playlist[currentIndex];
  const label = `${track.title} — ${track.artist}`;

  client.user.setActivity(label, {
    type: 'STREAMING',
    url: 'https://www.twitch.tv/qualcosa'
  });

  console.log(`🔴 Now: ${label}`);
  currentIndex = (currentIndex + 1) % playlist.length;
  setTimeout(updateStream, 200000);
}

client.on('ready', async () => {
  console.log(`✅ Loggato come ${client.user.tag}`);
  shuffle(playlist);
  updateStream();
});

process.on('unhandledRejection', (err) => {
  console.error('Errore:', err);
});

client.login(process.env.TOKEN);
