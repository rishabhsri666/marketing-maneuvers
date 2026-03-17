import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/logo.png";
import { getMemberAttendance, getAllSessions } from "../lib/db";


function AttendancePie({ present, absent }) {
  const total = present + absent;
  const pct = total === 0 ? 0 : Math.round((present / total) * 100);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = total === 0 ? 0 : (present / total) * circ;

  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="pie-wrap">
      <svg className="pie-chart" viewBox="0 0 140 140" width="160" height="160">
        {/* track */}
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg3)" strokeWidth="14" />
        {/* progress */}
        {total > 0 && (
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        )}
        {/* centre text */}
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--tx)" fontFamily="inherit">{pct}%</text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="var(--tx2)" fontFamily="inherit">attendance</text>
      </svg>
      <div className="pie-legend">
        <span className="dot" style={{ background: color }} /> {present} present · {absent} absent · {total} total
      </div>
    </div>
  );
}

function SessionBadge({ session, status }) {
  return (
    <div className={`session-row ${status}`}>
      <div className="s-left">
        <span className="s-dot" />
        <div>
          <div className="s-title">{session.title}</div>
          <div className="s-date">{session.date} {session.type ? `· ${session.type}` : ""}</div>
        </div>
      </div>
      <span className="s-badge">{status}</span>
    </div>
  );
}

export default function MemberDashboard() {
  const { profile, user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [myAttendance, setMyAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    async function load() {
      const [allSessions, myRecs] = await Promise.all([
        getAllSessions(),
        getMemberAttendance(user.uid),
      ]);
      setSessions(allSessions);
      const map = {};
      myRecs.forEach((r) => (map[r.sessionId] = r.status));
      setMyAttendance(map);
      setLoading(false);
    }
    load();
  }, [user.uid]);

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

  const present = Object.values(myAttendance).filter((s) => s === "present").length;
  const absent = Object.values(myAttendance).filter((s) => s === "absent").length;

  return (
    <div className="dash-root">
      <header className="dash-header">
        <div className="header-brand">
          <img className="brand-icon" src={logo} alt="Marketing Maneuvers Logo" />
          <span>Marketing Maneuvers</span>
        </div>
        <div className="header-right">
          <span className="header-name">{profile?.name}</span>
          <button className="theme-toggle-btn" onClick={toggleDarkMode}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="logout-btn" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="member-grid">
          {/* Left: stats */}
          <div className="stats-panel">
            <div className="panel-heading">My Attendance</div>
            <div className="member-id-chip">{profile?.rollNo}</div>

            {loading ? (
              <div className="loading-ring" />
            ) : (
              <AttendancePie present={present} absent={absent} />
            )}

            <div className="stat-chips">
              <div className="stat-chip green">
                <div className="sc-num">{present}</div>
                <div className="sc-label">Sessions Present</div>
              </div>
              <div className="stat-chip red">
                <div className="sc-num">{absent}</div>
                <div className="sc-label">Sessions Absent</div>
              </div>
              <div className="stat-chip gray">
                <div className="sc-num">{sessions.length}</div>
                <div className="sc-label">Total Sessions</div>
              </div>
            </div>
          </div>

          {/* Right: session list */}
          <div className="sessions-panel">
            <div className="panel-heading">Session History</div>
            {loading ? (
              <div className="loading-ring" />
            ) : sessions.length === 0 ? (
              <div className="empty">No sessions yet.</div>
            ) : (
              sessions.map((s) => (
                <SessionBadge
                  key={s.id}
                  session={s}
                  status={myAttendance[s.id] || "not marked"}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
