import { ActivityType } from 'discord.js';

const statuses = [
  'watching you make mistakes',
  'judging quietly',
  'pretending to work',
  'keeping things under control',
  'waiting for someone to cause chaos',
  'probably smarter than you',
  'fixing your problems',
  'watching the server',
  'being mildly useful',
  'avoiding responsibility',
  'keeping an eye on things',
  'still awake',
  'running the place',
  'waiting for commands',
  'doing absolutely nothing',
  'silently judging',
  'protecting the server',
  'making questionable decisions',
  'handling your nonsense',
  'probably listening',
];

function randomStatus() {
  return statuses[
    Math.floor(Math.random() * statuses.length)
  ];
}

export function startStatusRotation(client) {
  const update = () => {
    if (!client.user) return;

    client.user.setPresence({
      activities: [
        {
          name: randomStatus(),
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  };

  update();

  setInterval(update, 30_000);
}