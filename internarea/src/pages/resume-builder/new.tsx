// pages/resume-builder/[id].tsx  (id = "new" for first create)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, Check, Download, Eye, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/api";

const BLANK = {
  title: "My resume", template: "classic", themeColor: "#126b59", fontFamily: "Helvetica",
  personal: { fullName: "", email: "", phone: "", location: "", careerObjective: "" },
  education: [], experience: [], internships: [], projects: [],
  certifications: [], achievements: [], skills: [], languages: [],
  socialLinks: { linkedin: "", github: "", portfolio: "" }, references: [],
};

const INPUT_CLASS = "w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15";

const ENTRY_FIELDS: Record<string, { key: string; label: string; placeholder: string; multiline?: boolean }[]> = {
  experience: [
    { key: "title", label: "Job title", placeholder: "Product design intern" },
    { key: "company", label: "Company", placeholder: "Company name" },
    { key: "startDate", label: "From", placeholder: "Jan 2024" },
    { key: "endDate", label: "To", placeholder: "Present" },
    { key: "description", label: "What you did", placeholder: "Describe your impact and responsibilities", multiline: true },
  ],
  internships: [
    { key: "role", label: "Role", placeholder: "Marketing intern" },
    { key: "company", label: "Company", placeholder: "Company name" },
    { key: "startDate", label: "From", placeholder: "Jan 2024" },
    { key: "endDate", label: "To", placeholder: "Present" },
    { key: "description", label: "What you did", placeholder: "Describe your work", multiline: true },
  ],
  education: [
    { key: "degree", label: "Degree or course", placeholder: "B.Sc. Computer Science" },
    { key: "institution", label: "Institution", placeholder: "University or school" },
    { key: "startYear", label: "From", placeholder: "2021" },
    { key: "endYear", label: "To", placeholder: "2025" },
    { key: "grade", label: "Grade", placeholder: "GPA, percentage, or grade" },
  ],
  projects: [
    { key: "name", label: "Project name", placeholder: "Project title" },
    { key: "link", label: "Project link", placeholder: "https://" },
    { key: "description", label: "Details", placeholder: "What you built and the tools you used", multiline: true },
  ],
  certifications: [
    { key: "name", label: "Certification", placeholder: "Certification name" },
    { key: "issuer", label: "Issued by", placeholder: "Organization" },
    { key: "year", label: "Year", placeholder: "2025" },
  ],
  languages: [
    { key: "name", label: "Language", placeholder: "English" },
    { key: "proficiency", label: "Proficiency", placeholder: "Professional" },
  ],
  references: [
    { key: "name", label: "Name", placeholder: "Reference name" },
    { key: "relation", label: "Relationship", placeholder: "Former manager" },
    { key: "contact", label: "Contact", placeholder: "Email or phone" },
  ],
};

const ENTRY_TITLES: Record<string, string> = {
  experience: "Work experience", internships: "Internships", education: "Education",
  projects: "Projects", certifications: "Certifications", languages: "Languages", references: "References",
};

function Field({ label, value, onChange, placeholder, multiline = false, type = "text" }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
  multiline?: boolean; type?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {multiline ? (
        <textarea className={`${INPUT_CLASS} min-h-24 resize-y`} value={value || ""} placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={INPUT_CLASS} type={type} value={value || ""} placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export default function ResumeBuilder() {
  const router = useRouter();
  const { id } = router.query;
  const [resume, setResume] = useState<any>(BLANK);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [genState, setGenState] = useState<"idle" | "otp-sent">("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!id || id === "new") return;
    setLoading(true);
    api.get(`/resume/${id}`)
      .then((response) => setResume({ ...BLANK, ...response.data.resume }))
      .catch((error) => toast.error(error?.response?.data?.error || "Could not load this resume"))
      .finally(() => setLoading(false));
  }, [id]);

  const updatePersonal = (key: string, value: string) => {
    setResume((current: any) => ({ ...current, personal: { ...current.personal, [key]: value } }));
  };

  const updateEntry = (section: string, index: number, key: string, value: string) => {
    setResume((current: any) => ({
      ...current,
      [section]: current[section].map((entry: any, entryIndex: number) =>
        entryIndex === index ? { ...entry, [key]: value } : entry
      ),
    }));
  };

  const addEntry = (section: string) => {
    const emptyEntry = Object.fromEntries(ENTRY_FIELDS[section].map(({ key }) => [key, ""]));
    setResume((current: any) => ({ ...current, [section]: [...current[section], emptyEntry] }));
  };

  const removeEntry = (section: string, index: number) => {
    setResume((current: any) => ({
      ...current,
      [section]: current[section].filter((_: unknown, entryIndex: number) => entryIndex !== index),
    }));
  };

  const save = async (): Promise<string | null> => {
    setSaving(true);
    try {
      if (id === "new") {
        const { data } = await api.post("/resume", resume);
        setResume(data.resume);
        await router.replace(`/resume-builder/${data.resume._id}`);
        toast.success("Draft saved");
        return data.resume._id;
      }
      await api.patch(`/resume/${id}`, resume);
      toast.success("Draft saved");
      return String(id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not save");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const requestOtp = async () => {
    const resumeId = await save();
    if (!resumeId) return;
    try {
      const { data } = await api.post(`/resume/${resumeId}/generate/otp`);
      setGenerationId(data.generationId);
      setGenState("otp-sent");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not send code");
    }
  };

  const verifyAndPay = async () => {
    try {
      await api.post(`/resume/${id}/generate/verify-otp`, { generationId, code });
      const { data } = await api.post(`/resume/${id}/generate/order`, { generationId });
      const rzp = new (window as any).Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.orderId,
        name: "InternArea", description: "Resume PDF (₹50)",
        handler: async (response: any) => {
          try {
            const result = await api.post(`/resume/${id}/generate/verify-payment`, { generationId, ...response });
            toast.success("Resume generated");
            setResume((current: any) => ({ ...current, status: "generated", pdfUrl: result.data.pdfUrl }));
            setGenState("idle");
          } catch (error: any) {
            toast.error(error?.response?.data?.error || "Payment needs verification. Please try again.");
          }
        },
        modal: { ondismiss: () => api.post(`/resume/${id}/generate/failed`, { generationId, cancelled: true }) },
      });
      rzp.open();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Verification failed");
    }
  };

  const sectionCount = ["experience", "internships", "education", "projects", "certifications", "skills"]
    .reduce((total, key) => total + (resume[key]?.length || 0), 0);

  return (
    <main className="min-h-screen bg-[#f3f5f2] text-slate-900">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/profile" aria-label="Back to profile" title="Back to profile"
              className="grid h-9 w-9 shrink-0 place-items-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={17} />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">Resume studio</p>
              <input aria-label="Resume title" value={resume.title || ""} placeholder="Untitled resume"
                onChange={(event) => setResume({ ...resume, title: event.target.value })}
                className="w-full max-w-[320px] truncate border-0 bg-transparent p-0 text-lg font-semibold outline-none focus:ring-0" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {saving ? "Saving..." : "Draft"}
            </span>
            <button onClick={save} disabled={saving || loading}
              className="inline-flex h-10 items-center gap-2 rounded bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={16} />
              {saving ? "Saving..." : "Save draft"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.86fr)] lg:gap-8 lg:px-8 lg:py-8">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Build your profile</p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950">Your resume</h1>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Check size={15} className="text-emerald-700" />
              {sectionCount} sections added
            </div>
          </div>

          {loading ? (
            <div role="status" className="border-y border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Loading your resume...</div>
          ) : (
            <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white px-4 sm:px-6">
              <details open className="py-5">
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">Personal details</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" value={resume.personal.fullName} placeholder="Your name"
                    onChange={(value) => updatePersonal("fullName", value)} />
                  <Field label="Email" type="email" value={resume.personal.email} placeholder="name@example.com"
                    onChange={(value) => updatePersonal("email", value)} />
                  <Field label="Phone" type="tel" value={resume.personal.phone} placeholder="+1 555 000 0000"
                    onChange={(value) => updatePersonal("phone", value)} />
                  <Field label="Location" value={resume.personal.location} placeholder="City, country"
                    onChange={(value) => updatePersonal("location", value)} />
                  <div className="sm:col-span-2">
                    <Field label="Professional summary" multiline value={resume.personal.careerObjective}
                      placeholder="A concise introduction: your strengths, experience, and the work you want to do."
                      onChange={(value) => updatePersonal("careerObjective", value)} />
                  </div>
                </div>
              </details>

              {(["experience", "internships", "education", "projects", "certifications", "languages", "references"] as const).map((section) => (
                <details key={section} className="py-5">
                  <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                    <span className="flex items-center justify-between gap-3">
                      {ENTRY_TITLES[section]}
                      <span className="mr-1 text-xs font-medium text-slate-400">{resume[section].length || "Add details"}</span>
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    {resume[section].map((entry: any, index: number) => (
                      <div key={`${section}-${index}`} className="relative border border-slate-200 bg-white p-4 pr-12">
                        <button type="button" onClick={() => removeEntry(section, index)}
                          aria-label={`Remove ${ENTRY_TITLES[section].toLowerCase()} entry ${index + 1}`}
                          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-red-50 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {ENTRY_FIELDS[section].map((field) => (
                            <div key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                              <Field label={field.label} value={entry[field.key]} placeholder={field.placeholder}
                                multiline={field.multiline}
                                onChange={(value) => updateEntry(section, index, field.key, value)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addEntry(section)}
                      className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
                      <Plus size={17} /> Add {ENTRY_TITLES[section].toLowerCase()}
                    </button>
                  </div>
                </details>
              ))}

              <details className="py-5">
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">Skills &amp; achievements</summary>
                <div className="mt-4 grid gap-4">
                  <Field label="Skills" multiline value={resume.skills.join(", ")} placeholder="Research, Figma, communication"
                    onChange={(value) => setResume({ ...resume, skills: value.split(",").map((item: string) => item.trim()).filter(Boolean) })} />
                  <Field label="Achievements" multiline value={resume.achievements.join("\n")} placeholder="One achievement per line"
                    onChange={(value) => setResume({ ...resume, achievements: value.split("\n").map((item: string) => item.trim()).filter(Boolean) })} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {(["linkedin", "github", "portfolio"] as const).map((network) => (
                      <Field key={network} label={network[0].toUpperCase() + network.slice(1)} type="url"
                        value={resume.socialLinks[network]} placeholder="https://"
                        onChange={(value) => setResume({ ...resume, socialLinks: { ...resume.socialLinks, [network]: value } })} />
                    ))}
                  </div>
                </div>
              </details>

              <details className="py-5">
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">Style</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Template</span>
                    <select className={INPUT_CLASS} value={resume.template}
                      onChange={(event) => setResume({ ...resume, template: event.target.value })}>
                      <option value="classic">Classic</option>
                      <option value="modern">Modern</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Accent color</span>
                    <span className="flex h-[42px] items-center gap-3 border border-slate-300 px-2.5">
                      <input aria-label="Accent color" type="color" value={resume.themeColor}
                        onChange={(event) => setResume({ ...resume, themeColor: event.target.value })}
                        className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" />
                      <span className="text-sm uppercase text-slate-600">{resume.themeColor}</span>
                    </span>
                  </label>
                </div>
              </details>
            </div>
          )}

          <section className="mt-6 border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="generate-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-800">Ready to export</p>
                <h2 id="generate-title" className="mt-1 text-lg font-semibold">Generate your PDF</h2>
                <p className="mt-1 text-sm text-slate-600">Email verification required · ₹50 one-time</p>
              </div>
              {resume.status === "generated" && (
                <a href={`http://localhost:5000/api/resume/${id}/download`} target="_blank" rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 border border-emerald-800 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                  <Download size={16} /> Download PDF
                </a>
              )}
            </div>
            {genState === "idle" ? (
              <button onClick={requestOtp} disabled={saving || loading}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50 sm:w-auto">
                <Download size={16} /> Verify email &amp; generate
              </button>
            ) : (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code"
                  className={`${INPUT_CLASS} sm:max-w-56`} placeholder="6-digit email code" value={code}
                  onChange={(event) => setCode(event.target.value)} />
                <button onClick={verifyAndPay} disabled={!code.trim()}
                  className="h-11 bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                  Verify &amp; pay ₹50
                </button>
              </div>
            )}
          </section>
        </section>

        <aside className="min-w-0 lg:sticky lg:top-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Live preview</p>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{resume.template} template</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Eye size={15} /> Updates as you type</span>
          </div>
          <article className="mx-auto min-h-[760px] max-w-[620px] overflow-hidden border border-slate-200 bg-white px-7 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:px-10 sm:py-11">
            <div className="border-b-2 pb-5" style={{ borderColor: resume.themeColor }}>
              <h3 className="break-words text-3xl font-bold leading-tight text-slate-950">{resume.personal.fullName || "Your name"}</h3>
              <p className="mt-2 break-words text-xs leading-5 text-slate-600">
                {[resume.personal.email, resume.personal.phone, resume.personal.location].filter(Boolean).join("  ·  ") || "Email · Phone · Location"}
              </p>
              <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                {[resume.socialLinks.linkedin, resume.socialLinks.github, resume.socialLinks.portfolio].filter(Boolean).join("  ·  ")}
              </p>
            </div>
            {resume.personal.careerObjective && <p className="mt-5 whitespace-pre-wrap text-xs leading-5 text-slate-700">{resume.personal.careerObjective}</p>}

            {(["experience", "internships", "projects", "education", "certifications"] as const).map((section) => resume[section].length > 0 && (
              <section key={section} className="mt-6">
                <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: resume.themeColor }}>
                  {ENTRY_TITLES[section]}
                </h4>
                <div className="space-y-3">
                  {resume[section].map((entry: any, index: number) => (
                    <div key={`${section}-preview-${index}`} className="text-xs leading-5">
                      <p className="font-semibold text-slate-900">
                        {entry.title || entry.role || entry.name || entry.degree || "Entry title"}
                        {(entry.company || entry.institution) ? ` · ${entry.company || entry.institution}` : ""}
                      </p>
                      {(entry.startDate || entry.startYear || entry.issuer) && (
                        <p className="text-[11px] text-slate-500">
                          {[entry.startDate || entry.startYear, entry.endDate || entry.endYear, entry.issuer, entry.year].filter(Boolean).join(" – ")}
                        </p>
                      )}
                      {entry.description && <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.description}</p>}
                      {entry.link && <p className="break-all text-emerald-800">{entry.link}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {resume.skills.length > 0 && (
              <section className="mt-6">
                <h4 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: resume.themeColor }}>Skills</h4>
                <p className="text-xs leading-5 text-slate-700">{resume.skills.join("  ·  ")}</p>
              </section>
            )}
            {resume.achievements.length > 0 && (
              <section className="mt-6">
                <h4 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: resume.themeColor }}>Achievements</h4>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                  {resume.achievements.map((achievement: string, index: number) => <li key={`achievement-${index}`}>{achievement}</li>)}
                </ul>
              </section>
            )}
            {resume.languages.length > 0 && (
              <section className="mt-6">
                <h4 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: resume.themeColor }}>Languages</h4>
                <p className="text-xs leading-5 text-slate-700">{resume.languages.map((language: any) => [language.name, language.proficiency].filter(Boolean).join(" · ")).join("  /  ")}</p>
              </section>
            )}
            {resume.references.length > 0 && (
              <section className="mt-6">
                <h4 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: resume.themeColor }}>References</h4>
                <div className="space-y-2 text-xs leading-5 text-slate-700">
                  {resume.references.map((reference: any, index: number) => (
                    <p key={`reference-${index}`}><span className="font-semibold">{reference.name}</span>{[reference.relation, reference.contact].filter(Boolean).map((value) => ` · ${value}`)}</p>
                  ))}
                </div>
              </section>
            )}
            {sectionCount === 0 && !resume.personal.careerObjective && (
              <p className="mt-8 border border-dashed border-slate-300 p-4 text-center text-xs leading-5 text-slate-500">
                Your experience, education, and skills will appear here as you add them.
              </p>
            )}
          </article>
        </aside>
      </div>
    </main>
  );
}