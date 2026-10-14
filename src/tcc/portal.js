// -----------------------------------------------------------------------------
// When to log in to Total Connect Comfort, and when to stop.
//
// The portal locks an account that fails too many logins, and a locked
// account also locks the user out of the Honeywell app. So:
//   - a refused password, or a lock, is never retried by itself: the portal
//     is left alone until the user saves new credentials or presses "Test
//     the connection" (reset());
//   - a login answer that is neither a success nor a refusal is retried at
//     most every 10 minutes, and three of them in a row stop like a refusal;
//   - an expired session is renewed with one new login, unless the previous
//     login is less than a minute old (a session refused at once is not a
//     session to renew in a loop);
//   - the session cookies are kept under /data across restarts.
// Every call goes through one queue: the portal sees one request at a time.
// -----------------------------------------------------------------------------

import { TccError } from './client.js';

export class TccPortal {
  /**
   * @param {object} options
   * @param {import('./client.js').TccClient} options.client
   * @param {{ load: Function, save: Function, clear: Function }} options.store
   * @param {() => number} [options.now]
   * @param {object} [options.timings]
   */
  constructor({ client, store, now = () => Date.now(), timings = {} }) {
    this.client = client;
    this.store = store;
    this.now = now;
    this.timings = {
      unclearLoginBackoffMs: 10 * 60 * 1000,
      failedLoginBackoffMs: 60 * 1000,
      minSessionLifeMs: 60 * 1000,
      maxUnclearLogins: 3,
      ...timings,
    };
    this.username = '';
    this.password = '';
    this.queue = Promise.resolve();
    this.resetState();
  }

  resetState() {
    /** @type {TccError|null} the reason the portal is left alone */
    this.blocked = null;
    this.unclearLogins = 0;
    this.nextLoginAt = 0;
    this.lastLoginAt = null;
    this.sessionLoaded = false;
    this.savedCookies = null;
    this.logins = 0;
  }

  /** New credentials: everything known about the previous ones is dropped. */
  configure(username, password) {
    if (username === this.username && password === this.password) {
      return false;
    }
    this.username = username;
    this.password = password;
    // The saved session is reloaded for this account only (the store keys it
    // by account): another account never reuses it.
    this.client.clearSession();
    this.resetState();
    return true;
  }

  /** The user asked to try again (the "Test the connection" button). */
  reset() {
    this.blocked = null;
    this.unclearLogins = 0;
    this.nextLoginAt = 0;
  }

  /**
   * Run an operation on the portal with a valid session.
   * @template T
   * @param {(client: import('./client.js').TccClient) => Promise<T>} operation
   * @returns {Promise<T>}
   */
  run(operation) {
    const run = this.queue.then(() => this.runNow(operation));
    this.queue = run.catch(() => {});
    return run;
  }

  async runNow(operation) {
    if (!this.username || !this.password) {
      throw new TccError('config', 'no e-mail address or password configured');
    }
    if (this.blocked) {
      throw this.blocked;
    }
    await this.ensureSession();
    try {
      const result = await operation(this.client);
      await this.saveSession();
      return result;
    } catch (err) {
      if (err?.kind !== 'session') {
        throw err;
      }
      this.client.clearSession();
      await this.store.clear().catch(() => {});
      if (
        this.lastLoginAt !== null &&
        this.now() - this.lastLoginAt < this.timings.minSessionLifeMs
      ) {
        // Logged in a moment ago and already "expired": the login did not
        // really work. Counted like an unclear login, never looped on.
        throw this.unclearLogin(
          new TccError('login', 'the portal ended the session right after the login'),
        );
      }
      await this.login();
      const result = await operation(this.client);
      await this.saveSession();
      return result;
    }
  }

  async ensureSession() {
    if (!this.sessionLoaded) {
      this.sessionLoaded = true;
      const cookies = await this.store.load(this.username).catch(() => null);
      if (cookies) {
        this.client.importCookies(cookies);
        this.savedCookies = JSON.stringify(this.client.exportCookies());
      }
    }
    if (!this.client.hasSession()) {
      await this.login();
    }
  }

  async login() {
    if (this.now() < this.nextLoginAt) {
      throw new TccError('throttled', 'waiting before the next login attempt');
    }
    try {
      this.logins += 1;
      await this.client.login(this.username, this.password);
    } catch (err) {
      if (err.kind === 'credentials' || err.kind === 'locked') {
        this.blocked = err;
        throw err;
      }
      if (err.kind === 'login') {
        throw this.unclearLogin(err);
      }
      // Network or server error: the portal did not judge the password.
      this.nextLoginAt = this.now() + this.timings.failedLoginBackoffMs;
      throw err;
    }
    this.lastLoginAt = this.now();
    await this.saveSession();
  }

  unclearLogin(err) {
    this.unclearLogins += 1;
    this.nextLoginAt = this.now() + this.timings.unclearLoginBackoffMs;
    if (this.unclearLogins >= this.timings.maxUnclearLogins) {
      this.blocked = err;
    }
    return err;
  }

  // The portal slides its cookies: the latest ones are kept.
  async saveSession() {
    const cookies = this.client.exportCookies();
    const serialized = JSON.stringify(cookies);
    if (serialized === this.savedCookies || !this.client.hasSession()) {
      return;
    }
    this.savedCookies = serialized;
    // A /data that cannot be written costs a login at the next restart, no more.
    await this.store.save(this.username, cookies).catch(() => {});
  }
}
