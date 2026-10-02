import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('data');
const filePath = path.join(dataDir, 'reminders.json');

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, '[]', 'utf8');
}

let reminders = loadReminders();

function loadReminders() {
  try {
    return JSON.parse(
      fs.readFileSync(filePath, 'utf8'),
    );
  } catch {
    return [];
  }
}

function saveReminders() {
  fs.writeFileSync(
    filePath,
    JSON.stringify(reminders, null, 2),
    'utf8',
  );
}

export function parseDuration(input) {
  const value = input.trim().toLowerCase();

  const match = value.match(
    /^(\d+)(s|sec|m|min|h|hr|d)$/,
  );

  if (!match) return null;

  const amount = Number(match[1]);

  if (amount <= 0) return null;

  switch (match[2]) {
    case 's':
    case 'sec':
      return amount * 1000;

    case 'm':
    case 'min':
      return amount * 60 * 1000;

    case 'h':
    case 'hr':
      return amount * 60 * 60 * 1000;

    case 'd':
      return amount * 24 * 60 * 60 * 1000;

    default:
      return null;
  }
}

async function fireReminder(reminder, client) {
  reminders = reminders.filter(
    (item) => item.id !== reminder.id,
  );

  saveReminders();

  try {
    const channel = await client.channels.fetch(
      reminder.channelId,
    );

    if (!channel?.isSendable()) return;

    await channel.send(
      `<@${reminder.userId}> reminder: ${reminder.reason}`,
    );
  } catch (error) {
    console.error('reminder error:', error);
  }
}

function schedule(reminder, client) {
  const remaining =
    reminder.remindAt - Date.now();

  if (remaining <= 0) {
    void fireReminder(reminder, client);
    return;
  }

  // javascript timers cannot safely represent very long delays
  const maxDelay = 2_147_000_000;
  const delay = Math.min(
    remaining,
    maxDelay,
  );

  setTimeout(() => {
    schedule(reminder, client);
  }, delay);
}

export function addReminder({
  userId,
  channelId,
  reason,
  delay,
  client,
}) {
  const reminder = {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    userId,
    channelId,
    reason,
    remindAt: Date.now() + delay,
  };

  reminders.push(reminder);

  saveReminders();
  schedule(reminder, client);

  return reminder;
}

export function restoreReminders(client) {
  reminders = loadReminders();

  for (const reminder of reminders) {
    schedule(reminder, client);
  }

  if (reminders.length) {
    console.log(
      `restored ${reminders.length} reminder(s)`,
    );
  }
}