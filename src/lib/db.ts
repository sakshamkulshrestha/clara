import fs from 'fs';

interface Warn { mod: string; reason: string; at: number }
interface Data { aiChannels: string[]; warnings: Record<string, Warn[]> }

const file = 'data.json';

export const db: Data = { aiChannels: [], warnings: {} };

try {
  Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8')));
} catch {}

export const save = () => fs.writeFileSync(file, JSON.stringify(db, null, 1));
