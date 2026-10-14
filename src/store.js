// -----------------------------------------------------------------------------
// The session of the portal, kept under /data (the only writable path of the
// container) so a restart of the integration or of Gladys needs no new login:
// fewer logins is fewer chances for the portal to lock the account.
//
// The file holds the session cookies and a hash of the e-mail address they
// belong to (another account in the configuration discards them). Never the
// password. Losing the file only costs one login.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILE_NAME = 'tcc-session.json';

export const accountKey = (username) =>
  createHash('sha256').update(`${username}`.toLowerCase()).digest('hex');

export class SessionStore {
  constructor(directory = process.env.TCC_DATA_DIR || '/data') {
    this.path = join(directory, FILE_NAME);
    this.directory = directory;
  }

  /** @returns {Promise<Record<string, string>|null>} the cookies of this account */
  async load(username) {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        data?.account === accountKey(username) &&
        data.cookies &&
        typeof data.cookies === 'object'
      ) {
        return data.cookies;
      }
    } catch {
      // Absent or unreadable: a login will rebuild it.
    }
    return null;
  }

  async save(username, cookies) {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.path}.tmp`;
    const data = { account: accountKey(username), cookies, saved_at: new Date().toISOString() };
    // Owner-only: the cookies open the account for as long as they live.
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, this.path);
  }

  async clear() {
    await rm(this.path, { force: true });
  }
}

/** A store that keeps nothing (tests, probe script). */
export class MemorySessionStore {
  constructor() {
    this.data = null;
  }

  async load(username) {
    return this.data?.account === accountKey(username) ? this.data.cookies : null;
  }

  async save(username, cookies) {
    this.data = { account: accountKey(username), cookies };
  }

  async clear() {
    this.data = null;
  }
}
