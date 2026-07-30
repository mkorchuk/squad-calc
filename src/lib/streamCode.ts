/**
 * Short join codes for live streams.
 *
 * The host mints a 6-digit code when it starts streaming; the `/live` display
 * page resolves that code back to a room id. The code is read off one screen and
 * typed on the other, which is what makes this work with no discovery, no auth,
 * and no assumptions about the two machines being on the same network.
 *
 * Codes are transient: `codes/{code}` is removed on Stop and by `onDisconnect`,
 * and any entry older than CODE_TTL_MS can be re-claimed by a new host.
 */
import { get, onDisconnect, ref, remove, runTransaction } from "firebase/database";
import { db } from "./firebase";

/** A claim this old is treated as abandoned — its host is long gone. */
const CODE_TTL_MS = 12 * 60 * 60 * 1000;
const CLAIM_ATTEMPTS = 8;

function codePath(code: string): string {
  return `codes/${code}`;
}

/** Six digits, zero-padded. Digits only so it's unambiguous read aloud. */
function makeStreamCode(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}

/** Strip whatever the user typed down to digits (spaces, dashes, stray chars). */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Reserve an unused code for this room. Transactional, so two hosts starting at
 * the same moment can't end up sharing a code.
 */
export async function claimStreamCode(roomId: string): Promise<string> {
  for (let i = 0; i < CLAIM_ATTEMPTS; i++) {
    const code = makeStreamCode();
    const res = await runTransaction(ref(db, codePath(code)), (current) => {
      if (current) {
        const mine = current.roomId === roomId;
        const expired = Date.now() - (current.createdAt ?? 0) > CODE_TTL_MS;
        if (!mine && !expired) return undefined; // taken — abort and try another
      }
      return { roomId, createdAt: Date.now() };
    });
    if (res.committed) return code;
  }
  throw new Error("Could not reserve a stream code.");
}

/** Free the code the moment the host tab dies, so it can be handed out again. */
export function releaseCodeOnDisconnect(code: string): void {
  onDisconnect(ref(db, codePath(code))).remove();
}

export async function releaseStreamCode(code: string): Promise<void> {
  try {
    await onDisconnect(ref(db, codePath(code))).cancel();
  } catch {
    // Offline — the server-side handler will remove it instead.
  }
  await remove(ref(db, codePath(code)));
}

/** Display side: turn a typed code into the room it points at. */
export async function lookupStreamCode(code: string): Promise<string | null> {
  const snap = await get(ref(db, codePath(code)));
  const v = snap.val();
  return v && typeof v.roomId === "string" ? v.roomId : null;
}
