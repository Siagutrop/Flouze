/**
 * Verrouillage par code PIN : hash SHA-256 salé en localStorage,
 * état « verrouillé » partagé via l'événement « flouze-lock ».
 * Jamais de PIN en clair sur le disque.
 */

const PIN_KEY = 'flouze-pin';
const PIN_LEN_KEY = 'flouze-pin-len';
const SALT_KEY = 'flouze-pin-salt';
const LOCKED_KEY = 'flouze-locked';
const ATTEMPTS_KEY = 'flouze-pin-attempts';
const LOCKOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;

function bytesToHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hash(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
    return bytesToHex(await crypto.subtle.digest('SHA-256', data));
}

function getSalt(): string {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
}

export function isPinEnabled(): boolean {
  return localStorage.getItem(PIN_KEY) !== null;
}

export function isLocked(): boolean {
  return isPinEnabled() && localStorage.getItem(LOCKED_KEY) === '1';
}

export function lock() {
  if (!isPinEnabled()) return;
  localStorage.setItem(LOCKED_KEY, '1');
  window.dispatchEvent(new Event('flouze-lock'));
}

/** Verrouille l'app immédiatement (bouton cadenas). */
export function requestLock() {
  lock();
}

export function unlock() {
  localStorage.removeItem(LOCKED_KEY);
  sessionStorage.removeItem(ATTEMPTS_KEY);
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hash(pin, getSalt()));
  localStorage.setItem(PIN_LEN_KEY, String(pin.length));
}

/** Longueur du PIN configuré (4 par défaut pour les anciens PIN). */
export function pinLength(): number {
  return Number(localStorage.getItem(PIN_LEN_KEY)) || 4;
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(PIN_LEN_KEY);
  localStorage.removeItem(LOCKED_KEY);
  sessionStorage.removeItem(ATTEMPTS_KEY);
}

/** Secondes restantes de blocage après trop d'essais ratés (0 = libre). */
export function lockoutSeconds(): number {
  const until = Number(sessionStorage.getItem(ATTEMPTS_KEY) ?? 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (lockoutSeconds() > 0) return false;
  const ok = (await hash(pin, getSalt())) === localStorage.getItem(PIN_KEY);
  if (ok) {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    unlock();
    return true;
  }
  const fails = Number(sessionStorage.getItem(ATTEMPTS_KEY + ':n') ?? 0) + 1;
  if (fails >= MAX_ATTEMPTS) {
    sessionStorage.setItem(ATTEMPTS_KEY, String(Date.now() + LOCKOUT_MS));
    sessionStorage.removeItem(ATTEMPTS_KEY + ':n');
  } else {
    sessionStorage.setItem(ATTEMPTS_KEY + ':n', String(fails));
  }
  return false;
}
