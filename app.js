const { useEffect, useMemo, useState } = React;

const TOPIC_LABELS = [
  { id: "pressure", label: "Water pressure" },
  { id: "quality", label: "Water quality" },
  { id: "billing", label: "Billing clarity" },
  { id: "support", label: "Customer support" },
];

const EXPERIENCE_CHOICES = [
  { id: "excellent", label: "Excellent" },
  { id: "good", label: "Good" },
  { id: "ok", label: "Okay" },
  { id: "poor", label: "Needs work" },
];

const FEEDBACK_OPTIONS = [
  "Improve water pressure",
  "Improve water quality",
  "Faster response to issues",
  "Clearer billing",
  "Better communication",
  "More consistent schedule",
  "Other (please specify)",
];

const STEP_LABELS = ["Account", "Service", "Ratings", "Comments", "Review"];

const CUSTOM_QUESTION_TYPES = [
  { id: "short", label: "Short answer" },
  { id: "multiple", label: "Multiple choice" },
  { id: "checkboxes", label: "Checkboxes" },
  { id: "dropdown", label: "Dropdown" },
];

const DEFAULT_CONFIG = {
  activeYear: new Date().getFullYear(),
  version: 1,
  ui: {
    title: "Service Satisfaction Survey",
    intro:
      "Share your experience with water service in Polomolok. Your feedback helps us improve quality and keep you informed.",
  },
  stepLabels: STEP_LABELS,
  experienceChoices: EXPERIENCE_CHOICES,
  topics: TOPIC_LABELS,
  feedback: {
    label: "What could we improve this year?",
    helpText: "Choose at least one option.",
    options: FEEDBACK_OPTIONS,
  },
  customQuestions: [],
};

// Set to true when Firebase is deployed and you want to save responses and use server config.
const USE_FIREBASE = false;
const CONFIG_STORAGE_KEY = "pwd_survey_config";

function normalizeCustomQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const label = String(q.label || "").trim();
  if (!label) return null;
  const type = q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short";
  const options = Array.isArray(q.options) ? q.options.filter((o) => o != null && String(o).trim()) : [];
  if (type !== "short" && options.length === 0) return null;
  return { label, helpText: String(q.helpText || "").trim(), type, options };
}

function getLocalSurveyConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/785a02aa-25d4-46af-a53c-911d3080a253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:getLocalSurveyConfig',message:'Config load from storage',data:{hasStored:!!raw,key:CONFIG_STORAGE_KEY},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    if (Array.isArray(merged.customQuestions) && merged.customQuestions.length > 0) {
      merged.customQuestions = merged.customQuestions.map((q) => normalizeCustomQuestion(q)).filter(Boolean);
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

const ACCOUNT_PATTERN = /^[A-Za-z0-9-]{5,}$/;
// Hidden admin: type @DM-######## in account field and click Continue. Only hash stored (no plain code in source).
const ADMIN_CODE_HASH = "sub_557682895";
const ADMIN_CODE_PATTERN = /^@DM-\d{9}$/;

const buildDedupKey = (state) =>
  hashString((state.accountNumber || "").trim().toLowerCase());

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
  accountNumber: "",
  experience: "good",
  nps: 8,
  topics: {
    pressure: 4,
    quality: 4,
    billing: 4,
    support: 4,
  },
  feedback: [],
  feedbackOther: "",
  followUp: true,
  customAnswers: [],
};

function QuestionRow({ label, help, htmlFor, children }) {
  return (
    <div className="question-row">
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
    experienceChoices: [],
    topics: [],
    feedback: { label: "", helpText: "", options: [] },
    customQuestions: [],
  });

  const [surveyStarted, setSurveyStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  const [feedbackTouched, setFeedbackTouched] = useState(false);
  const [surveyConfig, setSurveyConfig] = useState(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);

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
      const normalizeChoice = (x) => typeof x === "object" ? { id: x.id || "", label: x.label || "" } : { id: x, label: x };
      const notEmpty = (x) => String(x.id).trim() || String(x.label).trim();
      let ec = (c.experienceChoices || DEFAULT_CONFIG.experienceChoices).map(normalizeChoice).filter(notEmpty);
      let tc = (c.topics || DEFAULT_CONFIG.topics).map(normalizeChoice).filter(notEmpty);
      if (!ec.length) ec = DEFAULT_CONFIG.experienceChoices.map(normalizeChoice);
      if (!tc.length) tc = DEFAULT_CONFIG.topics.map(normalizeChoice);
      setAdminForm({
        activeYear: c.activeYear ?? new Date().getFullYear(),
        ui: { title: c.ui?.title ?? DEFAULT_CONFIG.ui.title, intro: c.ui?.intro ?? DEFAULT_CONFIG.ui.intro },
        experienceChoices: ec,
        topics: tc,
        feedback: {
          label: c.feedback?.label ?? DEFAULT_CONFIG.feedback.label,
          helpText: c.feedback?.helpText ?? DEFAULT_CONFIG.feedback.helpText,
          options: (() => {
            const opts = (c.feedback?.options || DEFAULT_CONFIG.feedback.options).filter((o) => String(o).trim());
            return opts.length ? opts : [...DEFAULT_CONFIG.feedback.options];
          })(),
        },
        customQuestions: Array.isArray(c.customQuestions) && c.customQuestions.length > 0
          ? c.customQuestions.map((q) => ({
              label: q.label || "",
              helpText: q.helpText || "",
              type: q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short",
              options: Array.isArray(q.options) ? [...q.options] : [],
            }))
          : [],
      });
    }
  }, [route, configLoaded]);

  const customQuestions = useMemo(() => {
    if (!Array.isArray(surveyConfig.customQuestions)) return [];
    return surveyConfig.customQuestions.filter((q) => {
      if (!q || !String(q.label).trim()) return false;
      const type = q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short";
      if (type === "short") return true;
      const opts = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
      return opts.length > 0;
    });
  }, [surveyConfig.customQuestions]);
  const stepLabels = useMemo(() => {
    const base = surveyConfig.stepLabels || STEP_LABELS;
    const withoutReview = base.slice(0, -1);
    return [...withoutReview, ...(customQuestions.length ? ["Additional"] : []), "Review"];
  }, [surveyConfig.stepLabels, customQuestions.length]);
  const experienceChoices = surveyConfig.experienceChoices || EXPERIENCE_CHOICES;
  const topics = surveyConfig.topics || TOPIC_LABELS;
  const feedbackConfig = surveyConfig.feedback || DEFAULT_CONFIG.feedback;
  const customStepIndex = customQuestions.length ? 4 : -1;
  const reviewStepIndex = stepLabels.length - 1;

  const progress = useMemo(
    () => ((step + 1) / stepLabels.length) * 100,
    [step, stepLabels.length]
  );

  const overallScore = useMemo(() => {
    const values = Object.values(formState.topics);
    const total = values.reduce((sum, value) => sum + value, 0);
    return (total / values.length).toFixed(1);
  }, [formState.topics]);

  const isAccountValid = useMemo(() => {
    const value = formState.accountNumber.trim();
    return (
      value.length === 0 ||
      ACCOUNT_PATTERN.test(value) ||
      ADMIN_CODE_PATTERN.test(value)
    );
  }, [formState.accountNumber]);

  const canMoveNext = useMemo(() => {
    if (step === 0) {
      return isAccountValid && formState.accountNumber.trim().length > 0;
    }
    if (step === 3) {
      const hasAny = formState.feedback.length > 0;
      const otherSelected = formState.feedback.some((item) =>
        String(item).toLowerCase().startsWith("other")
      );
      if (!hasAny) return false;
      if (!otherSelected) return true;
      return formState.feedbackOther.trim().length >= 3;
    }
    return true;
  }, [formState, isAccountValid, step]);

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateTopic = (topic, value) => {
    setFormState((prev) => ({
      ...prev,
      topics: {
        ...prev.topics,
        [topic]: value,
      },
    }));
  };

  const updateCustomAnswer = (index, value) => {
    setFormState((prev) => {
      const next = [...(prev.customAnswers || [])];
      next[index] = value;
      return { ...prev, customAnswers: next };
    });
  };

  const toggleFeedbackOption = (option) => {
    setFormState((prev) => {
      const exists = prev.feedback.includes(option);
      return {
        ...prev,
        feedback: exists
          ? prev.feedback.filter((item) => item !== option)
          : [...prev.feedback, option],
      };
    });
  };

  const sendResponse = async () => {
    // #region agent log
    const dedupeKeyPre = buildDedupKey(formState);
    const clientSideDedupe = dedupeKeyPre.length > 0 && localStorage.getItem(`pwdSubmission:${dedupeKeyPre}`) === "1";
    fetch('http://127.0.0.1:7243/ingest/785a02aa-25d4-46af-a53c-911d3080a253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:sendResponse',message:'Submit path',data:{useFirebase:USE_FIREBASE,clientSideDedupe},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (!USE_FIREBASE) {
      setSaveError("Saving responses is not set up yet. Please try again later.");
      return "error";
    }
    if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === "YOUR_PROJECT_ID") {
      setSaveError("Firebase is not configured. Set FIREBASE_CONFIG in app.js.");
      return "error";
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const dedupeKey = buildDedupKey(formState);
    const submissionId = dedupeKey;
    const localDuplicate =
      dedupeKey.length > 0 &&
      localStorage.getItem(`pwdSubmission:${submissionId}`) === "1";
    setDuplicateNotice(localDuplicate);

    const otherSelected = formState.feedback.some((item) =>
      String(item).toLowerCase().startsWith("other")
    );
    const feedbackText = otherSelected
      ? `${formState.feedback.join(", ")}: ${formState.feedbackOther.trim()}`
      : formState.feedback.join(", ");

    const payload = {
      ...formState,
      accountNumber: dedupeKey,
      overallScore,
      feedback: feedbackText,
      customAnswers: formState.customAnswers || [],
      dedupeKey,
      submissionId,
      submittedAt: new Date().toISOString(),
    };

    try {
      const submitSurvey = getCallable("submitSurvey");
      const { data } = await submitSurvey(payload);

      if (data && data.duplicate) {
        setDuplicateNotice(true);
        return "duplicate";
      }
      if (!localDuplicate) {
        setSaveSuccess(true);
      }
      if (dedupeKey.length > 0) {
        localStorage.setItem(`pwdSubmission:${submissionId}`, "1");
      }
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
      if (step === 3) {
        setFeedbackTouched(true);
      }
      return;
    }
    if (step === 0) {
      const value = formState.accountNumber.trim();
      if (ADMIN_CODE_PATTERN.test(value)) {
        const hashMatch = hashString(value) === ADMIN_CODE_HASH;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/785a02aa-25d4-46af-a53c-911d3080a253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:handleSubmit',message:'Admin code check',data:{patternMatch:true,hashMatch},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        if (hashMatch) {
          openAdmin();
          return;
        }
        setSaveError("Invalid admin code.");
        return;
      }
    }
    if (step < stepLabels.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    const result = await sendResponse();
    if (result === "ok" || result === "duplicate") {
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
    setDuplicateNotice(false);
  };

  const openAdmin = () => {
    sessionStorage.setItem("pwd_admin_ok", "1");
    window.location.hash = "#/admin";
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
    const normalizeChoice = (x) => typeof x === "object" ? { id: x.id || "", label: x.label || "" } : { id: x, label: x };
    const notEmpty = (x) => String(x.id).trim() || String(x.label).trim();
    let ec = (c.experienceChoices || DEFAULT_CONFIG.experienceChoices).map(normalizeChoice).filter(notEmpty);
    let tc = (c.topics || DEFAULT_CONFIG.topics).map(normalizeChoice).filter(notEmpty);
    if (!ec.length) ec = DEFAULT_CONFIG.experienceChoices.map(normalizeChoice);
    if (!tc.length) tc = DEFAULT_CONFIG.topics.map(normalizeChoice);
    setAdminForm({
      activeYear: c.activeYear ?? new Date().getFullYear(),
      ui: {
        title: c.ui?.title ?? DEFAULT_CONFIG.ui.title,
        intro: c.ui?.intro ?? DEFAULT_CONFIG.ui.intro,
      },
      experienceChoices: ec,
      topics: tc,
      feedback: {
        label: c.feedback?.label ?? DEFAULT_CONFIG.feedback.label,
        helpText: c.feedback?.helpText ?? DEFAULT_CONFIG.feedback.helpText,
        options: (() => {
          const opts = (c.feedback?.options || DEFAULT_CONFIG.feedback.options).filter((o) => String(o).trim());
          return opts.length ? opts : [...DEFAULT_CONFIG.feedback.options];
        })(),
      },
      customQuestions: Array.isArray(c.customQuestions) && c.customQuestions.length > 0
        ? c.customQuestions.map((q) => ({
            label: q.label || "",
            helpText: q.helpText || "",
            type: q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short",
            options: Array.isArray(q.options) ? [...q.options] : [],
          }))
        : [],
    });
  };

  const saveAdminDraft = () => {
    setAdminSaveNotice("");
    setAdminError("");
    const f = adminForm;
    const withIds = (arr) => arr.filter((x) => String(x.label).trim()).map((x) => ({ id: slugFromLabel(x.label) || x.id || "", label: String(x.label).trim() })).filter((x) => x.id);
    const merged = {
      ...DEFAULT_CONFIG,
      activeYear: Number(f.activeYear) || new Date().getFullYear(),
      ui: { title: String(f.ui.title).trim() || DEFAULT_CONFIG.ui.title, intro: String(f.ui.intro).trim() || DEFAULT_CONFIG.ui.intro },
      experienceChoices: withIds(f.experienceChoices).length ? withIds(f.experienceChoices) : DEFAULT_CONFIG.experienceChoices,
      topics: withIds(f.topics).length ? withIds(f.topics) : DEFAULT_CONFIG.topics,
      feedback: {
        label: String(f.feedback.label).trim() || DEFAULT_CONFIG.feedback.label,
        helpText: String(f.feedback.helpText).trim() || DEFAULT_CONFIG.feedback.helpText,
        options: f.feedback.options.filter(Boolean).length ? f.feedback.options.filter(Boolean) : DEFAULT_CONFIG.feedback.options,
      },
      customQuestions: Array.isArray(f.customQuestions)
        ? f.customQuestions.filter((q) => String(q.label).trim()).map((q) => ({
            label: String(q.label).trim(),
            helpText: String(q.helpText || "").trim(),
            type: q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short",
            options: Array.isArray(q.options) ? q.options.filter(Boolean).map(String) : [],
          }))
        : [],
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
      else if (path === "feedback.label") next.feedback = { ...prev.feedback, label: value };
      else if (path === "feedback.helpText") next.feedback = { ...prev.feedback, helpText: value };
      else if (path === "experienceChoices") next.experienceChoices = value;
      else if (path === "topics") next.topics = value;
      else if (path === "feedback.options") next.feedback = { ...prev.feedback, options: value };
      else if (path === "customQuestions") next.customQuestions = value;
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
          <p className="admin-intro">Update the year, title, questions, and options below. Changes are saved to this device.</p>
          <div className="actions">
            <button className="secondary" type="button" onClick={openSurvey}>
              Back to survey
            </button>
          </div>
        </header>

        {(() => {
          const adminOk = !!sessionStorage.getItem("pwd_admin_ok");
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/785a02aa-25d4-46af-a53c-911d3080a253',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:admin-render',message:'Admin gate',data:{route:'admin',adminPanelShown:adminOk},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return !adminOk ? (
          <section className="thank-you" aria-live="polite">
            <h2>Access denied</h2>
            <p>Use the survey and enter the admin code to open this page.</p>
            <div className="actions">
              <button className="secondary" type="button" onClick={openSurvey}>
                Back to survey
              </button>
            </div>
          </section>
        ) : (
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
                      placeholder="Service Satisfaction Survey"
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="adminIntro">Short intro (shown under the title)</label>
                  <textarea
                    id="adminIntro"
                    rows={3}
                    value={adminForm.ui.intro}
                    onChange={(e) => updateAdminForm("ui.intro", e.target.value)}
                    placeholder="Tell us how your water service has been..."
                  />
                </div>
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">Experience choices (Step: Service)</h3>
                <p className="field-help">Options for &quot;How would you rate your water service overall?&quot;</p>
                <div className="admin-row admin-row-header" aria-hidden="true">
                  <span className="admin-col-label">Display label</span>
                  <span className="admin-col-action" />
                </div>
                {adminForm.experienceChoices.map((item, idx) => (
                  <div key={idx} className="admin-row">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const next = [...adminForm.experienceChoices];
                        next[idx] = { ...next[idx], label: e.target.value };
                        updateAdminForm("experienceChoices", next);
                      }}
                      placeholder="e.g. Excellent"
                      aria-label={`Choice ${idx + 1} label`}
                    />
                    <button type="button" className="admin-btn-remove" onClick={() => updateAdminForm("experienceChoices", adminForm.experienceChoices.filter((_, i) => i !== idx))} aria-label={`Remove choice ${idx + 1}`}>−</button>
                  </div>
                ))}
                <button type="button" className="secondary admin-btn-add" onClick={() => updateAdminForm("experienceChoices", (prev) => [...prev.experienceChoices, { id: "", label: "" }])}>+ Add choice</button>
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">Topic ratings (Step: Ratings)</h3>
                <p className="field-help">Each row is one topic customers rate 1–5.</p>
                <div className="admin-row admin-row-header" aria-hidden="true">
                  <span className="admin-col-label">Display label</span>
                  <span className="admin-col-action" />
                </div>
                {adminForm.topics.map((item, idx) => (
                  <div key={idx} className="admin-row">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const next = [...adminForm.topics];
                        next[idx] = { ...next[idx], label: e.target.value };
                        updateAdminForm("topics", next);
                      }}
                      placeholder="e.g. Water pressure"
                      aria-label={`Topic ${idx + 1} label`}
                    />
                    <button type="button" className="admin-btn-remove" onClick={() => updateAdminForm("topics", adminForm.topics.filter((_, i) => i !== idx))} aria-label={`Remove topic ${idx + 1}`}>−</button>
                  </div>
                ))}
                <button type="button" className="secondary admin-btn-add" onClick={() => updateAdminForm("topics", (prev) => [...prev.topics, { id: "", label: "" }])}>+ Add topic</button>
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">Feedback (Step: Comments)</h3>
                <div className="field">
                  <label htmlFor="adminFeedbackLabel">Question label</label>
                  <input
                    id="adminFeedbackLabel"
                    type="text"
                    value={adminForm.feedback.label}
                    onChange={(e) => updateAdminForm("feedback.label", e.target.value)}
                    placeholder="What could we improve this year?"
                  />
                </div>
                <div className="field">
                  <label htmlFor="adminFeedbackHelp">Help text</label>
                  <input
                    id="adminFeedbackHelp"
                    type="text"
                    value={adminForm.feedback.helpText}
                    onChange={(e) => updateAdminForm("feedback.helpText", e.target.value)}
                    placeholder="Choose at least one option."
                  />
                </div>
                <p className="field-help">Options (one per line / add with +)</p>
                {adminForm.feedback.options.map((opt, idx) => (
                  <div key={idx} className="admin-row">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...adminForm.feedback.options];
                        next[idx] = e.target.value;
                        updateAdminForm("feedback.options", next);
                      }}
                      placeholder="Option text"
                    />
                    <button type="button" className="admin-btn-remove" onClick={() => updateAdminForm("feedback.options", adminForm.feedback.options.filter((_, i) => i !== idx))} aria-label="Remove">−</button>
                  </div>
                ))}
                <button type="button" className="secondary admin-btn-add" onClick={() => updateAdminForm("feedback.options", (prev) => [...prev.feedback.options, ""])}>+ Add option</button>
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">Additional questions</h3>
                <p className="field-help">Choose question type: Short answer, Multiple choice, Checkboxes, or Dropdown. For choice types, add options below.</p>
                {(adminForm.customQuestions || []).map((item, idx) => {
                  const type = item.type === "multiple" || item.type === "checkboxes" || item.type === "dropdown" ? item.type : "short";
                  const hasOptions = type !== "short";
                  const options = Array.isArray(item.options) ? item.options : [];
                  return (
                    <div key={idx} className="admin-question-block">
                      <div className="admin-row">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const next = [...(adminForm.customQuestions || [])];
                            next[idx] = { ...next[idx], label: e.target.value };
                            updateAdminForm("customQuestions", next);
                          }}
                          placeholder="Question label"
                          className="admin-question-label"
                        />
                        <select
                          className="admin-question-type"
                          value={type}
                          onChange={(e) => {
                            const next = [...(adminForm.customQuestions || [])];
                            const newType = e.target.value;
                            next[idx] = {
                              ...next[idx],
                              type: newType === "multiple" || newType === "checkboxes" || newType === "dropdown" ? newType : "short",
                              options: newType === "short" ? [] : (next[idx].options || []),
                            };
                            updateAdminForm("customQuestions", next);
                          }}
                          aria-label="Question type"
                        >
                          {CUSTOM_QUESTION_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                        <button type="button" className="admin-btn-remove" onClick={() => updateAdminForm("customQuestions", (adminForm.customQuestions || []).filter((_, i) => i !== idx))} aria-label="Remove question">−</button>
                      </div>
                      <div className="field">
                        <label htmlFor={`admin-cq-help-${idx}`} className="sr-only">Help text</label>
                        <input
                          id={`admin-cq-help-${idx}`}
                          type="text"
                          value={item.helpText || ""}
                          onChange={(e) => {
                            const next = [...(adminForm.customQuestions || [])];
                            next[idx] = { ...next[idx], helpText: e.target.value };
                            updateAdminForm("customQuestions", next);
                          }}
                          placeholder="Help text (optional)"
                        />
                      </div>
                      {hasOptions && (
                        <div className="admin-question-options">
                          <p className="field-help">Options</p>
                          {options.map((opt, oidx) => (
                            <div key={oidx} className="admin-row">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const next = [...(adminForm.customQuestions || [])];
                                  const q = { ...next[idx], options: [...(next[idx].options || [])] };
                                  q.options[oidx] = e.target.value;
                                  next[idx] = q;
                                  updateAdminForm("customQuestions", next);
                                }}
                                placeholder="Option"
                              />
                              <button type="button" className="admin-btn-remove" onClick={() => {
                                const next = [...(adminForm.customQuestions || [])];
                                const q = { ...next[idx], options: (next[idx].options || []).filter((_, i) => i !== oidx) };
                                next[idx] = q;
                                updateAdminForm("customQuestions", next);
                              }} aria-label="Remove option">−</button>
                            </div>
                          ))}
                          <button type="button" className="secondary admin-btn-add" onClick={() => {
                            const next = [...(adminForm.customQuestions || [])];
                            const q = { ...next[idx], options: [...(next[idx].options || []), ""] };
                            next[idx] = q;
                            updateAdminForm("customQuestions", next);
                          }}>+ Add option</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="secondary admin-btn-add" onClick={() => updateAdminForm("customQuestions", (prev) => [...(prev.customQuestions || []), { label: "", helpText: "", type: "short", options: [] }])}>+ Add question</button>
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
        );
        })()}
      </main>
    );
  }

  return (
    <main className={`survey-shell${!surveyStarted ? " survey-shell--landing" : ""}`}>
      <header className="survey-header">
        <div className="brand">
          <img
            className="brand-logo"
            src="./pwd-logo.jpg"
            alt="Polomolok Water District logo"
          />
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
              This short survey takes a few minutes. Your feedback helps us improve water service in Polomolok.
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
          {saveSuccess && (
            <p className="success">Response saved. Thank you!</p>
          )}
          {duplicateNotice && (
            <p className="warning">Only one submission per person is allowed.</p>
          )}
          <p>
            We have recorded your responses and will share improvements with our
            service team. Your overall satisfaction score:{" "}
            <strong>{overallScore} / 5</strong>
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
                label="Account number"
                help="Enter your account number (letters/numbers)."
                htmlFor="accountNumber"
              >
                <div className="field">
                  <input
                    id="accountNumber"
                    type="text"
                    placeholder="ACC-00012345"
                    aria-invalid={!isAccountValid}
                    value={formState.accountNumber}
                    onChange={(event) => {
                      setSaveError("");
                      updateField("accountNumber", event.target.value);
                    }}
                    required
                  />
                  {!isAccountValid && (
                    <p className="field-hint">Use at least 5 letters or numbers.</p>
                  )}
                </div>
              </QuestionRow>
            </>
          )}

          {step === 1 && (
            <>
              <QuestionRow
                label="How would you rate your water service overall?"
                help="Choose one option."
              >
                <fieldset className="field">
                  <legend className="sr-only" id="experience-legend">
                    How would you rate your water service overall?
                  </legend>
                  <div
                    className="options"
                    role="radiogroup"
                    aria-labelledby="experience-legend"
                  >
                    {experienceChoices.map((choice) => (
                      <label
                        key={choice.id}
                        className={`option-card ${
                          formState.experience === choice.id ? "active" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="experience"
                          value={choice.id}
                          checked={formState.experience === choice.id}
                          onChange={(event) =>
                            updateField("experience", event.target.value)
                          }
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </QuestionRow>

              <QuestionRow
                label="How likely are you to recommend our utility service?"
                help="Tap a number from 1 to 10."
              >
                <fieldset className="field">
                  <legend className="sr-only">
                    How likely are you to recommend our utility service?
                  </legend>
                  <div className="scale scale-nps">
                    {Array.from({ length: 10 }, (_, idx) => idx + 1).map(
                      (score) => (
                        <button
                          key={score}
                          type="button"
                          className={formState.nps === score ? "active" : ""}
                          aria-pressed={formState.nps === score}
                          onClick={() => updateField("nps", score)}
                        >
                          {score}
                        </button>
                      )
                    )}
                  </div>
                </fieldset>
              </QuestionRow>
            </>
          )}

          {step === 2 && (
            <>
              {topics.map((topic) => (
                <QuestionRow
                  key={topic.id}
                  label={topic.label}
                  help="Rate 1 (low) to 5 (high)."
                >
                  <div className="scale scale-5" aria-label={`${topic.label} rating`}>
                    {Array.from({ length: 5 }, (_, idx) => idx + 1).map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          className={
                            formState.topics[topic.id] === value ? "active" : ""
                          }
                          aria-pressed={formState.topics[topic.id] === value}
                          onClick={() => updateTopic(topic.id, value)}
                        >
                          {value}
                        </button>
                      )
                    )}
                  </div>
                </QuestionRow>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <QuestionRow
                label={feedbackConfig.label || DEFAULT_CONFIG.feedback.label}
                help={feedbackConfig.helpText || DEFAULT_CONFIG.feedback.helpText}
              >
                <div className="choice-grid">
                  {(feedbackConfig.options || DEFAULT_CONFIG.feedback.options).map(
                    (option) => {
                      const isActive = formState.feedback.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`choice-pill ${isActive ? "active" : ""}`}
                          aria-pressed={isActive}
                          onClick={() => {
                            toggleFeedbackOption(option);
                            if (!String(option).toLowerCase().startsWith("other")) {
                              return;
                            }
                            // If user deselects Other, clear text.
                            const willBeSelected = !formState.feedback.includes(option);
                            if (!willBeSelected) {
                              updateField("feedbackOther", "");
                            }
                          }}
                        >
                          {option}
                        </button>
                      );
                    }
                  )}
                </div>
                {(() => {
                  const otherSelected = formState.feedback.some((item) =>
                    String(item).toLowerCase().startsWith("other")
                  );
                  if (feedbackTouched && formState.feedback.length === 0) {
                    return (
                      <p className="field-hint">Please choose at least one option.</p>
                    );
                  }
                  if (
                    feedbackTouched &&
                    otherSelected &&
                    formState.feedbackOther.trim().length < 3
                  ) {
                    return (
                      <p className="field-hint">
                        Please type a short “Other” response (at least 3 characters).
                      </p>
                    );
                  }
                  return null;
                })()}

                {formState.feedback.some((item) =>
                  String(item).toLowerCase().startsWith("other")
                ) && (
                  <div className="field">
                    <label htmlFor="feedbackOther" className="sr-only">
                      Other feedback
                    </label>
                    <input
                      id="feedbackOther"
                      type="text"
                      placeholder="Type your suggestion"
                      value={formState.feedbackOther}
                      onChange={(e) => updateField("feedbackOther", e.target.value)}
                      onBlur={() => setFeedbackTouched(true)}
                    />
                  </div>
                )}
              </QuestionRow>
            </>
          )}

          {step === customStepIndex && customStepIndex >= 0 && (
            <>
              {customQuestions.map((q, idx) => {
                const type = q.type === "multiple" || q.type === "checkboxes" || q.type === "dropdown" ? q.type : "short";
                const options = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
                const value = (formState.customAnswers || [])[idx];
                const selectedArr = Array.isArray(value) ? value : [];

                return (
                  <QuestionRow
                    key={idx}
                    label={q.label}
                    help={q.helpText || undefined}
                    htmlFor={type === "short" || type === "dropdown" ? `custom-q-${idx}` : undefined}
                  >
                    {type === "short" && (
                      <div className="field">
                        <input
                          id={`custom-q-${idx}`}
                          type="text"
                          placeholder="Your answer (optional)"
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => updateCustomAnswer(idx, e.target.value)}
                        />
                      </div>
                    )}
                    {type === "multiple" && (
                      <fieldset className="field">
                        <legend className="sr-only">{q.label}</legend>
                        <div className="options" role="radiogroup" aria-label={q.label}>
                          {options.map((opt) => (
                            <label key={opt} className={`option-card ${value === opt ? "active" : ""}`}>
                              <input
                                type="radio"
                                name={`custom-${idx}`}
                                value={opt}
                                checked={value === opt}
                                onChange={() => updateCustomAnswer(idx, opt)}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {type === "checkboxes" && (
                      <div className="choice-grid">
                        {options.map((opt) => {
                          const isActive = selectedArr.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`choice-pill ${isActive ? "active" : ""}`}
                              aria-pressed={isActive}
                              onClick={() => {
                                const next = isActive ? selectedArr.filter((x) => x !== opt) : [...selectedArr, opt];
                                updateCustomAnswer(idx, next);
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {type === "dropdown" && (
                      <div className="field">
                        <select
                          id={`custom-q-${idx}`}
                          value={typeof value === "string" && value ? value : ""}
                          onChange={(e) => updateCustomAnswer(idx, e.target.value)}
                          aria-label={q.label}
                        >
                          <option value="">Choose...</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </QuestionRow>
                );
              })}
            </>
          )}

          {step === reviewStepIndex && (
            <>
              <QuestionRow
                label="Contact permission"
                help="Optional. Check if it's okay to contact you."
              >
                <div className="field">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={formState.followUp}
                      onChange={(event) =>
                        updateField("followUp", event.target.checked)
                      }
                    />
                    <span>It's okay to contact me about my feedback</span>
                  </label>
                </div>
              </QuestionRow>
              <section className="summary">
                <h2>Review your answers</h2>
              <div className="summary-item">
                <span>Account number</span>
                <strong>{formState.accountNumber || "Not provided"}</strong>
              </div>
              <div className="summary-item">
                <span>Experience</span>
                <strong>
                  {
                    experienceChoices.find(
                      (choice) => choice.id === formState.experience
                    )?.label
                  }
                </strong>
              </div>
              <div className="summary-item">
                <span>Recommendation score</span>
                <strong>{formState.nps} / 10</strong>
              </div>
              <div className="summary-item">
                <span>Overall satisfaction</span>
                <strong>{overallScore} / 5</strong>
              </div>
              <div className="summary-item">
                <span>Feedback</span>
                <strong>
                  {formState.feedback.length > 0
                    ? formState.feedback.join(", ")
                    : "No selection"}
                </strong>
              </div>
              {customQuestions.length > 0 && customQuestions.map((q, idx) => {
                const val = (formState.customAnswers || [])[idx];
                const display = val == null || val === ""
                  ? "—"
                  : Array.isArray(val)
                    ? val.join(", ")
                    : String(val);
                return (
                  <div key={idx} className="summary-item">
                    <span>{q.label}</span>
                    <strong>{display}</strong>
                  </div>
                );
              })}
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
