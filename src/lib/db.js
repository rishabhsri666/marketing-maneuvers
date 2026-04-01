import {
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, query, where, orderBy, serverTimestamp, deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ─── User helpers ────────────────────────────────────────────────
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    role: "member", // default; manually change to "admin" or "viewer" in Firestore console
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllMembers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Session helpers ─────────────────────────────────────────────
export async function createSession(data) {
  return addDoc(collection(db, "sessions"), {
    ...data,
    submitted: false,
    createdAt: serverTimestamp(),
  });
}

export async function getAllSessions() {
  const q = query(collection(db, "sessions"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateSessionSubmitted(sessionId, submitted) {
  await setDoc(doc(db, "sessions", sessionId), { 
    submitted,
    submittedAt: submitted ? serverTimestamp() : null,
  }, { merge: true });
}

export async function updateSessionAttendanceTimestamp(sessionId) {
  await setDoc(doc(db, "sessions", sessionId), { 
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Attendance helpers ──────────────────────────────────────────
// attendanceId = sessionId_userId  (compound key for easy lookup)
export async function markAttendance(sessionId, userId, status) {
  const id = `${sessionId}_${userId}`;
  await setDoc(doc(db, "attendance", id), {
    sessionId,
    userId,
    status, // "present" | "absent"
    markedAt: serverTimestamp(),
  });
}

export async function clearAttendance(sessionId, userId) {
  const id = `${sessionId}_${userId}`;
  await deleteDoc(doc(db, "attendance", id));
}

export async function getSessionAttendance(sessionId) {
  const q = query(
    collection(db, "attendance"),
    where("sessionId", "==", sessionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMemberAttendance(userId) {
  const q = query(
    collection(db, "attendance"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
