import { useState, useEffect } from "react";

const STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","Washington DC","West Virginia","Wisconsin","Wyoming",
];
const EDUCATIONS = ["Bachelors", "Masters", "PhD", "MBA"];
const PROFESSIONS = ["Software Engineer", "Doctor", "Business Owner", "Teacher", "Nurse", "Accountant", "Pharmacist"];
const MARITAL_STATUSES = ["Never Married", "Divorced", "Widowed", "Awaiting Divorce"];

export default function FilterBar({ onSearch, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    gender:         "",
    age_min:        "",
    age_max:        "",
    state:          "",
    education:      "",
    profession:     "",
    marital_status: "",
  });

  // When the parent loads the viewer's preferences and passes them in,
  // pre-populate the filter bar once (only on first non-empty arrival).
  useEffect(() => {
    if (!initialFilters || !Object.keys(initialFilters).length) return;
    setFilters({
      gender:         initialFilters.gender         || "",
      age_min:        initialFilters.age_min        != null ? String(initialFilters.age_min) : "",
      age_max:        initialFilters.age_max        != null ? String(initialFilters.age_max) : "",
      state:          initialFilters.state          || "",
      education:      initialFilters.education      || "",
      profession:     initialFilters.profession     || "",
      // pref_marital_statuses may be "Never Married,Divorced" — the dropdown
      // only supports one value, so take the first one
      marital_status: initialFilters.marital_status
        ? initialFilters.marital_status.split(",")[0].trim()
        : "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialFilters)]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const handleSearch = () => {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== "")
    );
    onSearch(cleaned);
  };

  const handleReset = () => {
    setFilters({ gender: "", age_min: "", age_max: "", state: "", education: "", profession: "", marital_status: "" });
    onSearch({});   // empty → backend falls back to opposite-gender default
  };

  return (
    <div className="filter-bar">
      <div>
        <label>Gender</label>
        <select value={filters.gender} onChange={set("gender")}>
          <option value="">All</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      <div>
        <label>Age Min</label>
        <input type="number" min={18} max={80} placeholder="18" value={filters.age_min} onChange={set("age_min")} style={{ width: 80 }} />
      </div>
      <div>
        <label>Age Max</label>
        <input type="number" min={18} max={80} placeholder="80" value={filters.age_max} onChange={set("age_max")} style={{ width: 80 }} />
      </div>
      <div>
        <label>State</label>
        <select value={filters.state} onChange={set("state")}>
          <option value="">All</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label>Education</label>
        <select value={filters.education} onChange={set("education")}>
          <option value="">All</option>
          {EDUCATIONS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label>Profession</label>
        <select value={filters.profession} onChange={set("profession")}>
          <option value="">All</option>
          {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label>Marital Status</label>
        <select value={filters.marital_status} onChange={set("marital_status")}>
          <option value="">All</option>
          {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleSearch}>Search</button>
      <button className="btn btn-outline btn-sm" onClick={handleReset}>Reset</button>
    </div>
  );
}
