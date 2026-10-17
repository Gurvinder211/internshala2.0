import { useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";

export default function ForgotPassword() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await axios.post("http://localhost:5000/api/password-reset/request", { email });
      setMessage(data.message);
      setStep("verify");
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Something went wrong" : "Something went wrong");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await axios.post("http://localhost:5000/api/password-reset/verify", { email, code });
      setMessage(data.message);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Invalid or expired code" : "Invalid or expired code");
    }
  };

  return (
    <div>
      {step === "request" ? (
        <form onSubmit={handleRequest}>
          <input
            type="email"
            placeholder="Registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Send reset code</button>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <input
            placeholder="Enter code from email"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit">Verify &amp; reset</button>
        </form>
      )}
      {message && <p>{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}