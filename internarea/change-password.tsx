import { useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      await axios.post("http://localhost:5000/api/auth/change-password", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/");
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Could not update password" : "Could not update password");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p>You're using a temporary password. Set a new one to continue.</p>
      <input
        type="password"
        placeholder="Temporary password"
        value={form.currentPassword}
        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
      />
      <input
        type="password"
        placeholder="New password"
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
      />
      <button type="submit">Update password</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}