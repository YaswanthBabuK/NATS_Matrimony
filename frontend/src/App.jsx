import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Users, Heart, Inbox } from "lucide-react";
import { API_ORIGIN } from "./data/api";
import Navbar from "./components/Navbar";
import BrowseProfiles from "./pages/BrowseProfiles";
import ProfileDetail from "./pages/ProfileDetail";
import MyMatches from "./pages/MyMatches";
import MyInterests from "./pages/MyInterests";
import Wishlist from "./pages/Wishlist";
import MyProfile from "./pages/MyProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./styles/nats.css";

/* ─── Auth guard — redirects to /login if no session ───────────────────────── */
function RequireAuth({ children }) {
  const location = useLocation();
  const profileId = sessionStorage.getItem("currentProfileId");
  if (!profileId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/* ─── Home page ────────────────────────────────────────────────────────────── */
function Home() {
  const navigate = useNavigate();

  const cards = [
    {
      IconComponent: Users,
      title: "Browse Profiles",
      desc: "Explore hundreds of Telugu profiles across the USA. Filter by age, education, profession and more.",
      path: "/matrimony",
    },
    {
      IconComponent: Heart,
      title: "My Matches",
      desc: "Discover compatible Telugu profiles across North America — ranked by age, education, profession, US state and hometown in India.",
      path: "/matrimony/matches",
    },
    {
      IconComponent: Inbox,
      title: "My Interests",
      desc: "Track interests you've sent and respond to interests you've received. Unlock contact on acceptance.",
      path: "/matrimony/interests",
    },
  ];

  return (
    <>
      {/* Hero */}
      <div className="home-hero">
        <h2>NATS Matrimony — వివాహ వేదిక</h2>
        <p>Connecting Telugu families across North America since 2005</p>
        <button
          className="hero-find-partner-btn"
          onClick={() => navigate("/matrimony")}
        >
          <Heart size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> Find Your Life Partner
        </button>
      </div>

      {/* Info cards */}
      <div className="home-cards">
        {cards.map((c) => (
          <div key={c.path} className="home-card" onClick={() => navigate(c.path)}>
            <div className="home-card-icon"><c.IconComponent size={32} /></div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats strip */}
      <div
        style={{
          background: "#8B0000",
          color: "#fff",
          display: "flex",
          justifyContent: "center",
          gap: 60,
          padding: "28px 32px",
          flexWrap: "wrap",
        }}
      >
        {[
          { num: "50+",   label: "Active Profiles" },
          { num: "8",     label: "US States" },
          { num: "100%",  label: "Telugu Community" },
          { num: "Free",  label: "To Browse" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#FFD700" }}>{s.num}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── App ───────────────────────────────────────────────────────────────────── */
export default function App() {
  // Ping the backend immediately on app load so Render wakes up from sleep
  // before the user needs any data (e.g. test accounts on login page).
  useEffect(() => {
    fetch(`${API_ORIGIN}/`).catch(() => {});
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <Routes>
        {/* Public routes */}
        <Route path="/"          element={<Home />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />

        {/* Matrimony routes — require login */}
        <Route path="/matrimony"             element={<RequireAuth><BrowseProfiles /></RequireAuth>} />
        <Route path="/matrimony/profile/:id" element={<RequireAuth><ProfileDetail /></RequireAuth>} />
        <Route path="/matrimony/matches"     element={<RequireAuth><MyMatches    /></RequireAuth>} />
        <Route path="/matrimony/interests"   element={<RequireAuth><MyInterests  /></RequireAuth>} />
        <Route path="/matrimony/wishlist"    element={<RequireAuth><Wishlist     /></RequireAuth>} />
        <Route path="/matrimony/my-profile"  element={<RequireAuth><MyProfile    /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
