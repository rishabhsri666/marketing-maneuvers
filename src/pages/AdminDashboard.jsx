import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/logo.png";
import {
  getAllSessions, createSession, updateSessionSubmitted, updateSessionAttendanceTimestamp,
  getAllMembers, getSessionAttendance, markAttendance, clearAttendance,
} from "../lib/db";

// ─── Mini bar chart for overview ────────────────────────────────
function MiniBar({ label, pct, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, color: "var(--tx2)" }}>
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ color: "var(--tx)", fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "var(--bg3)", borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── Attendance heatmap cell ─────────────────────────────────────
function Cell({ status, onClick, disabled }) {
  const cls = status === "present" ? "cell-present"
            : status === "absent"  ? "cell-absent"
            : "cell-empty";
  return (
    <button className={`att-cell ${cls}`} onClick={onClick} disabled={disabled} title={status || "click to mark"}>
      {status === "present" ? "✓" : status === "absent" ? "✗" : "·"}
    </button>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("sessions"); // sessions | members | overview
  const [memberYearFilter, setMemberYearFilter] = useState("all"); // all | 1st | 2nd
  const [memberSearch, setMemberSearch] = useState("");
      const [sessions, setSessions] = useState([]);
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({}); // { sessionId: { userId: status } }
  const [activeSession, setActiveSession] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newSession, setNewSession] = useState({ title: "", date: "", type: "Meeting" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Load everything once
  useEffect(() => {
    async function load() {
      const [s, m] = await Promise.all([getAllSessions(), getAllMembers()]);
      setSessions(s.map(sess => ({ ...sess, submitted: sess.submitted || false })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setMembers(m);
      // Pre-load attendance for all sessions
      const attMap = {};
      for (const sess of s) {
        const recs = await getSessionAttendance(sess.id);
        attMap[sess.id] = {};
        recs.forEach((r) => (attMap[sess.id][r.userId] = r.status));
      }
      setAttendance(attMap);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // ── Session creation ───────────────────────────────────────────
  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ref = await createSession(newSession);
      const created = { id: ref.id, ...newSession };
      setSessions((prev) => [created, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setAttendance((prev) => ({ ...prev, [ref.id]: {} }));
      setNewSession({ title: "", date: "", type: "Meeting" });
      setShowForm(false);
      setActiveSession(created);
      setTab("sessions");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle attendance ──────────────────────────────────────────
  const toggle = async (sessionId, userId) => {
    const current = attendance[sessionId]?.[userId];
    const next = current === "present" ? "absent"
               : current === "absent"  ? "present"
               : "present"; // first click = present
    await markAttendance(sessionId, userId, next);
    setAttendance((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], [userId]: next },
    }));
    // Update timestamp if session was already submitted
    const session = sessions.find(s => s.id === sessionId);
    if (session?.submitted) {
      await updateSessionAttendanceTimestamp(sessionId);
    }
  };

  // ── Bulk attendance marking ────────────────────────────────────
  const markAll = async (status) => {
    const filteredMembers = members
      .filter((m) => memberYearFilter === "all" || m.year === memberYearFilter)
      .filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()));
    for (const m of filteredMembers) {
      if (status) {
        await markAttendance(activeSession.id, m.id, status);
      } else {
        await clearAttendance(activeSession.id, m.id);
      }
      setAttendance((prev) => ({
        ...prev,
        [activeSession.id]: { ...prev[activeSession.id], [m.id]: status || undefined },
      }));
    }
    // Update timestamp if session was already submitted
    if (activeSession?.submitted) {
      await updateSessionAttendanceTimestamp(activeSession.id);
    }
  };

  // ── Submit attendance ───────────────────────────────────────────
  const submitAttendance = async () => {
    await updateSessionSubmitted(activeSession.id, true);
    setSessions((prev) => prev.map((s) => s.id === activeSession.id ? { ...s, submitted: true } : s));
    setActiveSession((prev) => ({ ...prev, submitted: true }));
  };

  // ── Per-member stats for overview ──────────────────────────────
  const memberStats = members.map((m) => {
    let present = 0, total = 0;
    sessions.forEach((s) => {
      const st = attendance[s.id]?.[m.id];
      if (st) { total++; if (st === "present") present++; }
    });
    const pct = total === 0 ? 0 : Math.round((present / total) * 100);
    const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
    return { ...m, present, total, pct, color };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="dash-root">
      <header className="dash-header">
        <div className="header-brand">
          <img className="brand-icon" src={logo} alt="Marketing Maneuvers Logo" />
          <span>Marketing Maneuvers</span>
        </div>
        <div className="header-right">
          <span className="role-chip">{profile?.role === "viewer" ? "Viewer" : "Admin"}</span>
          <span className="header-name">{profile?.name}</span>
          <button className="theme-toggle-btn" onClick={toggleDarkMode}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="logout-btn" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="tab-nav">
        {["sessions", "members", "overview"].map((t) => (
          <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "sessions" ? "📋 Sessions" : t === "members" ? "👥 Members" : "📊 Overview"}
          </button>
        ))}
        {profile?.role !== "viewer" && <button className="new-session-btn" onClick={() => setShowForm(true)}>+ New Session</button>}
      </nav>

      {/* New Session Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New Session</div>
            <form onSubmit={handleCreateSession}>
              <div className="field">
                <label>Session Title</label>
                <input required value={newSession.title} onChange={(e) => setNewSession((f) => ({ ...f, title: e.target.value }))} placeholder="Weekly Strategy Meeting" />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" required value={newSession.date} onChange={(e) => setNewSession((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={newSession.type} onChange={(e) => setNewSession((f) => ({ ...f, type: e.target.value }))}>
                  {["Meeting", "Workshop", "Event", "Training", "Other"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" className="submit-btn" disabled={saving}>{saving ? "Creating…" : "Create Session"}</button>
                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="dash-main">
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="loading-ring" /></div>
        ) : (

        /* ── SESSIONS TAB ─────────────────────────────────────── */
        tab === "sessions" ? (
          <div className="admin-grid">
            {/* Session list */}
            <div className="session-list-panel">
              <div className="panel-heading">Sessions <span className="count-chip">{sessions.length}</span></div>
              {sessions.length === 0 ? (
                <div className="empty">No sessions yet. Create one above.</div>
              ) : (
                sessions.map((s) => {
                  const recs = attendance[s.id] || {};
                  const present = Object.values(recs).filter((x) => x === "present").length;
                  const isActive = activeSession?.id === s.id;
                  return (
                    <div key={s.id} className={`s-card ${isActive ? "s-card-active" : ""}`} onClick={() => setActiveSession(s)}>
                      <div className="s-card-title">{s.title}</div>
                      <div className="s-card-meta">{s.date} · {s.type}</div>
                      <div className="s-card-stat">
                        <span style={{ color: "#22c55e" }}>{present} present</span>
                        <span> / {members.length} members</span>
                        {s.submitted && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 12 }}>✓ Submitted</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Attendance marking */}
            <div className="mark-panel">
              {!activeSession ? (
                <div className="empty" style={{ paddingTop: 60 }}>← Select a session to mark attendance</div>
              ) : (
                <>
                  <div className="panel-heading">{activeSession.title}</div>
                  <div style={{ color: "var(--tx2)", fontSize: 13, marginBottom: 16 }}>{activeSession.date} · {activeSession.type}</div>
                  <div className="att-legend">
                    <span className="leg present">✓ Present</span>
                    <span className="leg absent">✗ Absent</span>
                    <span className="leg empty">· Not marked</span>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--bg3)", borderRadius: 6, background: "var(--bg)", color: "var(--tx)" }}
                    />
                  </div>
                  <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {profile?.role !== "viewer" && (
                      <>
                        <button onClick={() => markAll("present")} disabled={activeSession.submitted} style={{ padding: "6px 12px", background: activeSession.submitted ? "#ccc" : "#22c55e", color: "white", border: "none", borderRadius: 4, cursor: activeSession.submitted ? "not-allowed" : "pointer" }}>Mark All Present</button>
                        <button onClick={() => markAll("absent")} disabled={activeSession.submitted} style={{ padding: "6px 12px", background: activeSession.submitted ? "#ccc" : "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: activeSession.submitted ? "not-allowed" : "pointer" }}>Mark All Absent</button>
                        <button onClick={() => markAll(null)} disabled={activeSession.submitted} style={{ padding: "6px 12px", background: activeSession.submitted ? "#ccc" : "var(--bg3)", color: activeSession.submitted ? "#999" : "var(--tx)", border: "none", borderRadius: 4, cursor: activeSession.submitted ? "not-allowed" : "pointer" }}>Clear All</button>
                      </>
                    )}
                  </div>
                  {!activeSession.submitted ? (
                    profile?.role !== "viewer" && <button onClick={submitAttendance} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, cursor: "pointer", marginTop: 16 }}>Submit Attendance</button>
                  ) : (
                    <div style={{ marginTop: 16, color: "#f59e0b", fontWeight: 600 }}>
                      Attendance Submitted
                    </div>
                  )}
                  <div className="member-att-list">
                    {members
                      .filter((m) => memberYearFilter === "all" || m.year === memberYearFilter)
                      .filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((m) => {
                        const status = attendance[activeSession.id]?.[m.id];
                        return (
                          <div key={m.id} className="member-att-row">
                            <div className="m-info">
                              <div className="m-avatar">{m.name?.[0]?.toUpperCase() || "?"}</div>
                              <div>
                                <div className="m-name">{m.name}</div>
                                <div className="m-roll">{m.rollNo} · {m.email}</div>
                              </div>
                            </div>
                            <Cell status={status} onClick={() => toggle(activeSession.id, m.id)} disabled={activeSession.submitted || profile?.role === "viewer"} />
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>

        /* ── MEMBERS TAB ──────────────────────────────────────── */
        ) : tab === "members" ? (
          <div className="members-table-wrap">
            <div className="panel-heading">All Members <span className="count-chip">{members.length}</span></div>
            
            {/* Search bar */}
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--bg3)", borderRadius: 6, background: "var(--bg)", color: "var(--tx)" }}
              />
            </div>
            
            {/* Year filter buttons */}
            <div className="year-filter-tabs" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              {["all", "1st", "2nd"].map((year) => (
                <button 
                  key={year} 
                  className={`filter-tab ${memberYearFilter === year ? "active" : ""}`}
                  onClick={() => setMemberYearFilter(year)}
                >
                  {year === "all" ? "All Years" : `${year} Year`}
                </button>
              ))}
            </div>
            
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th><th>Roll No</th><th>Email</th><th>Role</th><th>Year</th>
                  {sessions.map((s) => <th key={s.id} title={s.title}>{s.date}</th>)}
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {memberStats
                  .filter((m) => memberYearFilter === "all" || m.year === memberYearFilter)
                  .filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((m) => (
                    <tr key={m.id}>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="m-avatar sm">{m.name?.[0]?.toUpperCase()}</div>{m.name}</div></td>
                      <td>{m.rollNo}</td>
                      <td style={{ fontSize: 12 }}>{m.email}</td>
                      <td><span className={`role-chip-sm ${m.role}`}>{m.role}</span></td>
                      <td>{m.year || "Unknown"}</td>
                      {sessions.map((s) => {
                        const st = attendance[s.id]?.[m.id];
                        return <td key={s.id} style={{ textAlign: "center" }}><span className={`cell-badge ${st || "none"}`}>{st === "present" ? "✓" : st === "absent" ? "✗" : "–"}</span></td>;
                      })}
                      <td style={{ fontWeight: 700, color: m.color }}>{m.total > 0 ? m.pct + "%" : "–"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        /* ── OVERVIEW TAB ─────────────────────────────────────── */
        ) : (
          <div className="overview-grid">
            <div className="ov-panel">
              <div className="panel-heading">Attendance by Member</div>
              {memberStats.length === 0 ? (
                <div className="empty">No members yet.</div>
              ) : (
                memberStats
                  .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name))
                  .map((m) => <MiniBar key={m.id} label={`${m.name} (${m.rollNo})`} pct={m.pct} color={m.color} />)
              )}
            </div>
            <div className="ov-panel">
              <div className="panel-heading">Session Summary</div>
              {sessions.map((s) => {
                const recs = attendance[s.id] || {};
                const present = Object.values(recs).filter((x) => x === "present").length;
                const pct = members.length === 0 ? 0 : Math.round((present / members.length) * 100);
                const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
                return <MiniBar key={s.id} label={`${s.title} (${s.date})`} pct={pct} color={color} />;
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
