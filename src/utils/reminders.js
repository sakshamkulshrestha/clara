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

  const parts = value.match(
    /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)/g,
  );

  if (!parts || parts.join('') !== value.replace(/\s+/g, '')) {
    return null;
  }

  let total = 0;

  for (const part of parts) {
    const match = part.match(
      /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)/,
    );

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2];

    if (
      unit.startsWith('s')
    ) {
      total += amount * 1000;
    } else if (
      unit.startsWith('m')
    ) {
      total += amount * 60 * 1000;
    } else if (
      unit.startsWith('h')
    ) {
      total += amount * 60 * 60 * 1000;
    } else if (
      unit.startsWith('d')
    ) {
      total += amount * 24 * 60 * 60 * 1000;
    }
  }

  if (total <= 0) return null;

  return total;
}

function schedule(reminder, client) {
  const remaining = reminder.remindAt - Date.now();

  if (remaining <= 0) {
    fireReminder(reminder, client);
    return;
  }

  // setTimeout has a maximum delay, so long reminders
  // are scheduled in chunks.
  const maxDelay = 2_147_000_000;
  const delay = Math.min(remaining, maxDelay);

  setTimeout(() => {
    schedule(reminder, client);
  }, delay);
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

  if (reminders.length > 0) {
    console.log(
      `restored ${reminders.length} reminder(s)`,
    );
  }
}