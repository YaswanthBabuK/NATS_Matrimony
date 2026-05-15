import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { IconCamera, IconRefreshCw, IconFolderOpen, IconLoader, IconCheckCircle2, IconHeart } from "../icons";
import { register, checkEmail } from "../data/api";
import { auth, createUserWithEmailAndPassword } from "../firebase";

// ── Static option lists ───────────────────────────────────────────────────────
const HEIGHTS = (() => {
  const h = [];
  for (let ft = 4; ft <= 7; ft++) {
    const start = ft === 4 ? 5 : 0;
    const end   = ft === 7 ? 0 : 11;
    for (let inch = start; inch <= end; inch++) h.push(`${ft}'${inch}"`);
  }
  return h;
})();

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","Washington DC","West Virginia","Wisconsin","Wyoming",
];

const EDUCATIONS    = ["High School","Diploma","Bachelors","Masters","MBA","PhD","MD","JD","CA / CPA","Other"];
const CASTES        = ["Brahmin","Kshatriya","Vaishya","Kamma","Reddy","Kapu / Telaga","Velama","Raju","Yadav / Golla","Naidu","Balija","Munnuru Kapu","Agnikula Kshatriya","Kuruva","Boya","Vishwabrahmana","Other"];
const PROFESSIONS   = ["Software Engineer","IT Professional","Doctor","Dentist","Pharmacist","Nurse / Healthcare","Engineer","Accountant / CA","Business Owner","Teacher / Professor","Lawyer","Banker / Finance","Government Employee","Researcher / Scientist","Other"];
const RELIGIONS     = ["Hindu","Christian","Muslim","Sikh","Jain","Buddhist","Other"];
const MOTHER_TONGUES= ["Telugu","Tamil","Kannada","Malayalam","Hindi","Marathi","Bengali","Other"];

const STEPS = [
  { num: 1, label: "Basic Info",  icon: "1" },
  { num: 2, label: "Personal",    icon: "2" },
  { num: 3, label: "Education",   icon: "3" },
  { num: 4, label: "Preferences", icon: "4" },
  { num: 5, label: "Photo",       icon: "5" },
];

const MARITAL_STATUSES = ["Never Married", "Divorced", "Widowed", "Awaiting Divorce"];

// ── 8-4 Rule (mirrors backend _enforce_84_rule) ───────────────────────────────
const PWD_RULES = [
  { label: "8+ characters",      test: (p) => p.length >= 8 },
  { label: "Uppercase (A-Z)",    test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase (a-z)",    test: (p) => /[a-z]/.test(p) },
  { label: "Number (0-9)",       test: (p) => /[0-9]/.test(p) },
  { label: "Special (!@#…)",     test: (p) => /[^A-Za-z0-9]/.test(p) },
];
const pwdStrong = (p) => PWD_RULES.every((r) => r.test(p));

const INITIAL = {
  profile_created_by: "Self",
  first_name: "", last_name: "",
  gender: "",
  date_of_birth: "",
  email: "", password: "", confirm_password: "",
  phone: "",
  marital_status: "Never Married",
  height: "5'4\"",
  religion: "Hindu",
  caste: "", sub_caste: "", gothram: "",
  mother_tongue: "Telugu",
  education: "", profession: "", annual_income: "",
  about_me: "",
  current_city: "", current_state: "", native_place: "",
  pref_age_min: 21, pref_age_max: 35,
  pref_height_min: "", pref_height_max: "",
  pref_education: "",
  pref_profession: "",
  pref_location: "",
  pref_marital_statuses: [],
};

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date(), b = new Date(dob);
  let age = today.getFullYear() - b.getFullYear();
  if ((today.getMonth() - b.getMonth() || today.getDate() - b.getDate()) < 0) age--;
  return age;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect Google Sign-In flow
  const googleEmail = location.state?.googleEmail || "";
  const googleName  = location.state?.googleName  || "";
  const isGoogle    = Boolean(googleEmail);

  // Pre-split Google display name into first / last
  const [googleFirst, googleLast] = useMemo(() => {
    if (!googleName) return ["", ""];
    const parts = googleName.trim().split(" ");
    return [parts[0] || "", parts.slice(1).join(" ") || ""];
  }, [googleName]);

  const [step,      setStep]      = useState(1);
  const [form,      setForm]      = useState(() => ({
    ...INITIAL,
    // Pre-fill from Google if available
    email:      googleEmail || INITIAL.email,
    first_name: googleFirst || INITIAL.first_name,
    last_name:  googleLast  || INITIAL.last_name,
  }));
  const [photo,     setPhoto]     = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [errors,    setErrors]    = useState({});
  const [submitErr, setSubmitErr] = useState("");
  const [loading,   setLoading]   = useState(false);

  // password visibility toggles
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConfirm,setShowConfirm]= useState(false);

  // free-text values for any dropdown where the user picks "Other"
  const [otherText, setOtherText] = useState({});

  // ── Generic field setter ─────────────────────────────────────────────────
  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: "" }));
  };

  // ── Toggle an item in an array field (used for multi-select checkboxes) ──
  const toggleArr = (key, val) => {
    setForm(prev => {
      const arr = prev[key] || [];
      const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
      return { ...prev, [key]: next };
    });
  };


  // ── Validation ───────────────────────────────────────────────────────────
  // Helper: for a selOther field, value must be non-empty and if "Other" is
  // chosen the free-text box must also be filled in.
  const reqSel = (e, key, label) => {
    if (!form[key])
      e[key] = `Please select ${label}`;
    else if (form[key] === "Other" && !otherText[key]?.trim())
      e[key] = `Please type your ${label}`;
  };

  const validate = (s) => {
    const e = {};
    const onlyLetters = /^[a-zA-Z\s\-']+$/;

    if (s === 1) {
      if (!form.profile_created_by)
        e.profile_created_by = "Please select who is creating this profile";

      // ── Names: letters and spaces only ────────────────────────────────────
      if (!form.first_name.trim())
        e.first_name = "First name is required";
      else if (form.first_name.trim().length < 2)
        e.first_name = "Must be at least 2 characters";
      else if (!/^[a-zA-Z\s]+$/.test(form.first_name.trim()))
        e.first_name = "Only letters and spaces are allowed";

      if (!form.last_name.trim())
        e.last_name = "Last name is required";
      else if (form.last_name.trim().length < 2)
        e.last_name = "Must be at least 2 characters";
      else if (!/^[a-zA-Z\s]+$/.test(form.last_name.trim()))
        e.last_name = "Only letters and spaces are allowed";

      if (!form.gender)
        e.gender = "Please select a gender";

      // ── Date of birth: 18–80 years ────────────────────────────────────────
      if (!form.date_of_birth)
        e.date_of_birth = "Date of birth is required";
      else {
        const age = calcAge(form.date_of_birth);
        if (age < 18)      e.date_of_birth = "Must be at least 18 years old";
        else if (age > 80) e.date_of_birth = "Age cannot exceed 80 years";
      }

      // ── Email ─────────────────────────────────────────────────────────────
      if (!form.email.trim())
        e.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
        e.email = "Enter a valid email address (e.g. user@example.com)";

      // ── Password ──────────────────────────────────────────────────────────
      if (!form.password)
        e.password = "Password is required";
      else if (!pwdStrong(form.password))
        e.password = "Password does not meet the 8-4 rule (see checklist below)";
      if (form.password !== form.confirm_password)
        e.confirm_password = "Passwords do not match";

      // ── Phone: optional, but if entered must be 10–15 digits ─────────────
      if (form.phone.trim()) {
        const digits = form.phone.replace(/\D/g, "");
        if (digits.length < 10)
          e.phone = "Enter a valid phone number (at least 10 digits)";
        else if (digits.length > 15)
          e.phone = "Phone number is too long (max 15 digits)";
      }
    }

    if (s === 2) {
      if (!form.marital_status) e.marital_status = "Please select marital status";
      if (!form.height)         e.height         = "Please select height";
      reqSel(e, "mother_tongue", "mother tongue");
      reqSel(e, "religion", "religion");

      // Sub-caste / gothram: letters only if provided
      if (form.sub_caste.trim() && !onlyLetters.test(form.sub_caste.trim()))
        e.sub_caste = "Only letters, spaces and hyphens are allowed";
      if (form.gothram.trim() && !onlyLetters.test(form.gothram.trim()))
        e.gothram = "Only letters, spaces and hyphens are allowed";

      // About me: if provided, 10–200 words
      if (form.about_me.trim()) {
        const wordCount = form.about_me.trim().split(/\s+/).length;
        if (wordCount < 10)
          e.about_me = "Please write at least 10 words (or leave blank)";
        else if (wordCount > 200)
          e.about_me = "Please keep it under 200 words";
      }
    }

    if (s === 3) {
      reqSel(e, "education", "education");

      // City: required, letters/spaces only, 2+ chars
      if (!form.current_city.trim())
        e.current_city = "City is required";
      else if (form.current_city.trim().length < 2)
        e.current_city = "Enter a valid city name";
      else if (!/^[a-zA-Z\s\-'.,/]+$/.test(form.current_city.trim()))
        e.current_city = "City name should only contain letters";

      if (!form.current_state)
        e.current_state = "Please select a state";

      // Native place: letters only if provided
      if (form.native_place.trim() && !/^[a-zA-Z\s\-'.,/]+$/.test(form.native_place.trim()))
        e.native_place = "Only letters, spaces and hyphens are allowed";


    }

    if (s === 4) {
      const mn = Number(form.pref_age_min), mx = Number(form.pref_age_max);
      if (!mn || !mx)
        e.pref_age = "Both min and max age are required";
      else if (mn < 18 || mx < 18)
        e.pref_age = "Preferred age must be at least 18";
      else if (mn > 80 || mx > 80)
        e.pref_age = "Preferred age cannot exceed 80";
      else if (mn >= mx)
        e.pref_age = "Min age must be less than max age";
    }

    return e;
  };

  const handleNext = async () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }

    // ── Step 1 only: check email uniqueness before advancing ────────────────
    if (step === 1) {
      try {
        const { available } = await checkEmail(form.email.trim());
        if (!available) {
          setErrors({ email: "This email is already registered. Please sign in instead." });
          return;
        }
      } catch {
        // network hiccup — let the final submit catch it; don't block the user
      }
    }

    setErrors({});
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const handlePrev = () => {
    setErrors({});
    setStep(s => s - 1);
    window.scrollTo(0, 0);
  };

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!photo) {
      setSubmitErr("A profile photo is required. Please upload a photo to continue.");
      return;
    }
    setLoading(true);
    setSubmitErr("");
    try {
      // If the user chose "Other" for a dropdown, use whatever they typed instead
      const resolve = (key) =>
        form[key] === "Other" ? (otherText[key]?.trim() || "Other") : (form[key] || null);

      const payload = {
        profile_created_by: form.profile_created_by,
        first_name:    form.first_name.trim(),
        last_name:     form.last_name.trim(),
        gender:        form.gender,
        date_of_birth: form.date_of_birth,
        email:         form.email.trim(),
        password:      form.password,
        phone:         form.phone.trim() || null,
        marital_status: form.marital_status,
        height:        form.height,
        religion:      resolve("religion"),
        caste:         resolve("caste"),
        sub_caste:     form.sub_caste || null,
        gothram:       form.gothram   || null,
        mother_tongue: resolve("mother_tongue"),
        education:     resolve("education"),
        profession:    resolve("profession"),
        annual_income: form.annual_income
          ? "$" + Number(form.annual_income).toLocaleString("en-US")
          : null,
        about_me:      form.about_me.trim() || null,
        current_city:  form.current_city.trim()  || null,
        current_state: form.current_state || null,
        native_place:  form.native_place.trim()  || null,
        pref_age_min:  Number(form.pref_age_min),
        pref_age_max:  Number(form.pref_age_max),
        pref_height_min:       form.pref_height_min || null,
        pref_height_max:       form.pref_height_max || null,
        pref_education:        resolve("pref_education") || null,
        pref_profession:       resolve("pref_profession") || null,
        pref_location:         form.pref_location.trim() || null,
        pref_marital_statuses: form.pref_marital_statuses.length
          ? form.pref_marital_statuses.join(",")
          : null,
      };
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (photo) fd.append("photo", photo);

      // Step 1 — Create profile in backend database
      await register(fd);

      // Step 2 — Create Firebase Auth account (enables Google Sign-In + password reset)
      // If Firebase creation fails we still proceed — the user can log in via backend auth.
      try {
        await createUserWithEmailAndPassword(auth, payload.email, form.password);
      } catch (fbErr) {
        // "email-already-in-use" is fine (re-registration attempt); other errors we ignore.
        if (fbErr.code !== "auth/email-already-in-use") {
          console.warn("[Firebase] account creation skipped:", fbErr.code);
        }
      }

      navigate("/login", { state: { registered: true } });
    } catch (err) {
      const detail = err.response?.data?.detail || "Registration failed. Please try again.";
      // Photo duplicate error — jump back to photo step so user can change it
      if (err.response?.status === 409 && detail.toLowerCase().includes("photo")) {
        setStep(5);
        window.scrollTo(0, 0);
      }
      setSubmitErr(detail);
    } finally {
      setLoading(false);
    }
  };

  // ── Input filter rules ────────────────────────────────────────────────────
  // Strip disallowed characters as the user types (handles paste too).
  const FILTERS = {
    // Name fields — letters and spaces only (no digits, no hyphens)
    name:  v => v.replace(/[^a-zA-Z\s]/g, ""),
    // Phone — digits, +, -, (, ), spaces only (no letters)
    phone: v => v.replace(/[^0-9+\-()\s]/g, ""),
    // City / place — letters, spaces, hyphens, commas, periods only
    place: v => v.replace(/[^a-zA-Z\s\-',./]/g, ""),
  };

  // ── Reusable input/select builders ───────────────────────────────────────
  // NOTE: these are plain helper functions that return JSX, NOT React components.
  // They must NOT be called with <Inp /> syntax — call as inp(...) instead.
  // This avoids the cursor-loss bug caused by React unmounting/remounting on
  // every keystroke when sub-components are defined inside a parent component.
  //
  // Pass `filter: FILTERS.name` (or any fn) in `extra` to restrict what the
  // user can type. The filter runs on every change including paste.

  const inp = (key, extra = {}) => {
    const { filter, ...rest } = extra;
    return (
      <input
        className={`reg-input${errors[key] ? " reg-input-err" : ""}`}
        value={form[key]}
        onChange={e => set(key, filter ? filter(e.target.value) : e.target.value)}
        {...rest}
      />
    );
  };

  const sel = (key, opts) => (
    <select
      className={`reg-input${errors[key] ? " reg-input-err" : ""}`}
      value={form[key]}
      onChange={e => set(key, e.target.value)}
    >
      <option value="">-- Select --</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  // Dropdown that REPLACES itself with a text input when "Other" is chosen.
  // The input appears in the exact same position — no extra box is added.
  // A back-arrow button lets the user return to the dropdown list.
  const selOther = (key, opts, placeholder = "Please specify…") => {
    if (form[key] === "Other") {
      return (
        <div className="reg-other-wrap">
          <input
            className={`reg-input reg-other-inline${errors[key] ? " reg-input-err" : ""}`}
            type="text"
            placeholder={placeholder}
            value={otherText[key] || ""}
            onChange={e => setOtherText(prev => ({ ...prev, [key]: e.target.value }))}
            autoFocus
          />
          <button
            type="button"
            className="reg-other-back"
            onClick={() => {
              set(key, "");
              setOtherText(prev => ({ ...prev, [key]: "" }));
            }}
            title="Back to list"
          >
            {/* left-arrow SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
      );
    }

    return (
      <select
        className={`reg-input${errors[key] ? " reg-input-err" : ""}`}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
      >
        <option value="">-- Select --</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  };

  const field = (label, required, error, hint, children) => (
    <div className="reg-field">
      <label className="reg-label">
        {label}{required && <span className="reg-req"> *</span>}
      </label>
      {children}
      {hint  && !error && <span className="reg-hint">{hint}</span>}
      {error && <span className="reg-err-msg">{error}</span>}
    </div>
  );

  // ── Password field with eye toggle + 8-4 strength checklist ─────────────
  const pwdField = (key, label, show, setShow, placeholder) => {
    const metCount = key === "password"
      ? PWD_RULES.filter((r) => r.test(form.password)).length
      : null;

    return (
      <div className="reg-field">
        <label className="reg-label">
          {label}<span className="reg-req"> *</span>
        </label>
        <div className="reg-pwd-wrap">
          <input
            className={`reg-input reg-pwd-input${errors[key] ? " reg-input-err" : ""}`}
            type={show ? "text" : "password"}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            autoComplete={key === "password" ? "new-password" : "off"}
          />
          <button
            type="button"
            className="reg-eye-btn"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20
                         C6.48 20 2 12 2 12a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4
                         c5.52 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        {/* 8-4 strength checklist — only on the main password field */}
        {key === "password" && form.password.length > 0 && (
          <div className="reg-pwd-strength">
            {/* Segmented strength bar */}
            <div className="reg-pwd-bar">
              {PWD_RULES.map((_, i) => (
                <div
                  key={i}
                  className={`reg-pwd-bar-seg ${i < metCount ? "reg-pwd-bar-seg--on" : ""}`}
                />
              ))}
            </div>
            {/* Per-rule pills */}
            <div className="reg-pwd-rules">
              {PWD_RULES.map((rule) => {
                const met = rule.test(form.password);
                return (
                  <span key={rule.label} className={`reg-pwd-rule ${met ? "reg-pwd-rule--met" : ""}`}>
                    {met ? <IconCheckCircle2 size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> : <span style={{ marginRight: 3 }}>-</span>} {rule.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {errors[key] && <span className="reg-err-msg">{errors[key]}</span>}
      </div>
    );
  };

  // ── Step content — returned as JSX fragments, not <Components /> ──────────

  const renderStep1 = () => (
    <>
      {field("Profile Created By", true, errors.profile_created_by, null,
        sel("profile_created_by", ["Self", "Parent", "Sibling", "Relative"])
      )}

      <div className="reg-row">
        {field("First Name", true, errors.first_name, null,
          inp("first_name", { placeholder: "e.g. Arjun", filter: FILTERS.name })
        )}
        {field("Last Name", true, errors.last_name, null,
          inp("last_name", { placeholder: "e.g. Reddy", filter: FILTERS.name })
        )}
      </div>

      {field("Gender", true, errors.gender, null,
        <div className="reg-radio-group">
          {["Male", "Female"].map(g => (
            <label key={g} className={`reg-radio-card${form.gender === g ? " selected" : ""}`}>
              <input type="radio" name="gender" value={g}
                checked={form.gender === g} onChange={() => set("gender", g)} />
              <span>{g}</span>
            </label>
          ))}
        </div>
      )}

      {field(
        "Date of Birth", true, errors.date_of_birth,
        form.date_of_birth && !errors.date_of_birth
          ? `Age: ${calcAge(form.date_of_birth)} years` : null,
        <input
          type="date"
          className={`reg-input${errors.date_of_birth ? " reg-input-err" : ""}`}
          value={form.date_of_birth}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
            .toISOString().split("T")[0]}
          onChange={e => set("date_of_birth", e.target.value)}
        />
      )}

      {field("Email (Login ID)", true, errors.email,
        isGoogle ? "Verified by Google — cannot be changed" : null,
        <input
          type="email"
          className={`reg-input${errors.email ? " reg-input-err" : ""}${isGoogle ? " reg-input-readonly" : ""}`}
          value={form.email}
          onChange={e => !isGoogle && set("email", e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          readOnly={isGoogle}
        />
      )}

      <div className="reg-row">
        {pwdField("password", "Password", showPwd, setShowPwd, "8-4 rule required")}
        {pwdField("confirm_password", "Confirm Password", showConfirm, setShowConfirm, "Re-enter password")}
      </div>

      {field("Mobile Number", false, errors.phone, "Optional — digits, +, ( ) accepted",
        inp("phone", { type: "tel", placeholder: "+1-999-999-9999", filter: FILTERS.phone })
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      {field("Marital Status", true, errors.marital_status, null,
        sel("marital_status", ["Never Married","Divorced","Widowed","Awaiting Divorce"])
      )}
      <div className="reg-row">
        {field("Height", true, errors.height, null, sel("height", HEIGHTS))}
        {field("Mother Tongue", true, errors.mother_tongue, null,
          selOther("mother_tongue", MOTHER_TONGUES, "Enter your mother tongue")
        )}
      </div>
      <div className="reg-row">
        {field("Religion", true, errors.religion, null,
          selOther("religion", RELIGIONS, "Enter your religion")
        )}
        {field("Caste", false, null, null,
          selOther("caste", CASTES, "Enter your caste")
        )}
      </div>
      <div className="reg-row">
        {field("Sub-Caste", false, errors.sub_caste, "Optional",
          inp("sub_caste", { placeholder: "e.g. Kamma Naidu", filter: FILTERS.name })
        )}
        {field("Gothram", false, errors.gothram, "Optional",
          inp("gothram", { placeholder: "e.g. Kashyapa", filter: FILTERS.name })
        )}
      </div>

      {field("About Me", false, errors.about_me, null,
        <>
          <textarea
            className={`reg-input reg-textarea${errors.about_me ? " reg-input-err" : ""}`}
            rows={4}
            placeholder="Write a brief introduction about yourself — your personality, family background, values, hobbies and what you expect from your life partner…"
            value={form.about_me}
            onChange={e => {
              const val = e.target.value;
              const words = val.trim() === "" ? 0 : val.trim().split(/\s+/).length;
              if (words <= 200) set("about_me", val);
            }}
          />
          <span className="reg-hint" style={{ textAlign: "right", display: "block" }}>
            {form.about_me.trim() === "" ? 0 : form.about_me.trim().split(/\s+/).length} / 200 words
          </span>
        </>
      )}
    </>
  );

  const renderStep3 = () => (
    <>
      {field("Highest Education", true, errors.education, null,
        selOther("education", EDUCATIONS, "Enter your qualification")
      )}
      <div className="reg-row">
        {field("Profession / Occupation", false, null, null,
          selOther("profession", PROFESSIONS, "Enter your profession")
        )}
        {field("Annual Income", false, null, null,
          <div className="reg-currency-wrap">
            <span className="reg-currency-sym">$</span>
            <input
              className="reg-input reg-currency-input"
              type="text"
              inputMode="numeric"
              value={form.annual_income
                ? Number(form.annual_income).toLocaleString("en-US")
                : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                set("annual_income", raw);
              }}
              placeholder="e.g. 75,000"
              maxLength={13}
            />
          </div>
        )}
      </div>
      <div className="reg-row">
        {field("Current City", true, errors.current_city, null,
          inp("current_city", { placeholder: "e.g. Houston", filter: FILTERS.place })
        )}
        {field("State", true, errors.current_state, null, sel("current_state", US_STATES))}
      </div>
      {field("Native Place (India)", false, errors.native_place, "e.g. Vijayawada, Andhra Pradesh",
        inp("native_place", { placeholder: "e.g. Vijayawada, AP", filter: FILTERS.place })
      )}
    </>
  );

  const renderStep4 = () => (
    <>
      <div className="reg-pref-note">
        Help us find the best matches for you by sharing your partner preferences. All fields are optional.
      </div>

      {/* ── Age Range ───────────────────────────────────────────────────── */}
      <div className="reg-field">
        <label className="reg-label">Partner Age Range<span className="reg-req"> *</span></label>
        <div className="reg-range-row">
          <input type="number" className="reg-input" min={18} max={80}
            style={{ width: 80 }}
            value={form.pref_age_min}
            onChange={e => set("pref_age_min", e.target.value)} />
          <span className="reg-range-sep">to</span>
          <input type="number" className="reg-input" min={18} max={80}
            style={{ width: 80 }}
            value={form.pref_age_max}
            onChange={e => set("pref_age_max", e.target.value)} />
          <span className="reg-range-unit">years</span>
        </div>
        {errors.pref_age && <span className="reg-err-msg">{errors.pref_age}</span>}
      </div>

      {/* ── Height Range ─────────────────────────────────────────────────── */}
      <div className="reg-row">
        <div className="reg-field">
          <label className="reg-label">Preferred Height (Min)</label>
          <select className="reg-input" value={form.pref_height_min}
            onChange={e => set("pref_height_min", e.target.value)}>
            <option value="">Any</option>
            {HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="reg-field">
          <label className="reg-label">Preferred Height (Max)</label>
          <select className="reg-input" value={form.pref_height_max}
            onChange={e => set("pref_height_max", e.target.value)}>
            <option value="">Any</option>
            {HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {/* ── Education & Profession preferences ──────────────────────────── */}
      <div className="reg-row">
        {field("Preferred Education", false, null, null,
          selOther("pref_education", EDUCATIONS, "Enter preferred education")
        )}
        {field("Preferred Profession", false, null, null,
          selOther("pref_profession", PROFESSIONS, "Enter preferred profession")
        )}
      </div>

      {/* ── Preferred Location ───────────────────────────────────────────── */}
      {field("Preferred Location", false, null, "State or city you'd prefer your partner to be from",
        inp("pref_location", { placeholder: "e.g. Texas, New Jersey, Hyderabad…", filter: FILTERS.place })
      )}

      {/* ── Marital Status Open To ───────────────────────────────────────── */}
      <div className="reg-field">
        <label className="reg-label">Marital Status Open To
          <span className="reg-hint" style={{ marginLeft: 8, fontSize: 12 }}>(select all that apply)</span>
        </label>
        <div className="reg-checkbox-group">
          {MARITAL_STATUSES.map(s => (
            <label
              key={s}
              className={`reg-checkbox-card${form.pref_marital_statuses.includes(s) ? " selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={form.pref_marital_statuses.includes(s)}
                onChange={() => toggleArr("pref_marital_statuses", s)}
              />
              <span>{s}</span>
            </label>
          ))}
        </div>
        <span className="reg-hint">Leave unchecked to accept any marital status.</span>
      </div>
    </>
  );

  const renderStep5 = () => (
    <>
      <p style={{ textAlign: "center", color: "#666", fontSize: 14, marginBottom: 20 }}>
        A profile photo is <strong>required</strong> to complete registration.
        It increases your chances of getting responses by <strong>3×</strong>.
      </p>

      <div className="reg-photo-area">
        {preview
          ? <img src={preview} className="reg-photo-preview" alt="Your photo" />
          : (
            <div className="reg-photo-placeholder">
              <IconCamera size={56} color="#ccc" />
              <span>No photo selected</span>
            </div>
          )
        }
      </div>

      <label className="reg-photo-btn">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{preview ? <><IconRefreshCw size={14} /> Change Photo</> : <><IconFolderOpen size={14} /> Choose Photo</>}</span>
        <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
      </label>
      <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 8 }}>
        JPG · PNG · WEBP · Max 5 MB
      </p>

      {submitErr && <div className="reg-submit-err">{submitErr}</div>}

      <button className="reg-submit-btn" onClick={handleSubmit} disabled={loading}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{loading ? <><IconLoader size={14} /> Registering…</> : <><IconCheckCircle2 size={14} /> Complete Registration</>}</span>
      </button>
    </>
  );

  const RENDERERS = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  return (
    <div className="reg-page">
      <div className="reg-card">

        {/* Google Sign-In banner */}
        {isGoogle && (
          <div className="reg-google-banner">
            <svg viewBox="0 0 48 48" width="20" height="20" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <div>
              <strong>Signing up with Google</strong>
              <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{googleEmail} — email is verified and locked</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="reg-header">
          <h1 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><IconHeart size={24} /> Create Your Profile</h1>
          <p>Join NATS Matrimony — Find Your Life Partner</p>
        </div>

        {/* Step indicator */}
        <div className="reg-stepper">
          {STEPS.map(s => (
            <div key={s.num}
              className={`reg-step-item${step === s.num ? " active" : ""}${step > s.num ? " done" : ""}`}>
              <div className="reg-step-circle">
                {step > s.num ? <IconCheckCircle2 size={16} /> : s.icon}
              </div>
              <div className="reg-step-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="reg-progress-track">
          <div className="reg-progress-fill"
            style={{ width: `${((step - 1) / 4) * 100}%` }} />
        </div>

        <div className="reg-step-title">
          Step {step} of 5 &mdash; {STEPS[step - 1].label}
        </div>

        {/* ── Form body — call as function, NOT as <Component /> ─────────────
            Calling as function keeps React from treating each step as a new
            component type on every re-render, which would unmount inputs and
            reset the cursor position after every keystroke.               */}
        <div className="reg-body">
          {RENDERERS[step - 1]()}
        </div>

        {/* Navigation */}
        <div className="reg-nav">
          {step > 1 && (
            <button className="reg-prev-btn" onClick={handlePrev}>← Previous</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 5 && (
            <button className="reg-next-btn" onClick={handleNext}>Next →</button>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 18, marginBottom: 24, fontSize: 13, color: "#666" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#8B0000", fontWeight: 600 }}>Sign In</a>
        </p>
      </div>
    </div>
  );
}
