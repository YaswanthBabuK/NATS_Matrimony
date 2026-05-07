import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from "../firebase";
import { login as backendLogin, getProfileByEmail } from "../data/api";

// ── helper: store session + dispatch event ────────────────────────────────────
function storeSession(data) {
  sessionStorage.setItem("currentProfileId",    data.profile_id);
  sessionStorage.setItem("currentProfileName",  data.full_name);
  sessionStorage.setItem("currentProfileEmail", data.email);
  window.dispatchEvent(new Event("authChanged"));
}

export default function Login() {
  const navigate       = useNavigate();
  const location       = useLocation();
  const justRegistered = location.state?.registered === true;

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Forgot-password modal state
  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetMsg,     setResetMsg]     = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // ── Email / Password login ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedEmail = email.trim();

    try {
      let profileData = null;

      // ── Try Firebase Auth first ──────────────────────────────────────────
      try {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        // Firebase verified → fetch profile from backend
        profileData = await getProfileByEmail(trimmedEmail);

      } catch (fbErr) {
        // Errors that mean "definitely wrong password" — do NOT fall back to backend
        const isWrongPassword = [
          "auth/wrong-password",
          "auth/invalid-credential",
        ].includes(fbErr.code);

        if (isWrongPassword) {
          setError("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }

        if (fbErr.code === "auth/too-many-requests") {
          setError("Too many failed attempts. Please reset your password.");
          setLoading(false);
          return;
        }

        // All other Firebase errors (user-not-found, configuration-not-found,
        // network errors, Auth not yet enabled in console, etc.) → fall back
        // to backend auth so existing accounts always work.
        try {
          profileData = await backendLogin(trimmedEmail, password);

          // Backend accepted it → silently create Firebase account so next
          // login works via Firebase (fire-and-forget, don't block the UX).
          createUserWithEmailAndPassword(auth, trimmedEmail, password).catch(() => {});

        } catch (beErr) {
          // Both Firebase and backend rejected → wrong credentials
          setError(beErr.response?.data?.detail || "Invalid email or password.");
          setLoading(false);
          return;
        }
      }

      storeSession(profileData);
      navigate("/matrimony");

    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbEmail = result.user.email;

      try {
        // Try to load existing profile
        const data = await getProfileByEmail(fbEmail);
        storeSession(data);
        navigate("/matrimony");
      } catch (profileErr) {
        if (profileErr.response?.status === 404) {
          // Google account exists but no matrimony profile — send to register
          navigate("/register", { state: { googleEmail: fbEmail, googleName: result.user.displayName } });
        } else {
          throw profileErr;
        }
      }
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        // User dismissed the popup — not an error
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset via Firebase ───────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setResetMsg("");
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMsg("✅ Reset link sent! Check your inbox (and spam folder).");
    } catch (err) {
      const msgs = {
        "auth/user-not-found": "No Firebase account found with this email.",
        "auth/invalid-email":  "Please enter a valid email address.",
      };
      setResetMsg(msgs[err.code] || "Failed to send reset email. Try again.");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Test accounts (seed data) ─────────────────────────────────────────────
  const TEST_ACCOUNTS = [
    { label: "👨 Male",   email: "arjun.reddy@example.com",   password: "password123" },
    { label: "👩 Female", email: "priya.lakshmi@example.com", password: "password123" },
  ];

  const fillTest = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-wrapper">

        <h1 className="login-page-title">MATRIMONY LOGIN</h1>
        <hr className="login-divider" />

        {justRegistered && (
          <div className="login-success-banner">
            🎉 Registration complete! Sign in with your new account.
          </div>
        )}

        <div className="login-outer-card">
          <form onSubmit={handleSubmit} className="login-inner-form">

            <div className="login-field">
              <label className="login-field-label">Email</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
              />
            </div>

            <div className="login-field">
              <label className="login-field-label">Password</label>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            {/* ── Test credentials ─────────────────────────────────────── */}
            <div className="login-test-accounts">
              <p className="login-test-label">🧪 Try a test account</p>
              <div className="login-test-btns">
                {TEST_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    className="login-test-btn"
                    onClick={() => fillTest(acc)}
                  >
                    {acc.label}
                    <span className="login-test-email">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? "SIGNING IN…" : "LOGIN"}
            </button>

            <p className="login-forgot">
              Forgot your password?{" "}
              <span
                className="login-reset-link"
                onClick={() => { setShowReset(true); setResetEmail(email); setResetMsg(""); }}
              >
                RESET HERE
              </span>
            </p>

          </form>

          {/* ── Divider ──────────────────────────────────────────────────── */}
          <div className="login-or-divider">
            <span>or</span>
          </div>

          {/* ── Google Sign-In ────────────────────────────────────────────── */}
          <button
            type="button"
            className="login-google-btn"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="login-google-icon" viewBox="0 0 48 48" width="20" height="20">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="login-no-account">
          <p>Don't have an account?</p>
          <button
            className="login-create-btn"
            onClick={() => navigate("/register")}
            type="button"
          >
            CREATE AN ACCOUNT
          </button>
        </div>

      </div>

      {/* ── Password Reset Modal ──────────────────────────────────────────── */}
      {showReset && (
        <div className="modal-backdrop" onClick={() => setShowReset(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Reset Password</h3>
            <p className="modal-sub">
              Enter your email and Firebase will send you a reset link.
            </p>
            <form onSubmit={handleReset}>
              <input
                className="login-input"
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="Your email address"
                required
                style={{ marginBottom: "12px" }}
              />
              {resetMsg && (
                <p className={`modal-msg ${resetMsg.startsWith("✅") ? "modal-msg--ok" : "modal-msg--err"}`}>
                  {resetMsg}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowReset(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit" disabled={resetLoading}>
                  {resetLoading ? "Sending…" : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
