import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import MemberDashboard from "./pages/MemberDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import "./App.css";

function AppRouter() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="loading-ring" />
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;
  if (profile.role === "admin" || profile.role === "viewer") return <AdminDashboard />;
  return <MemberDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
