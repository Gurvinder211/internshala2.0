// internarea/src/pages/login.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { login as loginAction } from "@/Feature/Userslice";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
      setIsSubmitting(true);
    try {
      const { data } = await axios.post("http://localhost:5000/api/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      localStorage.setItem("authToken", data.token);
      dispatch(loginAction(data.user));

      if (data.mustChangePassword) {
        router.push("/change-password"); // forced change after a reset
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Login failed. Please check your details.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f5f7f2] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-[#dce4d6] bg-white shadow-[0_24px_80px_rgba(35,55,35,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden bg-[#173b35] px-7 py-10 text-white sm:px-12 lg:px-14 lg:py-14">
            <div className="relative flex h-full flex-col justify-between gap-16">
              <div>
                <h1 className="max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                  Pick up where your career journey left off.
                </h1>
              </div>
            </div>
          </section>
          <section className="px-7 py-10 sm:px-12 lg:px-16 lg:py-14">
            <div className="mx-auto max-w-md">
              <form onSubmit={handleSubmit} className="space-y-5">
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
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#304139]">Password</span>
                    <Link href="/forgot-password" className="text-xs font-semibold text-[#557d5e] hover:text-[#173b35]">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <input
                      className="h-12 w-full rounded-xl border border-[#d9e0d9] bg-[#fbfcfa] px-4 pr-12 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#738078] hover:bg-[#edf2ec]">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                {error && <p className="rounded-xl border border-[#f2caca] bg-[#fff4f3] px-4 py-3 text-sm text-[#b13b37]" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173b35] px-5 text-sm font-semibold text-white transition hover:bg-[#28584e] focus:outline-none focus:ring-4 focus:ring-[#557d5e]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Sign in <ArrowRight size={18} /></>}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-[#6a756f]">
                New to InternArea? <Link href="/register" className="font-semibold text-[#557d5e] hover:text-[#173b35]">Create an account</Link>
              </p>
            </div>
          </section>
        </div>
    </main>
  );
}