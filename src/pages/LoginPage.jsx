import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { createUserProfile } from "../lib/db";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ name: "", rollNo: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await createUserProfile(cred.user.uid, {
          name: form.name,
          rollNo: form.rollNo,
          email: form.email,
        });
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        {/* Logo / brand */}
        <div className="brand">
          <span className="brand-icon">◈</span>
          <div>
            <div className="brand-title">Marketing Maneuvers</div>
            <div className="brand-sub">Attendance System</div>
          </div>
        </div>

        <div className="tab-row">
          {["login", "register"].map((m) => (
            <button
              key={m}
              className={`tab ${mode === m ? "active" : ""}`}
              onClick={() => { setMode(m); setError(""); }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input name="name" required value={form.name} onChange={handleChange} placeholder="Aarav Sharma" />
              </div>
              <div className="field">
                <label>Roll No / Member ID</label>
                <input name="rollNo" required value={form.rollNo} onChange={handleChange} placeholder="2025101151XXXX" />
              </div>
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="you@kiet.edu" />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required value={form.password} onChange={handleChange} placeholder="••••••••" />
          </div>

          {error && <div className="err-msg">{error}</div>}

          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        {mode === "login" && (
          <p className="hint">New member? <span className="link" onClick={() => setMode("register")}>Register here</span></p>
        )}
      </div>
    </div>
  );
}
