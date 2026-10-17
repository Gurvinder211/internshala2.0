import { useEffect, useState } from "react";
import Script from "next/script";
import { toast } from "react-toastify";
import axios from "axios";
import { auth } from "@/firebase/firebase";
import { CalendarDays, Check, Crown, Gem, RefreshCw, ShieldCheck, Sparkles, Zap } from "lucide-react";

declare global { interface Window { Razorpay: any } }

export default function Subscription() {
  const [plans, setPlans] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const getAuthHeaders = async () => {
    if (auth.currentUser) {
      return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
    }

    const token = localStorage.getItem("authToken");
    if (!token) throw new Error("Please log in to manage your subscription");
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    setLoading(true);
    setLoadError("");
    setAccountMessage("");
    try {
      const { data } = await axios.get("http://localhost:5000/api/subscription/plans");
      setPlans(data.plans);
    } catch {
      setLoadError("We couldn't load the plans. Check that the backend is running, then try again.");
      setLoading(false);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const { data } = await axios.get("http://localhost:5000/api/subscription/me", { headers });
      setSub(data.subscription);
    } catch {
      setSub(null);
      setAccountMessage("Log in to view your current plan and purchase a subscription.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const buy = async (plan: string) => {
    if (busy) return; // stops double-clicks creating duplicate attempts
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const { data } = await axios.post("http://localhost:5000/api/subscription/order", { plan }, { headers });

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "InternArea",
        description: `${plan} plan`,
        handler: async (resp: any) => {
          try {
            await axios.post("http://localhost:5000/api/subscription/verify", resp, { headers });
            toast.success("Payment successful. Your plan is active.");
          } catch {
            // Money may have moved: ask the server to check with Razorpay.
            try {
              await axios.post("http://localhost:5000/api/subscription/reconcile", { orderId: data.orderId }, { headers });
              toast.success("Payment confirmed. Your plan is active.");
            } catch {
              toast.error("We couldn't confirm your payment yet. If you were charged, refresh in a minute.");
            }
          }
          load();
          setBusy(false);
        },
        modal: {
          ondismiss: () => {
            axios.post("http://localhost:5000/api/subscription/failed", { razorpay_order_id: data.orderId, cancelled: true, reason: "closed by user" }, { headers }).catch(() => {});
            setBusy(false);
          },
        },
      });
      rzp.on("payment.failed", (r: any) => {
        axios.post("http://localhost:5000/api/subscription/failed", {
          razorpay_order_id: data.orderId, cancelled: false, reason: r?.error?.description,
        }, { headers }).catch(() => {});
      });
      rzp.open();
    } catch (err: any) {
      toast.error(axios.isAxiosError(err) ? err.response?.data?.error || "Could not start payment" : "Could not start payment");
      setBusy(false);
    }
  };

  const planStyles: Record<string, { accent: string; icon: typeof Gem; details: string }> = {
    FREE: { accent: "border-t-slate-400", icon: ShieldCheck, details: "A simple way to get started" },
    BRONZE: { accent: "border-t-amber-600", icon: Zap, details: "For a steady application routine" },
    SILVER: { accent: "border-t-slate-500", icon: Gem, details: "For an active job search" },
    GOLD: { accent: "border-t-emerald-700", icon: Crown, details: "Apply without a monthly cap" },
  };
  const usagePercent = sub?.unlimited
    ? 100
    : sub?.quotaLimit
      ? Math.min(100, Math.max(0, (sub.quotaUsed / sub.quotaLimit) * 100))
      : 0;
  const currentPlan = plans.find((plan) => plan.key === sub?.plan);

  return (
    <main className="min-h-screen bg-[#f4f6f3] text-slate-900">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-11">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-emerald-800">
              <Sparkles size={14} /> Plans &amp; usage
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Choose your application plan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Compare monthly application limits and pick the plan that suits your search.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-emerald-800" /> Secure checkout
          </div>
        </header>

        {loading && plans.length === 0 && (
          <div role="status" className="mt-6 flex items-center gap-3 border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-800 border-r-transparent" />
            Loading subscription plans...
          </div>
        )}
        {loadError && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
            <span>{loadError}</span>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 font-semibold underline underline-offset-2">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}
        {accountMessage && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>{accountMessage}</span>
            <a href="/login" className="font-semibold underline underline-offset-2">Log in</a>
          </div>
        )}

      {sub && (
        <section aria-label="Current subscription" className="mt-7 border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Your current plan</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{sub.planName}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              <Check size={13} /> Active
            </span>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:items-center">
            <div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">Monthly applications</span>
                <span className="font-bold text-slate-950">{sub.unlimited ? "Unlimited" : `${sub.quotaRemaining} left`}</span>
              </div>
              {!sub.unlimited && (
                <div className="mt-2 h-2 overflow-hidden bg-slate-100" role="progressbar" aria-label="Monthly application quota used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
                  <div className="h-full bg-emerald-700 transition-[width]" style={{ width: `${usagePercent}%` }} />
                </div>
              )}
              {!sub.unlimited && <p className="mt-1.5 text-xs text-slate-500">{sub.quotaUsed} of {sub.quotaLimit} used</p>}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <CalendarDays size={18} className="shrink-0 text-emerald-800" />
              <span>Quota resets <b className="block font-semibold text-slate-900">{sub.quotaResetsAt ? new Date(sub.quotaResetsAt).toLocaleDateString() : "Next cycle"}</b></span>
            </div>
            {sub.validTill && (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <RefreshCw size={17} className="shrink-0 text-emerald-800" />
                <span>Plan ends <b className="block font-semibold text-slate-900">{new Date(sub.validTill).toLocaleDateString()}</b></span>
              </div>
            )}
          </div>
          {sub.nextPlan && (
            <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600 sm:px-6">
              Scheduled change: <b className="font-semibold text-slate-900">{sub.nextPlan === "FREE" ? "Move to Free" : `Continue on ${sub.nextPlan}`}</b> after this period.
            </p>
          )}
        </section>
      )}

        <section className="mt-8" aria-labelledby="available-plans-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="available-plans-title" className="text-xl font-bold text-slate-950">Available plans</h2>
              <p className="mt-1 text-sm text-slate-600">Every plan includes a monthly application quota.</p>
            </div>
            <span className="text-xs text-slate-500">Billed monthly · Prices in INR</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const style = planStyles[plan.key] || planStyles.FREE;
              const PlanIcon = style.icon;
              const isCurrent = sub?.plan === plan.key;
              const isFree = plan.price === 0;
              return (
                <article key={plan.key} className={`flex min-w-0 flex-col border border-t-[3px] border-slate-200 bg-white p-5 ${style.accent} ${isCurrent ? "ring-1 ring-emerald-800" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center bg-slate-50 text-slate-700"><PlanIcon size={18} /></div>
                    {isCurrent && <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-900">Current</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{style.details}</p>
                  <p className="mt-4 flex items-baseline gap-1 text-2xl font-bold text-slate-950">
                    {isFree ? "Free" : `₹${plan.price}`}
                    {!isFree && <span className="text-xs font-medium text-slate-500">/ month</span>}
                  </p>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                      {plan.unlimited ? "Unlimited applications" : `${plan.applicationsPerMonth} application${plan.applicationsPerMonth === 1 ? "" : "s"} per month`}
                    </p>
                    <p className="mt-2 pl-6 text-xs text-slate-500">Quota refreshes every 30 days</p>
                  </div>
                  <div className="mt-auto pt-5">
                    {plan.key !== "FREE" ? (
                      isCurrent ? (
                        <div className="flex h-10 items-center justify-center border border-emerald-800 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">Your current plan</div>
                      ) : sub ? (
                        <button disabled={busy} onClick={() => void buy(plan.key)}
                          className="h-10 w-full bg-emerald-800 px-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
                          {busy ? "Starting checkout..." : "Choose plan"}
                        </button>
                      ) : (
                        <a href="/login" className="flex h-10 items-center justify-center bg-emerald-800 px-3 text-sm font-semibold text-white transition hover:bg-emerald-900">Log in to choose</a>
                      )
                    ) : (
                      <div className="flex h-10 items-center justify-center border border-slate-200 text-sm font-medium text-slate-500">
                        {isCurrent ? "Your current plan" : currentPlan ? "Free plan" : "Included"}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!loading && !loadError && plans.length === 0 && (
            <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">No plans are available right now.</p>
          )}
        </section>

      {sub && sub.plan !== "FREE" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p className="text-xs leading-5 text-slate-500">Cancellation takes effect according to your current billing period.</p>
          <button className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-red-700"
            onClick={async () => {
              try {
                const headers = await getAuthHeaders();
                const r = await axios.post("http://localhost:5000/api/subscription/cancel", {}, { headers });
                toast.info(r.data.message);
                load();
              } catch (err: unknown) {
                toast.error(axios.isAxiosError(err) ? err.response?.data?.error || "Could not cancel subscription" : "Could not cancel subscription");
              }
            }}>
          Cancel subscription
          </button>
        </div>
      )}
      </div>
    </main>
  );
}