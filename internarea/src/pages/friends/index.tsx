import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "@/lib/api";

type Tab = "friends" | "requests" | "find";

export default function Friends() {
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [posting, setPosting] = useState<any>(null);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const loadFriends = async () => {
    const { data } = await api.get("/social/friends");
    setFriends(data.friends);
    setCount(data.friendCount);
    setPosting(data.posting);
  };
  const loadRequests = async () => {
    const { data } = await api.get("/social/friend-requests");
    setIncoming(data.incoming);
  };

  useEffect(() => { loadFriends(); loadRequests(); }, []);

  // Debounced search so we don't fire a request on every keystroke
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get("/social/users/search", { params: { q: query } });
      setResults(data.users);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
      await Promise.all([loadFriends(), loadRequests()]);
      if (query.trim().length >= 2) {
        const { data } = await api.get("/social/users/search", { params: { q: query } });
        setResults(data.users);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Something went wrong");
    }
  };

  const addFriend = (id: string) => act(() => api.post(`/social/friend-request/${id}`), "Friend request sent");
  const accept = (id: string) => act(() => api.post(`/social/friend-request/${id}/accept`), "You're now friends");
  const reject = (id: string) => act(() => api.post(`/social/friend-request/${id}/reject`), "Request declined");
  const unfriend = (id: string) => {
    if (!confirm("Remove this friend?")) return;
    act(() => api.delete(`/social/friends/${id}`), "Friend removed");
  };

  const limitText = posting
    ? posting.dailyLimit === null
      ? "You can post without a daily limit."
      : posting.dailyLimit === 0
        ? "Add a friend to start posting."
        : `You've posted ${posting.postedToday} of ${posting.dailyLimit} today.`
    : "";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{count} {count === 1 ? "friend" : "friends"}</h1>
        <p className="text-sm text-gray-600">{limitText}</p>
      </div>

      <div className="flex gap-4 border-b mb-4">
        {([["friends", "Friends"], ["requests", `Requests${incoming.length ? ` (${incoming.length})` : ""}`], ["find", "Find people"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-2 ${tab === key ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        friends.length === 0
          ? <p className="text-gray-500">No friends yet. Use "Find people" to add some.</p>
          : friends.map((f) => (
            <div key={f._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={f.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-gray-500">@{f.username}</p>
                </div>
              </div>
              <button className="text-sm text-red-600" onClick={() => unfriend(f._id)}>Remove</button>
            </div>
          ))
      )}

      {tab === "requests" && (
        incoming.length === 0
          ? <p className="text-gray-500">No pending requests.</p>
          : incoming.map((r) => (
            <div key={r._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={r.fromUserId.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{r.fromUserId.name}</p>
                  <p className="text-xs text-gray-500">@{r.fromUserId.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => accept(r._id)}>Accept</button>
                <button className="px-3 py-1 border rounded" onClick={() => reject(r._id)}>Decline</button>
              </div>
            </div>
          ))
      )}

      {tab === "find" && (
        <div>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or @username"
            className="w-full border rounded px-3 py-2 mb-4"
          />
          {query.trim().length >= 2 && results.length === 0 && <p className="text-gray-500">No one found.</p>}
          {results.map((u) => (
            <div key={u._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={u.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-gray-500">@{u.username} · {u.friendCount} friends</p>
                </div>
              </div>
              {u.status === "none" && <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => addFriend(u._id)}>Add friend</button>}
              {u.status === "request_sent" && <span className="text-sm text-gray-500">Request sent</span>}
              {u.status === "request_received" && <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => accept(u.requestId)}>Accept</button>}
              {u.status === "friend" && <span className="text-sm text-green-700">Friends</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}