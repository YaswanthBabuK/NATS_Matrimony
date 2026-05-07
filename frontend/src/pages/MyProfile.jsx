import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SubNav from "../components/SubNav";
import {
  getProfile,
  updateProfile,
  updateProfilePhoto,
  toggleVisibility,
  deleteMyProfile,
  updateEmailPrefs,
  resolvePhotoUrl,
} from "../data/api";

// ── Static option lists (mirrors Register.jsx) ────────────────────────────────
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

const EDUCATIONS     = ["High School","Diploma","Bachelors","Masters","MBA","PhD","MD","JD","CA / CPA","Other"];
const CASTES         = ["Brahmin","Kshatriya","Vaishya","Kamma","Reddy","Kapu / Telaga","Velama","Raju","Yadav / Golla","Naidu","Balija","Munnuru Kapu","Agnikula Kshatriya","Kuruva","Boya","Vishwabrahmana","Other"];
const PROFESSIONS    = ["Software Engineer","IT Professional","Doctor","Dentist","Pharmacist","Nurse / Healthcare","Engineer","Accountant / CA","Business Owner","Teacher / Professor","Lawyer","Banker / Finance","Government Employee","Researcher / Scientist","Other"];
// annual_income is stored as "$75,000"; load as raw digits so the input can reformat it
const incomeToRaw = (val) => (val || "").replace(/\D/g, "").slice(0, 10);
const RELIGIONS      = ["Hindu","Christian","Muslim","Sikh","Jain","Buddhist","Other"];
const MOTHER_TONGUES = ["Telugu","Tamil","Kannada","Malayalam","Hindi","Marathi","Bengali","Other"];
const MARITAL_STATUSES = ["Never Married","Divorced","Widowed","Awaiting Divorce"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="mp-row">
      <span className="mp-row-label">{label}</span>
      <span className="mp-row-value">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = Array.isArray(children)
    ? children.some((c) => c !== null && c !== false && c !== undefined)
    : !!children;
  if (!hasContent) return null;
  return (
    <div className="mp-section">
      <h4 className="mp-section-title">{title}</h4>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MyProfile() {
  const navigate    = useNavigate();
  const currentId   = sessionStorage.getItem("currentProfileId");

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null); // { text, ok }
  const [form,     setForm]     = useState({});
  const [errors,   setErrors]   = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  // ── Input filters ─────────────────────────────────────────────────────────
  const filterName  = (v) => v.replace(/[^a-zA-Z\s]/g, "");
  const filterPlace = (v) => v.replace(/[^a-zA-Z\s\-'.,/]/g, "");
  const filterPhone = (v) => v.replace(/[^0-9+\-()\s]/g, "");

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!currentId) { navigate("/login"); return; }
    setLoading(true);
    try {
      const p = await getProfile(currentId, currentId);
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Start editing ─────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!profile) return;
    setForm({
      full_name:       profile.full_name      || "",
      date_of_birth:   profile.date_of_birth  || "",
      phone:           profile.phone          || "",
      email:           profile.email          || "",
      height:          profile.height         || "",
      marital_status:  profile.marital_status || "",
      religion:        profile.religion       || "",
      caste:           profile.caste          || "",
      sub_caste:       profile.sub_caste      || "",
      gothram:         profile.gothram        || "",
      mother_tongue:   profile.mother_tongue  || "",
      education:       profile.education      || "",
      profession:      profile.profession     || "",
      annual_income:   incomeToRaw(profile.annual_income),
      about_me:        profile.about_me       || "",
      current_city:    profile.current_city   || "",
      current_state:   profile.current_state  || "",
      native_place:    profile.native_place   || "",
      profile_created_by: profile.profile_created_by || "Self",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setErrors({});
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // ── Form field update (clears that field's error on change) ──────────────
  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  // ── Photo picker ──────────────────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // ── Validate edit form ────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    const onlyLetters = /^[a-zA-Z\s]+$/;
    const onlyPlace   = /^[a-zA-Z\s\-'.,/]+$/;

    // Full name: required, letters + spaces only, min 2 chars
    if (!form.full_name.trim())
      e.full_name = "Full name is required";
    else if (form.full_name.trim().length < 2)
      e.full_name = "Must be at least 2 characters";
    else if (!onlyLetters.test(form.full_name.trim()))
      e.full_name = "Only letters and spaces are allowed";

    // Date of birth: if provided, age must be 18–80
    if (form.date_of_birth) {
      const today = new Date(), b = new Date(form.date_of_birth);
      let age = today.getFullYear() - b.getFullYear();
      if ((today.getMonth() - b.getMonth() || today.getDate() - b.getDate()) < 0) age--;
      if (age < 18)      e.date_of_birth = "Must be at least 18 years old";
      else if (age > 80) e.date_of_birth = "Age cannot exceed 80 years";
    }

    // Phone: optional, 10–15 digits if provided
    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, "");
      if (digits.length < 10)
        e.phone = "Enter a valid phone number (at least 10 digits)";
      else if (digits.length > 15)
        e.phone = "Phone number is too long (max 15 digits)";
    }

    // Sub-caste / gothram: letters only if provided
    if (form.sub_caste?.trim() && !onlyLetters.test(form.sub_caste.trim()))
      e.sub_caste = "Only letters and spaces are allowed";
    if (form.gothram?.trim() && !onlyLetters.test(form.gothram.trim()))
      e.gothram = "Only letters and spaces are allowed";

    // City: required, letters only
    if (!form.current_city?.trim())
      e.current_city = "City is required";
    else if (form.current_city.trim().length < 2)
      e.current_city = "Enter a valid city name";
    else if (!onlyPlace.test(form.current_city.trim()))
      e.current_city = "City name should only contain letters";

    // Native place: letters only if provided
    if (form.native_place?.trim() && !onlyPlace.test(form.native_place.trim()))
      e.native_place = "Only letters and spaces are allowed";

    // About me: 10–200 words if provided
    if (form.about_me?.trim()) {
      const words = form.about_me.trim().split(/\s+/).length;
      if (words < 10)       e.about_me = "Please write at least 10 words (or leave blank)";
      else if (words > 200) e.about_me = "Please keep it under 200 words";
    }

    return e;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const e = validateForm();
    if (Object.keys(e).length) { setErrors(e); showToast("Please fix the errors before saving.", false); return; }
    setErrors({});
    setSaving(true);
    try {
      // 1. Update profile fields
      const payload = { ...form };
      delete payload.email; // email update kept optional — uncomment if needed
      // Format raw digits back to "$75,000" before persisting
      if (payload.annual_income) {
        payload.annual_income = "$" + Number(payload.annual_income).toLocaleString("en-US");
      }
      await updateProfile(currentId, payload);

      // 2. Upload new photo if selected
      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        try {
          await updateProfilePhoto(currentId, fd);
        } catch (photoErr) {
          const msg = photoErr.response?.data?.detail || "Photo upload failed.";
          showToast(msg, false);
          setSaving(false);
          return;
        }
      }

      // 3. Re-fetch to get updated data
      const updated = await getProfile(currentId, currentId);
      setProfile(updated);
      setEditing(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      showToast("Profile updated successfully!");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to save. Please try again.", false);
    } finally {
      setSaving(false);
    }
  };

  // ── Hide / Show ───────────────────────────────────────────────────────────
  const handleToggleVisibility = async () => {
    const verb = profile.is_hidden ? "show" : "hide";
    const confirmed = window.confirm(
      profile.is_hidden
        ? "Make your profile visible to other members again?"
        : "Hide your profile? You won't appear in Browse until you un-hide it."
    );
    if (!confirmed) return;
    try {
      const res = await toggleVisibility(currentId);
      setProfile((p) => ({ ...p, is_hidden: res.is_hidden }));
      showToast(res.is_hidden ? "Profile hidden from Browse." : "Profile is now visible.");
    } catch {
      showToast("Could not update visibility. Please try again.", false);
    }
  };

  // ── Email notification preferences ───────────────────────────────────────
  const handleEmailPrefToggle = async (key) => {
    const newVal = !profile[key];
    // Optimistic update
    setProfile((p) => ({ ...p, [key]: newVal }));
    try {
      await updateEmailPrefs(currentId, { [key]: newVal });
      showToast("Email preference updated.");
    } catch {
      // Revert on failure
      setProfile((p) => ({ ...p, [key]: !newVal }));
      showToast("Could not update preference. Please try again.", false);
    }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    const first = window.confirm(
      "Are you sure you want to permanently delete your account?\n\nThis action CANNOT be undone."
    );
    if (!first) return;
    const second = window.confirm(
      "Final confirmation: delete your account and all data permanently?"
    );
    if (!second) return;
    try {
      await deleteMyProfile(currentId);
      sessionStorage.clear();
      navigate("/");
    } catch {
      showToast("Failed to delete account. Please try again.", false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <SubNav />
      <div className="loading">Loading your profile…</div>
    </>
  );

  if (!profile) return (
    <>
      <SubNav />
      <div className="error-msg">Could not load profile.</div>
    </>
  );

  const photoSrc = photoPreview
    || resolvePhotoUrl(profile.profile_photo_url)
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=8B0000&color=fff&size=160`;

  return (
    <>
      <SubNav />

      {/* Toast */}
      {toast && (
        <div className={`mp-toast ${toast.ok ? "mp-toast-ok" : "mp-toast-err"}`}>
          {toast.text}
        </div>
      )}

      {/* Page header */}
      <div className="mp-banner">
        <h2>👤 My Profile</h2>
        <p>Manage your personal information and account settings</p>
      </div>

      <div className="mp-container">

        {/* ── PHOTO + NAME CARD ─────────────────────────────────────────── */}
        <div className="mp-hero-card">
          <div className="mp-photo-wrap" onClick={editing ? () => fileInputRef.current?.click() : undefined}>
            <img src={photoSrc} alt={profile.full_name} className="mp-photo" />
            {editing && (
              <div className="mp-photo-overlay">
                <span>📷 Change</span>
              </div>
            )}
          </div>
          {editing && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
          )}

          <div className="mp-hero-info">
            <h2 className="mp-hero-name">{profile.full_name}</h2>
            <p className="mp-hero-sub">
              {[profile.age && `${profile.age} yrs`, profile.gender, profile.current_city, profile.current_state]
                .filter(Boolean).join(" · ")}
            </p>
            {profile.is_hidden && (
              <span className="mp-hidden-badge">🙈 Hidden from Browse</span>
            )}
          </div>

          {/* Action buttons (view mode only) */}
          {!editing && (
            <div className="mp-action-bar">
              <button className="mp-btn mp-btn-edit" onClick={startEdit}>
                ✏️ Edit Profile
              </button>
              <button
                className={`mp-btn ${profile.is_hidden ? "mp-btn-show" : "mp-btn-hide"}`}
                onClick={handleToggleVisibility}
              >
                {profile.is_hidden ? "👁️ Show Profile" : "🙈 Hide Profile"}
              </button>
              <button className="mp-btn mp-btn-delete" onClick={handleDelete}>
                🗑️ Delete Account
              </button>
            </div>
          )}
        </div>

        {/* ── VIEW MODE ─────────────────────────────────────────────────── */}
        {!editing && (
          <div className="mp-details-grid">
            <Section title="📋 Personal Information">
              <Row label="Date of Birth"  value={profile.date_of_birth} />
              <Row label="Marital Status" value={profile.marital_status} />
              <Row label="Height"         value={profile.height} />
              <Row label="Profile by"     value={profile.profile_created_by} />
            </Section>

            <Section title="🙏 Cultural Background">
              <Row label="Religion"      value={profile.religion} />
              <Row label="Caste"         value={profile.caste} />
              <Row label="Sub Caste"     value={profile.sub_caste} />
              <Row label="Gothram"       value={profile.gothram} />
              <Row label="Mother Tongue" value={profile.mother_tongue} />
            </Section>

            <Section title="🎓 Education & Career">
              <Row label="Education"     value={profile.education} />
              <Row label="Profession"    value={profile.profession} />
              <Row label="Annual Income" value={profile.annual_income} />
            </Section>

            <Section title="📍 Location">
              <Row label="City"         value={profile.current_city} />
              <Row label="State"        value={profile.current_state} />
              <Row label="Native Place" value={profile.native_place} />
            </Section>

            <Section title="📞 Contact">
              <Row label="Email" value={profile.email} />
              <Row label="Phone" value={profile.phone} />
            </Section>

            {profile.about_me && (
              <div className="mp-section mp-about-section">
                <h4 className="mp-section-title">💬 About Me</h4>
                <p className="mp-about-text">{profile.about_me}</p>
              </div>
            )}

            {/* ── Email Notification Preferences ──────────────────────── */}
            <div className="mp-section mp-email-prefs">
              <h4 className="mp-section-title">🔔 Email Notifications</h4>
              <p className="mp-email-prefs-sub">
                Choose which emails you receive from NATS Matrimony.
              </p>

              <div className="mp-pref-row">
                <div className="mp-pref-info">
                  <span className="mp-pref-label">💌 Interest Received</span>
                  <span className="mp-pref-desc">Email when someone sends you an interest</span>
                </div>
                <button
                  className={`mp-toggle ${profile.email_on_interest_received ? "mp-toggle--on" : "mp-toggle--off"}`}
                  onClick={() => handleEmailPrefToggle("email_on_interest_received")}
                  title={profile.email_on_interest_received ? "Click to turn off" : "Click to turn on"}
                >
                  <span className="mp-toggle-thumb" />
                </button>
              </div>

              <div className="mp-pref-row">
                <div className="mp-pref-info">
                  <span className="mp-pref-label">🎉 Interest Accepted</span>
                  <span className="mp-pref-desc">Email when someone accepts your interest</span>
                </div>
                <button
                  className={`mp-toggle ${profile.email_on_interest_accepted ? "mp-toggle--on" : "mp-toggle--off"}`}
                  onClick={() => handleEmailPrefToggle("email_on_interest_accepted")}
                  title={profile.email_on_interest_accepted ? "Click to turn off" : "Click to turn on"}
                >
                  <span className="mp-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT MODE ─────────────────────────────────────────────────── */}
        {editing && (
          <div className="mp-edit-form">

            {/* Basic */}
            <div className="mp-edit-section">
              <h4 className="mp-edit-section-title">📋 Basic Information</h4>
              <div className="mp-edit-grid">
                <EField label="Full Name *" error={errors.full_name}>
                  <input
                    className={`mp-input${errors.full_name ? " mp-input-err" : ""}`}
                    value={form.full_name}
                    onChange={(e) => set("full_name", filterName(e.target.value))}
                    placeholder="e.g. Arjun Reddy"
                  />
                </EField>
                <EField label="Date of Birth" error={errors.date_of_birth}>
                  <input
                    type="date"
                    className={`mp-input${errors.date_of_birth ? " mp-input-err" : ""}`}
                    value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth", e.target.value)}
                  />
                </EField>
                <EField label="Phone" error={errors.phone}>
                  <input
                    className={`mp-input${errors.phone ? " mp-input-err" : ""}`}
                    value={form.phone}
                    onChange={(e) => set("phone", filterPhone(e.target.value))}
                    placeholder="+1 (555) 000-0000"
                  />
                </EField>
                <EField label="Marital Status">
                  <select className="mp-select" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                    <option value="">-- Select --</option>
                    {MARITAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </EField>
                <EField label="Height">
                  <select className="mp-select" value={form.height} onChange={(e) => set("height", e.target.value)}>
                    <option value="">-- Select --</option>
                    {HEIGHTS.map((h) => <option key={h}>{h}</option>)}
                  </select>
                </EField>
                <EField label="Profile Created By">
                  <select className="mp-select" value={form.profile_created_by} onChange={(e) => set("profile_created_by", e.target.value)}>
                    {["Self","Parent","Sibling","Relative","Friend"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </EField>
              </div>
            </div>

            {/* Cultural */}
            <div className="mp-edit-section">
              <h4 className="mp-edit-section-title">🙏 Cultural Background</h4>
              <div className="mp-edit-grid">
                <EField label="Religion">
                  <select className="mp-select" value={form.religion} onChange={(e) => set("religion", e.target.value)}>
                    <option value="">-- Select --</option>
                    {RELIGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </EField>
                <EField label="Caste">
                  <select className="mp-select" value={form.caste} onChange={(e) => set("caste", e.target.value)}>
                    <option value="">-- Select --</option>
                    {CASTES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </EField>
                <EField label="Sub Caste" error={errors.sub_caste}>
                  <input
                    className={`mp-input${errors.sub_caste ? " mp-input-err" : ""}`}
                    value={form.sub_caste}
                    onChange={(e) => set("sub_caste", filterName(e.target.value))}
                    placeholder="e.g. Niyogi, Vaidiki"
                  />
                </EField>
                <EField label="Gothram" error={errors.gothram}>
                  <input
                    className={`mp-input${errors.gothram ? " mp-input-err" : ""}`}
                    value={form.gothram}
                    onChange={(e) => set("gothram", filterName(e.target.value))}
                    placeholder="e.g. Kashyapa"
                  />
                </EField>
                <EField label="Mother Tongue">
                  <select className="mp-select" value={form.mother_tongue} onChange={(e) => set("mother_tongue", e.target.value)}>
                    <option value="">-- Select --</option>
                    {MOTHER_TONGUES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </EField>
              </div>
            </div>

            {/* Education */}
            <div className="mp-edit-section">
              <h4 className="mp-edit-section-title">🎓 Education &amp; Career</h4>
              <div className="mp-edit-grid">
                <EField label="Education">
                  <select className="mp-select" value={form.education} onChange={(e) => set("education", e.target.value)}>
                    <option value="">-- Select --</option>
                    {EDUCATIONS.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </EField>
                <EField label="Profession">
                  <select className="mp-select" value={form.profession} onChange={(e) => set("profession", e.target.value)}>
                    <option value="">-- Select --</option>
                    {PROFESSIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </EField>
                <EField label="Annual Income">
                  <div className="mp-currency-wrap">
                    <span className="mp-currency-sym">$</span>
                    <input
                      className="mp-input mp-currency-input"
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
                </EField>
              </div>
            </div>

            {/* Location */}
            <div className="mp-edit-section">
              <h4 className="mp-edit-section-title">📍 Location</h4>
              <div className="mp-edit-grid">
                <EField label="City *" error={errors.current_city}>
                  <input
                    className={`mp-input${errors.current_city ? " mp-input-err" : ""}`}
                    value={form.current_city}
                    onChange={(e) => set("current_city", filterPlace(e.target.value))}
                    placeholder="e.g. Dallas"
                  />
                </EField>
                <EField label="State">
                  <select className="mp-select" value={form.current_state} onChange={(e) => set("current_state", e.target.value)}>
                    <option value="">-- Select --</option>
                    {US_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </EField>
                <EField label="Native Place (India)" error={errors.native_place}>
                  <input
                    className={`mp-input${errors.native_place ? " mp-input-err" : ""}`}
                    value={form.native_place}
                    onChange={(e) => set("native_place", filterPlace(e.target.value))}
                    placeholder="e.g. Vijayawada, Andhra Pradesh"
                  />
                </EField>
              </div>
            </div>

            {/* About Me */}
            <div className="mp-edit-section">
              <h4 className="mp-edit-section-title">💬 About Me</h4>
              <textarea
                className={`mp-textarea${errors.about_me ? " mp-input-err" : ""}`}
                rows={5}
                value={form.about_me}
                onChange={(e) => {
                  const val = e.target.value;
                  const words = val.trim() === "" ? 0 : val.trim().split(/\s+/).length;
                  if (words <= 200) set("about_me", val);
                }}
                placeholder="Tell potential matches a little about yourself…"
              />
              <div style={{ fontSize: 12, color: "#888", textAlign: "right", marginTop: 4 }}>
                {form.about_me?.trim() ? form.about_me.trim().split(/\s+/).length : 0} / 200 words
              </div>
              {errors.about_me && <div className="mp-field-err">{errors.about_me}</div>}
            </div>

            {/* Save / Cancel */}
            <div className="mp-edit-actions">
              <button className="mp-btn mp-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "💾 Save Changes"}
              </button>
              <button className="mp-btn mp-btn-cancel" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

// Small helper component for edit-form fields
function EField({ label, error, children }) {
  return (
    <div className="mp-efield">
      <label className="mp-efield-label">{label}</label>
      {children}
      {error && <div className="mp-field-err">{error}</div>}
    </div>
  );
}
