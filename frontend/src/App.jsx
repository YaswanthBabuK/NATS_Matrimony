import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { IconUsers, IconHeart, IconInbox } from "./icons";
import { API_ORIGIN } from "./data/api";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
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
  const navigate  = useNavigate();
  const profileId = sessionStorage.getItem("currentProfileId");

  const cards = [
    {
      IconComponent: IconUsers,
      title: "Browse Profiles",
      desc: "Explore hundreds of Telugu profiles across the USA. Filter by age, education, profession and more.",
      path: "/matrimony",
    },
    {
      IconComponent: IconHeart,
      title: "My Matches",
      desc: "Discover compatible Telugu profiles across North America — ranked by age, education, profession, US state and hometown in India.",
      path: "/matrimony/matches",
    },
    {
      IconComponent: IconInbox,
      title: "My Interests",
      desc: "Track interests you've sent and respond to interests you've received. Unlock contact on acceptance.",
      path: "/matrimony/interests",
    },
  ];

  return (
    <>
      {/* ── Full-screen Hero ── */}
      <div className="home-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <IconHeart size={13} /> NATS MEMBERS ONLY — TRUSTED COMMUNITY SERVICE
          </div>
          <h1 className="hero-heading">
            <span className="hero-white">Find Your Life</span>
            <span className="hero-gold">Partner</span>
          </h1>
          <p className="hero-sub">
            Connecting <strong className="hero-highlight">Telugu families</strong> across North America.
            Find your perfect match within the <strong>NATS community</strong>.
          </p>
          <div className="hero-btns">
            <button className="hero-btn-gold" onClick={() => navigate(profileId ? "/matrimony" : "/login")}>
              {profileId ? "BROWSE PROFILES" : "FIND YOUR LIFE PARTNER"}
            </button>
            {profileId && (
              <button className="hero-btn-outline" onClick={() => navigate("/matrimony/matches")}>
                MY MATCHES
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Info cards ── */}
      <div className="home-cards">
        {cards.map((c) => (
          <div key={c.path} className="home-card" onClick={() => navigate(c.path)}>
            <div className="home-card-icon"><c.IconComponent size={32} /></div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Stats strip ── */}
      <div className="home-stats-strip">
        {[
          { num: "50+",   label: "Active Profiles" },
          { num: "8",     label: "US States" },
          { num: "100%",  label: "Telugu Community" },
          { num: "Free",  label: "To Browse" },
        ].map((s) => (
          <div key={s.label} className="home-stat">
            <div className="home-stat-num">{s.num}</div>
            <div className="home-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function NavbarWrapper() {
  return <Navbar />;
}

function MainContent({ children }) {
  const location = useLocation();
  const [profileId, setProfileId] = useState(() => sessionStorage.getItem("currentProfileId"));

  useEffect(() => {
    const sync = () => setProfileId(sessionStorage.getItem("currentProfileId"));
    window.addEventListener("authChanged", sync);
    return () => window.removeEventListener("authChanged", sync);
  }, []);

  const onMatrimonyPage = location.pathname.startsWith("/matrimony");
  const showSubnav = profileId && onMatrimonyPage;

  return <main>{children}</main>;
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
      <NavbarWrapper />
      <MainContent>
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
      </MainContent>
      <Footer />
    </BrowserRouter>
  );
}
