const { useEffect, useMemo, useState } = React;

// ARTA Client Satisfaction Survey (Online Version) – 2025
const STEP_LABELS = [
  "Client information",
  "Citizen’s Charter",
  "Service Quality (SQD)",
  "Suggestions",
  "Review",
];

const CLIENT_TYPES = [
  { id: "citizen", label: "Citizen" },
  { id: "business", label: "Business" },
  { id: "government", label: "Government (Employee or another agency)" },
];

const SEX_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

const CC1_OPTIONS = [
  { id: "1", label: "I know what a CC is and I saw this office’s CC." },
  { id: "2", label: "I know what a CC is but I did NOT see this office’s CC." },
  { id: "3", label: "I learned of the CC only when I saw this office’s CC." },
  {
    id: "4",
    label:
      "I do not know what a CC is and I did not see one in this office. (Answer ‘N/A’ on CC2 and CC3)",
  },
];

const CC2_OPTIONS = [
  { id: "1", label: "Easy to see" },
  { id: "2", label: "Somewhat easy to see" },
  { id: "3", label: "Difficult to see" },
  { id: "4", label: "Not visible at all" },
  { id: "5", label: "N/A" },
];

const CC3_OPTIONS = [
  { id: "1", label: "Helped very much" },
  { id: "2", label: "Somewhat helped" },
  { id: "3", label: "Did not help" },
  { id: "4", label: "N/A" },
];

const LIKERT_OPTIONS = [
  { id: "1", short: "SD", label: "Strongly Disagree" },
  { id: "2", short: "D", label: "Disagree" },
  { id: "3", short: "N", label: "Neither Agree nor Disagree" },
  { id: "4", short: "A", label: "Agree" },
  { id: "5", short: "SA", label: "Strongly Agree" },
  { id: "6", short: "N/A", label: "N/A (Not Applicable)" },
];

const SQD_QUESTIONS = [
  { id: "sqd0", label: "SQD0. I am satisfied with the service that I availed." },
  { id: "sqd1", label: "SQD1. I spent a reasonable amount of time for my transaction." },
  {
    id: "sqd2",
    label:
      "SQD2. The office followed the transaction’s requirements and steps based on the information provided.",
  },
  {
    id: "sqd3",
    label:
      "SQD3. The steps (including payment) I needed to do for my transaction were easy and simple.",
  },
  {
    id: "sqd4",
    label: "SQD4. I easily found information about my transaction from the office’s website.",
  },
  {
    id: "sqd5",
    label:
      "SQD5. I paid a reasonable amount of fees for my transaction. (If service was free, mark the ‘N/A’ column)",
  },
  { id: "sqd6", label: "SQD6. I am confident my online transaction was secure." },
  {
    id: "sqd7",
    label:
      "SQD7. The office’s online support was available, and (if asked questions) online support was quick to respond.",
  },
  {
    id: "sqd8",
    label:
      "SQD8. I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.",
  },
];

const DEFAULT_CONFIG = {
  activeYear: new Date().getFullYear(),
  version: 1,
  ui: {
    title: "Client Satisfaction Form",
    intro:
      "This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option not to answer this form.",
  },
  stepLabels: STEP_LABELS,
};

// Set to true when Firebase is deployed and you want to save responses and use server config.
const USE_FIREBASE = false;
const CONFIG_STORAGE_KEY = "pwd_survey_config";

function getLocalSurveyConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    // Ensure survey always has 5 ARTA step labels (avoid empty/wrong from old config)
    const validStepLabels =
      Array.isArray(merged.stepLabels) && merged.stepLabels.length >= 5
        ? merged.stepLabels
        : STEP_LABELS;
    merged.stepLabels = validStepLabels;
    // If saved config is from old survey (had experienceChoices/topics), use ARTA title/intro so survey page reflects new form
    const isLegacyConfig =
      Array.isArray(parsed.experienceChoices) ||
      Array.isArray(parsed.topics) ||
      (parsed.feedback && typeof parsed.feedback === "object");
    if (isLegacyConfig) {
      merged.ui = { ...DEFAULT_CONFIG.ui };
    }
    return merged;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

function setLocalSurveyConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// Replace with your Firebase project config from Firebase Console > Project settings.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCDTjJaL4CY79tEG8ue3v0N_UzfGj78Vz4",
  authDomain: "polwd-survey.firebaseapp.com",
  projectId: "polwd-survey",
  storageBucket: "polwd-survey.firebasestorage.app",
  messagingSenderId: "768034495490",
  appId: "1:768034495490:web:35effc3830c71210ce5b1b"
};

function slugFromLabel(label) {
  const s = String(label || "").trim().toLowerCase();
  return s.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "") || "";
}

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `sub_${Math.abs(hash)}`;
};

const createSubmissionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sub_${crypto.randomUUID()}`;
  }
  return hashString(`${Date.now()}_${Math.random()}`);
};

const ensureFirebase = () => {
  if (typeof firebase === "undefined") {
    throw new Error("Firebase SDK not loaded");
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
};

const getCallable = (name) => {
  ensureFirebase();
  return firebase.functions().httpsCallable(name);
};

const getAuth = () => {
  ensureFirebase();
  return firebase.auth();
};

const getRoute = () => {
  const hash = window.location.hash || "";
  const route = hash.startsWith("#/admin") ? "admin" : "survey";
  // #region agent log
  if (route === "admin") fetch('http://127.0.0.1:7243/ingest/785a02aa-25d4-46af-a53c-911d3080a253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:getRoute',message:'Route is admin (hash-based)',data:{hash: hash.substring(0,20)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  return route;
};

const DEFAULT_STATE = {
  clientType: "",
  date: "",
  sex: "",
  age: "",
  region: "",
  serviceAvailed: "",
  cc1: "",
  cc2: "",
  cc3: "",
  sqd: {
    sqd0: "",
    sqd1: "",
    sqd2: "",
    sqd3: "",
    sqd4: "",
    sqd5: "",
    sqd6: "",
    sqd7: "",
    sqd8: "",
  },
  suggestions: "",
  email: "",
};

function QuestionRow({ label, help, htmlFor, children, className = "" }) {
  return (
    <div className={`question-row ${className}`.trim()}>
      <div className="question-left">
        {label ? (
          htmlFor ? (
            <label className="question-label" htmlFor={htmlFor}>
              {label}
            </label>
          ) : (
            <p className="question-label">{label}</p>
          )
        ) : null}
        {help ? <p className="question-help">{help}</p> : null}
      </div>
      <div className="question-right">{children}</div>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState(getRoute());
  const [adminError, setAdminError] = useState("");
  const [adminSaveNotice, setAdminSaveNotice] = useState("");
  const [adminForm, setAdminForm] = useState({
    activeYear: new Date().getFullYear(),
    ui: { title: "", intro: "" },
    stepLabels: [...STEP_LABELS],
  });

  const [surveyStarted, setSurveyStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedLocallyOnly, setSavedLocallyOnly] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  const [surveyConfig, setSurveyConfig] = useState(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const logoClickResetRef = React.useRef(null);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (route === "admin") {
      document.body.classList.add("page--admin");
    } else {
      document.body.classList.remove("page--admin");
    }
    return () => document.body.classList.remove("page--admin");
  }, [route]);

  useEffect(() => {
    const config = getLocalSurveyConfig();
    setSurveyConfig(config);
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    if (route === "survey" && configLoaded) {
      const config = getLocalSurveyConfig();
      setSurveyConfig(config);
    }
  }, [route, configLoaded]);

  useEffect(() => {
    if (!adminSaveNotice) return;
    const t = setTimeout(() => setAdminSaveNotice(""), 3200);
    return () => clearTimeout(t);
  }, [adminSaveNotice]);

  useEffect(() => {
    if (!saveError) return;
    const t = setTimeout(() => setSaveError(""), 5000);
    return () => clearTimeout(t);
  }, [saveError]);

  useEffect(() => {
    if (route === "admin" && configLoaded) {
      const c = surveyConfig;
      setAdminForm({
        activeYear: c.activeYear ?? new Date().getFullYear(),
        ui: {
          title: c.ui?.title ?? DEFAULT_CONFIG.ui.title,
          intro: c.ui?.intro ?? DEFAULT_CONFIG.ui.intro,
        },
        stepLabels:
          Array.isArray(c.stepLabels) && c.stepLabels.length
            ? [...c.stepLabels]
            : [...STEP_LABELS],
      });
    }
  }, [route, configLoaded]);

  const stepLabels = useMemo(() => {
    const labels = surveyConfig.stepLabels;
    return Array.isArray(labels) && labels.length >= 5 ? labels : STEP_LABELS;
  }, [surveyConfig.stepLabels]);
  const reviewStepIndex = stepLabels.length - 1;

  const progress = useMemo(
    () => ((step + 1) / stepLabels.length) * 100,
    [step, stepLabels.length]
  );

  useEffect(() => {
    if (formState.cc1 !== "4") return;
    setFormState((prev) => {
      const next = { ...prev };
      if (next.cc2 !== "5") next.cc2 = "5";
      if (next.cc3 !== "4") next.cc3 = "4";
      return next;
    });
  }, [formState.cc1]);

  const canMoveNext = useMemo(() => {
    if (step === 0) {
      return (
        String(formState.clientType || "").trim().length > 0 &&
        String(formState.date || "").trim().length > 0 &&
        String(formState.serviceAvailed || "").trim().length > 0
      );
    }
    if (step === 3) {
      return true;
    }
    if (step === 1) {
      if (!String(formState.cc1 || "").trim()) return false;
      if (formState.cc1 === "4") return true;
      return !!String(formState.cc2 || "").trim() && !!String(formState.cc3 || "").trim();
    }
    if (step === 2) {
      return SQD_QUESTIONS.every((q) => String((formState.sqd || {})[q.id] || "").trim());
    }
    return true;
  }, [formState, step]);

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateSQD = (questionId, value) => {
    setFormState((prev) => ({
      ...prev,
      sqd: {
        ...(prev.sqd || {}),
        [questionId]: value,
      },
    }));
  };

  const sendResponse = async () => {
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    setSavedLocallyOnly(false);
    setDuplicateNotice(false);

    const submissionId = createSubmissionId();
    const payload = {
      ...formState,
      submissionId,
      activeYear: surveyConfig.activeYear ?? new Date().getFullYear(),
      configVersion: surveyConfig.version ?? 1,
      submittedAt: new Date().toISOString(),
    };

    // Default (no backend): store locally only; do not show "Response saved" as if sent to server.
    if (!USE_FIREBASE) {
      try {
        const key = "arta_submissions";
        const raw = localStorage.getItem(key);
        const prev = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(prev) ? prev : [];
        next.push(payload);
        localStorage.setItem(key, JSON.stringify(next));
        setSavedLocallyOnly(true);
        return "ok";
      } catch (e) {
        setSaveError("We couldn't save your response on this device. Please try again.");
        return "error";
      } finally {
        setIsSaving(false);
      }
    }

    if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === "YOUR_PROJECT_ID") {
      setSaveError("Firebase is not configured. Set FIREBASE_CONFIG in app.js.");
      setIsSaving(false);
      return "error";
    }

    try {
      const submitSurvey = getCallable("submitSurvey");
      await submitSurvey(payload);
      setSaveSuccess(true);
      return "ok";
    } catch (error) {
      setSaveError("We couldn't save your response. Please try again.");
      return "error";
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canMoveNext) {
      return;
    }
    if (step < reviewStepIndex) {
      setStep((prev) => prev + 1);
      return;
    }
    const result = await sendResponse();
    if (result === "ok") {
      setSubmitted(true);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const resetSurvey = () => {
    setSurveyStarted(false);
    setFormState(DEFAULT_STATE);
    setStep(0);
    setSubmitted(false);
    setSaveSuccess(false);
    setSavedLocallyOnly(false);
    setDuplicateNotice(false);
  };

  const openAdmin = () => {
    window.location.hash = "#/admin";
  };

  const handleLogoClick = () => {
    if (logoClickResetRef.current) clearTimeout(logoClickResetRef.current);
    setLogoClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        openAdmin();
        return 0;
      }
      logoClickResetRef.current = setTimeout(() => setLogoClickCount(0), 1500);
      return next;
    });
  };

  const openSurvey = () => {
    // Replace history entry so browser Back doesn't return to admin panel.
    window.history.replaceState(null, "", "#/");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const loadAdminDraft = () => {
    setAdminSaveNotice("");
    setAdminError("");
    const c = surveyConfig;
    setAdminForm({
      activeYear: c.activeYear ?? new Date().getFullYear(),
      ui: {
        title: c.ui?.title ?? DEFAULT_CONFIG.ui.title,
        intro: c.ui?.intro ?? DEFAULT_CONFIG.ui.intro,
      },
      stepLabels:
        Array.isArray(c.stepLabels) && c.stepLabels.length
          ? [...c.stepLabels]
          : [...STEP_LABELS],
    });
  };

  const saveAdminDraft = () => {
    setAdminSaveNotice("");
    setAdminError("");
    const f = adminForm;
    const merged = {
      ...DEFAULT_CONFIG,
      activeYear: Number(f.activeYear) || new Date().getFullYear(),
      ui: {
        title: String(f.ui.title).trim() || DEFAULT_CONFIG.ui.title,
        intro: String(f.ui.intro).trim() || DEFAULT_CONFIG.ui.intro,
      },
      stepLabels:
        Array.isArray(f.stepLabels) && f.stepLabels.length
          ? f.stepLabels.map((x) => String(x).trim()).filter(Boolean)
          : [...STEP_LABELS],
    };
    setLocalSurveyConfig(merged);
    setSurveyConfig(merged);
    setAdminSaveNotice("Saved. The survey will show your changes.");
  };

  const updateAdminForm = (path, valueOrUpdater) => {
    setAdminForm((prev) => {
      const value = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      const next = { ...prev };
      if (path === "activeYear") next.activeYear = value;
      else if (path === "ui.title") next.ui = { ...prev.ui, title: value };
      else if (path === "ui.intro") next.ui = { ...prev.ui, intro: value };
      else if (path === "stepLabels") next.stepLabels = value;
      return next;
    });
  };

  if (route === "admin") {
    return (
      <main className="survey-shell survey-shell--admin">
        <header className="survey-header">
          <div className="brand">
            <img
              className="brand-logo"
              src="./pwd-logo.jpg"
              alt="Polomolok Water District logo"
            />
            <div>
              <p className="brand-name">Polomolok Water District</p>
              <p className="brand-tagline">Admin</p>
            </div>
          </div>
          <h1>Survey Admin</h1>
          <p className="admin-intro">Update the year, title, intro, and step labels below. Changes are saved to this device.</p>
          <div className="actions">
            <button className="secondary" type="button" onClick={openSurvey}>
              Back to survey
            </button>
          </div>
        </header>
        <section className="admin-panel" aria-live="polite">
          <div className="admin-toolbar" role="toolbar" aria-label="Config actions">
            <button className="secondary" type="button" onClick={loadAdminDraft} title="Reload saved config into the form">
              Load saved
            </button>
            <button className="primary" type="button" onClick={saveAdminDraft} title="Save current form to this device">
              Save to device
            </button>
          </div>

          <div className="admin-form">
            <div className="admin-section admin-section-first">
              <h3 className="admin-section-title">Survey year &amp; heading</h3>
              <div className="admin-heading-row">
                <div className="field admin-field-year">
                  <label htmlFor="adminYear">Year shown on survey</label>
                  <select
                    id="adminYear"
                    value={adminForm.activeYear}
                    onChange={(e) => updateAdminForm("activeYear", e.target.value)}
                    aria-label="Survey year"
                  >
                    {Array.from({ length: 26 }, (_, i) => 2015 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="field admin-field-title">
                  <label htmlFor="adminTitle">Survey title</label>
                  <input
                    id="adminTitle"
                    type="text"
                    value={adminForm.ui.title}
                    onChange={(e) => updateAdminForm("ui.title", e.target.value)}
                    placeholder={DEFAULT_CONFIG.ui.title}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="adminIntro">Intro (shown under the title)</label>
                <textarea
                  id="adminIntro"
                  rows={4}
                  value={adminForm.ui.intro}
                  onChange={(e) => updateAdminForm("ui.intro", e.target.value)}
                  placeholder={DEFAULT_CONFIG.ui.intro}
                />
              </div>
            </div>

            <div className="admin-section">
              <h3 className="admin-section-title">Step labels</h3>
              <p className="field-help">These labels appear in the progress header.</p>
              <div className="admin-row admin-row-header" aria-hidden="true">
                <span className="admin-col-label">Label</span>
                <span className="admin-col-action" />
              </div>
              {(adminForm.stepLabels || []).map((label, idx) => (
                <div key={idx} className="admin-row">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const next = [...(adminForm.stepLabels || [])];
                      next[idx] = e.target.value;
                      updateAdminForm("stepLabels", next);
                    }}
                    placeholder={`Step ${idx + 1}`}
                    aria-label={`Step label ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="admin-btn-remove"
                    onClick={() => updateAdminForm("stepLabels", (adminForm.stepLabels || []).filter((_, i) => i !== idx))}
                    aria-label={`Remove step label ${idx + 1}`}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary admin-btn-add"
                onClick={() => updateAdminForm("stepLabels", (prev) => [...(prev.stepLabels || []), ""])}
              >
                + Add step label
              </button>
            </div>
          </div>

          {adminError && <p className="error">{adminError}</p>}
          {adminSaveNotice && (
            <div className="admin-save-popup" role="status" aria-live="polite">
              <span className="admin-save-popup-icon" aria-hidden>✓</span>
              <span>{adminSaveNotice}</span>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className={`survey-shell${!surveyStarted ? " survey-shell--landing" : ""}`}>
      <header className="survey-header">
        <div className="brand">
          <button
            type="button"
            className="brand-logo-btn"
            onClick={handleLogoClick}
            aria-label="Polomolok Water District logo"
          >
            <img
              className="brand-logo"
              src="./pwd-logo.jpg"
              alt=""
              draggable="false"
            />
          </button>
          <div>
            <p className="brand-name">Polomolok Water District</p>
            <p className="brand-tagline">
              Adapting with Resiliency Delivering with Efficiency
            </p>
          </div>
        </div>
        <h1>{surveyConfig.ui?.title || DEFAULT_CONFIG.ui.title}</h1>
        <p>{surveyConfig.ui?.intro || DEFAULT_CONFIG.ui.intro}</p>
        {surveyStarted && !submitted && (
          <>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="tag">
              Step {step + 1} of {stepLabels.length}: {stepLabels[step]}
            </div>
          </>
        )}
      </header>

      {!surveyStarted ? (
        <section className="survey-landing" aria-labelledby="landing-heading">
          <div className="survey-landing-wave" aria-hidden="true">
            <svg viewBox="0 0 400 24" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 12 Q100 0 200 12 T400 12" stroke="rgba(56,189,248,0.35)" strokeWidth="2" fill="none" />
              <path d="M0 16 Q100 6 200 16 T400 16" stroke="rgba(14,165,233,0.2)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div className="survey-landing-card">
            <span className="survey-landing-badge" aria-hidden="true">Quick • 5 steps</span>
            <h2 id="landing-heading" className="survey-landing-title">We'd love to hear from you</h2>
            <p className="survey-landing-intro">
              This short survey takes a few minutes. Your feedback helps us improve our services.
            </p>
            <div className="survey-landing-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className="actions">
              <button type="button" className="primary survey-landing-cta" onClick={() => setSurveyStarted(true)}>
                Start survey
              </button>
            </div>
          </div>
        </section>
      ) : submitted ? (
        <section className="thank-you" aria-live="polite">
          <h2>Thanks for your feedback!</h2>
          {saveSuccess && !savedLocallyOnly && (
            <p className="success">Response saved. Thank you!</p>
          )}
          {savedLocallyOnly && (
            <p className="thank-you-local">Your responses have been recorded on this device. They are not sent to a server.</p>
          )}
          <p>
            We have recorded your responses. Your feedback helps this office provide better service.
          </p>
          <div className="actions">
            <button className="primary" type="button" onClick={resetSurvey}>
              Submit another response
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="survey-grid" aria-label="Survey form">
          {!configLoaded && (
            <p className="field-help" role="status">
              Loading questions...
            </p>
          )}
          {step === 0 && (
            <>
              <QuestionRow
                label="Client type"
                help="Choose one option."
              >
                <fieldset className="field">
                  <legend className="sr-only" id="client-type-legend">
                    Client type
                  </legend>
                  <div className="options" role="radiogroup" aria-labelledby="client-type-legend">
                    {CLIENT_TYPES.map((opt) => (
                      <label
                        key={opt.id}
                        className={`option-card ${formState.clientType === opt.id ? "active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="clientType"
                          value={opt.id}
                          checked={formState.clientType === opt.id}
                          onChange={() => updateField("clientType", opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>

              <QuestionRow label="Date" help="Required." htmlFor="date">
                <div className="field">
                  <input
                    id="date"
                    type="date"
                    value={formState.date}
                    onChange={(e) => updateField("date", e.target.value)}
                    onFocus={(e) => {
                      if (!formState.date) {
                        const today = new Date().toISOString().slice(0, 10);
                        updateField("date", today);
                      }
                    }}
                    required
                  />
                </div>
              </QuestionRow>

              <QuestionRow label="Sex" help="Optional. Choose one." >
                <fieldset className="field">
                  <legend className="sr-only" id="sex-legend">Sex</legend>
                  <div className="options" role="radiogroup" aria-labelledby="sex-legend">
                    {SEX_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`option-card ${formState.sex === opt.id ? "active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="sex"
                          value={opt.id}
                          checked={formState.sex === opt.id}
                          onChange={() => updateField("sex", opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>

              <QuestionRow label="Age" help="Optional." htmlFor="age">
                <div className="field">
                  <input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="120"
                    placeholder="Age"
                    value={formState.age}
                    onChange={(e) => updateField("age", e.target.value)}
                  />
                </div>
              </QuestionRow>

              <QuestionRow label="Region of residence" help="Optional." htmlFor="region">
                <div className="field">
                  <input
                    id="region"
                    type="text"
                    placeholder="Region"
                    value={formState.region}
                    onChange={(e) => updateField("region", e.target.value)}
                  />
                </div>
              </QuestionRow>

              <QuestionRow label="Service availed" help="Required." htmlFor="serviceAvailed">
                <div className="field">
                  <input
                    id="serviceAvailed"
                    type="text"
                    placeholder="Service availed"
                    value={formState.serviceAvailed}
                    onChange={(e) => updateField("serviceAvailed", e.target.value)}
                    required
                  />
                </div>
              </QuestionRow>
            </>
          )}

          {step === 1 && (
            <>
              <QuestionRow
                label="CC1: Awareness of the Citizen’s Charter (CC)"
                help="Which of the following best describes your awareness of a CC?"
              >
                <fieldset className="field">
                  <legend className="sr-only" id="cc1-legend">CC1</legend>
                  <div
                    className="options options--cc1"
                    role="radiogroup"
                    aria-labelledby="cc1-legend"
                  >
                    {CC1_OPTIONS.map((choice) => (
                      <label
                        key={choice.id}
                        className={`option-card ${
                          formState.cc1 === choice.id ? "active" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="cc1"
                          value={choice.id}
                          checked={formState.cc1 === choice.id}
                          onChange={() => updateField("cc1", choice.id)}
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>

              <QuestionRow
                label="CC2: Visibility of this office’s CC"
                help="If aware of CC (answered 1–3 in CC1), would you say that the CC of this office was…?"
              >
                <fieldset className="field">
                  <legend className="sr-only" id="cc2-legend">CC2</legend>
                  <div className="options options--cc2" role="radiogroup" aria-labelledby="cc2-legend" aria-disabled={formState.cc1 === "4"}>
                    {CC2_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`option-card ${formState.cc2 === opt.id ? "active" : ""} ${formState.cc1 === "4" ? "option-card--disabled" : ""}`}
                      >
                        <input
                          type="radio"
                          name="cc2"
                          value={opt.id}
                          checked={formState.cc2 === opt.id}
                          disabled={formState.cc1 === "4"}
                          onChange={() => updateField("cc2", opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>

              <QuestionRow
                label="CC3: Helpfulness of the CC"
                help="If aware of CC (answered 1–3 in CC1), how much did the CC help you in your transaction?"
              >
                <fieldset className="field">
                  <legend className="sr-only" id="cc3-legend">CC3</legend>
                  <div className="options options--cc3" role="radiogroup" aria-labelledby="cc3-legend" aria-disabled={formState.cc1 === "4"}>
                    {CC3_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`option-card ${formState.cc3 === opt.id ? "active" : ""} ${formState.cc1 === "4" ? "option-card--disabled" : ""}`}
                      >
                        <input
                          type="radio"
                          name="cc3"
                          value={opt.id}
                          checked={formState.cc3 === opt.id}
                          disabled={formState.cc1 === "4"}
                          onChange={() => updateField("cc3", opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>
            </>
          )}

          {step === 2 && (
            <>
              <section className="likert-block" aria-label="Service Quality (SQD) questions">
                <div className="likert-header" aria-hidden="true">
                  {LIKERT_OPTIONS.map((opt) => (
                    <span key={opt.id} title={opt.label}>
                      <span className="likert-head-short">{opt.short}</span>
                      <span className="likert-head-long">{opt.label}</span>
                    </span>
                  ))}
                </div>

                {SQD_QUESTIONS.map((q) => (
                  <QuestionRow
                    key={q.id}
                    className="question-row--sqd"
                    label={q.label}
                    help={undefined}
                  >
                    <fieldset className="field">
                      <legend className="sr-only">{q.label}</legend>
                      <div className="scale scale-6" aria-label={`${q.label} rating`} role="radiogroup">
                        {LIKERT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            title={opt.label}
                            aria-label={opt.label}
                            className={(formState.sqd || {})[q.id] === opt.id ? "active" : ""}
                            aria-pressed={(formState.sqd || {})[q.id] === opt.id}
                            onClick={() => updateSQD(q.id, opt.id)}
                          >
                            <span className="likert-short" aria-hidden="true">{opt.short}</span>
                            <span className="likert-long">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </QuestionRow>
                ))}
              </section>
            </>
          )}

          {step === 3 && (
            <>
              <QuestionRow
                label="Suggestions on how we can further improve our services"
                help="Optional."
                htmlFor="suggestions"
              >
                <div className="field">
                  <textarea
                    id="suggestions"
                    placeholder="Type your suggestions (optional)"
                    value={formState.suggestions}
                    onChange={(e) => updateField("suggestions", e.target.value)}
                  />
                </div>
              </QuestionRow>

              <QuestionRow label="Email address" help="Optional." htmlFor="email">
                <div className="field">
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    value={formState.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
              </QuestionRow>
            </>
          )}

          {step === reviewStepIndex && (
            <>
              <section className="summary">
                <h2>Review your answers</h2>
                <div className="summary-grid">
                  <div className="summary-section">
                    <h3>Client information</h3>
                    <div className="summary-item"><span>Client type</span><strong>{CLIENT_TYPES.find((x) => x.id === formState.clientType)?.label || "—"}</strong></div>
                    <div className="summary-item"><span>Date</span><strong>{formState.date || "—"}</strong></div>
                    <div className="summary-item"><span>Sex</span><strong>{SEX_OPTIONS.find((x) => x.id === formState.sex)?.label || "—"}</strong></div>
                    <div className="summary-item"><span>Age</span><strong>{formState.age || "—"}</strong></div>
                    <div className="summary-item"><span>Region</span><strong>{formState.region || "—"}</strong></div>
                    <div className="summary-item"><span>Service availed</span><strong>{formState.serviceAvailed || "—"}</strong></div>
                  </div>

                  <div className="summary-section">
                    <h3>Citizen’s Charter</h3>
                    <div className="summary-item"><span>CC1</span><strong>{CC1_OPTIONS.find((x) => x.id === formState.cc1)?.label || "—"}</strong></div>
                    <div className="summary-item"><span>CC2</span><strong>{CC2_OPTIONS.find((x) => x.id === formState.cc2)?.label || "—"}</strong></div>
                    <div className="summary-item"><span>CC3</span><strong>{CC3_OPTIONS.find((x) => x.id === formState.cc3)?.label || "—"}</strong></div>
                  </div>

                  <div className="summary-section summary-section--wide">
                    <h3>Service Quality (SQD)</h3>
                    <div className="summary-sqd">
                      {SQD_QUESTIONS.map((q) => (
                        <div key={q.id} className="summary-sqd-row">
                          <span className="summary-sqd-q">{q.label}</span>
                          <strong className="summary-sqd-a">{LIKERT_OPTIONS.find((x) => x.id === (formState.sqd || {})[q.id])?.label || "—"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="summary-section">
                    <h3>Other</h3>
                    <div className="summary-item"><span>Suggestions</span><strong className="summary-long">{formState.suggestions ? formState.suggestions : "—"}</strong></div>
                    <div className="summary-item"><span>Email</span><strong>{formState.email || "—"}</strong></div>
                  </div>
                </div>
              </section>
            </>
          )}

          {saveError && (
            <div className="survey-error-popup" role="alert" aria-live="assertive">
              <span className="survey-error-popup-icon" aria-hidden>!</span>
              <span>{saveError}</span>
              <button type="button" className="survey-error-popup-dismiss" onClick={() => setSaveError("")} aria-label="Dismiss">×</button>
            </div>
          )}
          <div className="actions form-actions">
            <button
              type="button"
              className="secondary"
              onClick={step === 0 ? () => setSurveyStarted(false) : handleBack}
            >
              Back
            </button>
            <button
              className="primary"
              type="submit"
              disabled={!canMoveNext || isSaving}
            >
              {step === stepLabels.length - 1
                ? isSaving
                  ? "Saving..."
                  : "Submit survey"
                : "Continue"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
