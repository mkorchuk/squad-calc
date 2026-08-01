/**
 * Firebase, loaded on demand.
 *
 * The database SDK is ~220KB (a third of the JS bundle) and only the streaming
 * feature needs it, so nothing here is imported statically: `firebase()` pulls
 * the SDK in the first time a stream is started, joined or watched, and every
 * later call reuses the same promise. Keep it that way — a top-level
 * `import { ref } from "firebase/database"` anywhere in src/ drags the whole
 * SDK back into the initial bundle for every visitor.
 */

// Firebase web config for the "squadcalc" project. The apiKey is not a secret —
// it identifies the project client-side; access is governed by the RTDB rules.
const firebaseConfig = {
  apiKey: "AIzaSyAlDZNGJaAYk_zijqdGRN2g8SBCbJqkRgk",
  authDomain: "squadcalc.firebaseapp.com",
  databaseURL: "https://squadcalc-default-rtdb.firebaseio.com",
  projectId: "squadcalc",
  storageBucket: "squadcalc.firebasestorage.app",
  messagingSenderId: "915287450173",
  appId: "1:915287450173:web:d215ad42a323ae883ec054",
};

/** The database handle plus the SDK functions the app actually uses. */
async function loadFirebase() {
  const [{ initializeApp }, database] = await Promise.all([
    import("firebase/app"),
    import("firebase/database"),
  ]);
  const { getDatabase, get, onDisconnect, onValue, ref, remove, runTransaction, set } = database;
  return { db: getDatabase(initializeApp(firebaseConfig)), get, onDisconnect, onValue, ref, remove, runTransaction, set };
}

export type Firebase = Awaited<ReturnType<typeof loadFirebase>>;

let pending: Promise<Firebase> | null = null;

export function firebase(): Promise<Firebase> {
  // Not cached on rejection: a failed load (offline) should be retried on the
  // next attempt rather than poisoning streaming for the rest of the session.
  if (!pending) {
    pending = loadFirebase().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
