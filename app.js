const { useMemo, useState } = React;

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

const PURPOSE_OPTIONS = [
  "Residential service",
  "Commercial service",
  "Move-in or move-out",
  "Reporting an issue",
];

const ZONE_OPTIONS = [
  "North Zone",
  "East Zone",
  "South Zone",
  "West Zone",
  "Central Zone",
];

const STEP_LABELS = ["Account", "Service", "Ratings", "Comments", "Review"];

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxT3RAA8W2BSQIPGY0BX_nRhQQDY2Dkb6BBoMWo5o5S1wfclT3_ysMuyMlPn2N--hXz/exec";

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,}$/;
const ACCOUNT_PATTERN = /^[A-Za-z0-9-]{5,}$/;

const buildDedupKey = (state, overallScoreValue) => {
  const topicValues = [
    state.topics.pressure,
    state.topics.quality,
    state.topics.billing,
    state.topics.support,
  ];
  return [
    state.name.trim().toLowerCase(),
    state.email.trim().toLowerCase(),
    state.phone.trim(),
    state.accountNumber.trim().toLowerCase(),
    state.zone,
    state.purpose,
    state.experience,
    state.nps,
    ...topicValues,
    overallScoreValue,
    state.feedback.trim().toLowerCase(),
    state.followUp ? "yes" : "no",
  ].join("|");
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `sub_${Math.abs(hash)}`;
};

const DEFAULT_STATE = {
  name: "",
  email: "",
  phone: "",
  accountNumber: "",
  zone: "Central Zone",
  purpose: "Residential service",
  experience: "good",
  nps: 8,
  topics: {
    pressure: 4,
    quality: 4,
    billing: 4,
    support: 4,
  },
  feedback: "",
  followUp: true,
};

function App() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const progress = useMemo(
    () => ((step + 1) / STEP_LABELS.length) * 100,
    [step]
  );

  const overallScore = useMemo(() => {
    const values = Object.values(formState.topics);
    const total = values.reduce((sum, value) => sum + value, 0);
    return (total / values.length).toFixed(1);
  }, [formState.topics]);

  const isPhoneValid = useMemo(() => {
    const value = formState.phone.trim();
    return value.length === 0 || PHONE_PATTERN.test(value);
  }, [formState.phone]);

  const isAccountValid = useMemo(() => {
    const value = formState.accountNumber.trim();
    return value.length === 0 || ACCOUNT_PATTERN.test(value);
  }, [formState.accountNumber]);

  const canMoveNext = useMemo(() => {
    if (step === 0) {
      return (
        formState.name.trim().length > 0 &&
        formState.email.trim().length > 0 &&
        isPhoneValid &&
        isAccountValid
      );
    }
    if (step === 3) {
      return formState.feedback.trim().length > 4;
    }
    return true;
  }, [formState, isAccountValid, isPhoneValid, step]);

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

  const sendResponse = async () => {
    if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR_SCRIPT_ID")) {
      setSaveError("Missing Google Sheets script URL.");
      return false;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const submissionId = hashString(buildDedupKey(formState, overallScore));
    const payload = {
      ...formState,
      overallScore,
      submissionId,
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload),
      });

      // With no-cors we can't read the response; assume success if no error.
      setSaveSuccess(true);
      return true;
    } catch (error) {
      setSaveError("We couldn't save your response. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canMoveNext) {
      return;
    }
    if (step < STEP_LABELS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    const saved = await sendResponse();
    if (saved) {
      setSubmitted(true);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const resetSurvey = () => {
    setFormState(DEFAULT_STATE);
    setStep(0);
    setSubmitted(false);
    setSaveSuccess(false);
  };

  return (
    <main className="survey-shell">
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
        <h1>Service Satisfaction Survey</h1>
        <p>
          Tell us how your water service has been performing in Polomolok. This
          quick survey helps us improve service quality and communication.
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="tag">
          Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
        </div>
      </header>

      {submitted ? (
        <section className="thank-you" aria-live="polite">
          <h2>Thanks for your feedback, {formState.name}!</h2>
          {saveSuccess && (
            <p className="success">Response saved. Thank you!</p>
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
        <form onSubmit={handleSubmit} className="survey-grid">
          {step === 0 && (
            <>
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Avery Johnson"
                  autoComplete="name"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1 555 123 4567"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={!isPhoneValid}
                  value={formState.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
                {!isPhoneValid && (
                  <p className="field-hint">Enter at least 7 digits.</p>
                )}
              </div>
              <div className="field">
                <label htmlFor="accountNumber">Account number</label>
                <input
                  id="accountNumber"
                  type="text"
                  placeholder="ACC-00012345"
                  aria-invalid={!isAccountValid}
                  value={formState.accountNumber}
                  onChange={(event) =>
                    updateField("accountNumber", event.target.value)
                  }
                />
                {!isAccountValid && (
                  <p className="field-hint">Use at least 5 letters or numbers.</p>
                )}
              </div>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="avery@email.com"
                  autoComplete="email"
                  value={formState.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="zone">Service zone</label>
                <select
                  id="zone"
                  value={formState.zone}
                  onChange={(event) => updateField("zone", event.target.value)}
                >
                  {ZONE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="purpose">Purpose of contact</label>
                <select
                  id="purpose"
                  value={formState.purpose}
                  onChange={(event) =>
                    updateField("purpose", event.target.value)
                  }
                >
                  {PURPOSE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <fieldset className="field">
                <legend id="experience-legend">
                  How would you rate your water service overall?
                </legend>
                <div
                  className="options"
                  role="radiogroup"
                  aria-labelledby="experience-legend"
                >
                  {EXPERIENCE_CHOICES.map((choice) => (
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
              <fieldset className="field">
                <legend>How likely are you to recommend our utility service?</legend>
                <div className="scale">
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
            </>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <label>Rate each part of your water service</label>
                <div className="options">
                  {TOPIC_LABELS.map((topic) => (
                    <div key={topic.id} className="option-card active">
                      <span>{topic.label}</span>
                      <div
                        className="scale"
                        aria-label={`${topic.label} rating`}
                      >
                        {Array.from({ length: 5 }, (_, idx) => idx + 1).map(
                          (value) => (
                            <button
                              key={value}
                              type="button"
                              className={
                                formState.topics[topic.id] === value
                                  ? "active"
                                  : ""
                              }
                              aria-pressed={formState.topics[topic.id] === value}
                              onClick={() => updateTopic(topic.id, value)}
                            >
                              {value}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="field">
                <label htmlFor="feedback">What could we improve?</label>
                <textarea
                  id="feedback"
                  placeholder="Tell us about service reliability, communication, or water quality."
                  value={formState.feedback}
                  onChange={(event) =>
                    updateField("feedback", event.target.value)
                  }
                  required
                />
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={formState.followUp}
                    onChange={(event) =>
                      updateField("followUp", event.target.checked)
                    }
                  />
                  &nbsp;It's okay to contact me about my feedback
                </label>
              </div>
            </>
          )}

          {step === 4 && (
            <section className="summary">
              <h2>Review your answers</h2>
              <div className="summary-item">
                <span>Name</span>
                <strong>{formState.name}</strong>
              </div>
              <div className="summary-item">
                <span>Email</span>
                <strong>{formState.email}</strong>
              </div>
              <div className="summary-item">
                <span>Phone</span>
                <strong>{formState.phone || "Not provided"}</strong>
              </div>
              <div className="summary-item">
                <span>Account number</span>
                <strong>{formState.accountNumber || "Not provided"}</strong>
              </div>
              <div className="summary-item">
                <span>Service zone</span>
                <strong>{formState.zone}</strong>
              </div>
              <div className="summary-item">
                <span>Purpose</span>
                <strong>{formState.purpose}</strong>
              </div>
              <div className="summary-item">
                <span>Experience</span>
                <strong>
                  {
                    EXPERIENCE_CHOICES.find(
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
                <strong>{formState.feedback}</strong>
              </div>
            </section>
          )}

          {saveError && <p className="error">{saveError}</p>}
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={handleBack}
              disabled={step === 0}
            >
              Back
            </button>
            <button
              className="primary"
              type="submit"
              disabled={!canMoveNext || isSaving}
            >
              {step === STEP_LABELS.length - 1
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
