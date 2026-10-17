// internarea/src/Components/LanguageSwitcher.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { setLanguage, selectuser } from "@/Feature/Userslice";
import { auth } from "@/firebase/firebase";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "fr", label: "Français" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter(); 
  const dispatch = useDispatch();
  const user = useSelector(selectuser);
  const [otpStage, setOtpStage] = useState<null | "sent">(null);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");

  const getAuthHeaders = async () => {
    if (auth.currentUser) {
      return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
    }

    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  const applyLocally = (lang: string) => {
    i18n.changeLanguage(lang); // no reload, page/session untouched
    dispatch(setLanguage(lang));
    router.push(router.pathname, router.asPath, { locale: lang });

  };

  const handleSelect = async (lang: string) => {
    setError("");
    const headers = await getAuthHeaders();

    if (lang === "fr") {
      if (!headers) {
        setError("Sign in to verify your email before switching to French.");
        return;
      }

      try {
        await axios.post("http://localhost:5000/api/language/french/request-otp", {}, { headers });
        setOtpStage("sent");
      } catch (err: unknown) {
        setError(axios.isAxiosError(err) ? err.response?.data?.error || "Could not send code" : "Could not send code");
      }
      return;
    }

    if (!headers) {
      applyLocally(lang);
      return;
    }

    try {
      await axios.patch("http://localhost:5000/api/language", { language: lang }, { headers });
      applyLocally(lang);
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Could not switch language" : "Could not switch language");
    }
  };

  const handleVerify = async () => {
    setError("");
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setError("Your session expired. Sign in again to verify your email.");
        return;
      }

      await axios.post("http://localhost:5000/api/language/french/verify-otp", { code: otpCode }, { headers });
      applyLocally("fr");
      setOtpStage(null);
      setOtpCode("");
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Invalid code" : "Invalid code");
    }
  };

  return (
    <div>
      <select
        value={user?.language || router.locale || i18n.resolvedLanguage || "en"}
        onChange={(e) => handleSelect(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>

      {otpStage === "sent" && (
        <div>
          <input
            placeholder="Enter code from email"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
          />
          <button onClick={handleVerify}>Verify</button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}