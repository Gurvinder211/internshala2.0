import { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { ArrowRight, Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import axios from "axios";
import { login } from "@/Feature/Userslice";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError("Use at least 8 characters with uppercase, lowercase, and a number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await axios.post("http://localhost:5000/api/auth/register", {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      });
      localStorage.setItem("authToken", data.token);
      dispatch(login(data.user));
      router.push("/");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Registration failed. Please try again.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f5f7f2] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-[#dce4d6] bg-white shadow-[0_24px_80px_rgba(35,55,35,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden bg-[#173b35] px-7 py-10 text-white sm:px-12 lg:px-14 lg:py-14">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[32px] border-[#d9ed83]/20" />
          <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-[#d9ed83]/10" />
          <div className="relative flex h-full flex-col justify-between gap-16">
            <div>
              <p className="mb-8 text-sm font-semibold uppercase tracking-[0.2em] text-[#d9ed83]">InternArea</p>
              <p className="mb-5 max-w-sm text-sm font-medium uppercase tracking-[0.18em] text-white/60">A better start to your next chapter</p>
              <h1 className="max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                Build a career that feels like yours.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/70">
                Discover internships, find your next opportunity, and keep every step of your search in one place.
              </p>
            </div>
            <div className="space-y-4 text-sm text-white/80">
              {[
                "Personalized opportunities",
                "One profile for every application",
                "A community built for ambitious people",
              ].map((item) => (
                <div className="flex items-center gap-3" key={item}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#d9ed83] text-[#173b35]">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-7 py-10 sm:px-12 lg:px-16 lg:py-14">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#6a7f72]">Create your account</p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#1c2b25]">Your next opportunity starts here.</h2>
              <p className="mt-3 text-sm leading-6 text-[#6a756f]">Join a focused community of students and early-career talent.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#304139]">Full name</span>
                <input
                  className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                  placeholder="Alex Morgan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#304139]">Email address</span>
                <input
                  className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                  placeholder="alex@example.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#304139]">Password</span>
                <div className="relative">
                  <input
                    className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 pr-12 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                    placeholder="Create a strong password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#738078] transition hover:bg-[#edf2ec] hover:text-[#304139]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <span className="mt-2 block text-xs text-[#7d8982]">At least 8 characters, including uppercase, lowercase, and a number.</span>
              </label>

              {error && <p className="rounded-xl border border-[#f2caca] bg-[#fff4f3] px-4 py-3 text-sm text-[#b13b37]" role="alert">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173b35] px-5 text-sm font-semibold text-white transition hover:bg-[#28584e] focus:outline-none focus:ring-4 focus:ring-[#557d5e]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Create account <ArrowRight size={18} /></>}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-[#7d8982]">
              <ShieldCheck size={16} className="text-[#557d5e]" />
              Your information is kept secure.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}