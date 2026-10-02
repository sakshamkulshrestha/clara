import fs from 'fs';

interface Warn { mod: string; reason: string; at: number }
interface Data {
  aiChannels: string[];
  warnings: Record<string, Warn[]>;
  lockedChannels: Record<string, boolean | null>;
}

const file = 'data.json';

export const db: Data = { aiChannels: [], warnings: {}, lockedChannels: {} };

try {
  const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (saved && typeof saved === 'object') {
    const data = saved as Record<string, unknown>;
    if (Array.isArray(data.aiChannels)) {
      db.aiChannels = data.aiChannels.filter((channel): channel is string => typeof channel === 'string');
    }
    if (data.warnings && typeof data.warnings === 'object' && !Array.isArray(data.warnings)) {
      db.warnings = Object.fromEntries(
        Object.entries(data.warnings).map(([key, value]) => [
          key,
          Array.isArray(value)
            ? value.filter((warning): warning is Warn =>
              !!warning && typeof warning === 'object' &&
              typeof warning.mod === 'string' && typeof warning.reason === 'string' &&
              typeof warning.at === 'number' && Number.isFinite(warning.at))
            : [],
        ]),
      );
    }
    if (data.lockedChannels && typeof data.lockedChannels === 'object' && !Array.isArray(data.lockedChannels)) {
      db.lockedChannels = Object.fromEntries(
        Object.entries(data.lockedChannels).filter((entry): entry is [string, boolean | null] =>
          entry[1] === null || typeof entry[1] === 'boolean'),
      );
    }
  }
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error('could not load data.json; starting with empty data', err);
  }
}

export const save = () => fs.writeFileSync(file, JSON.stringify(db, null, 1));
