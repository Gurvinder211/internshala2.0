import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BriefcaseBusiness,
  Globe2,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";

type FeedPost = {
  _id: string;
  userId: any;
  content: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | "none";
  privacy?: "public" | "friends";
  likes: (string | { _id?: string })[];
  saves?: (string | { _id?: string })[];
  commentCount?: number;
  shareCount?: number;
  createdAt: string;
};

type FeedComment = {
  _id: string;
  userId: any;
  content: string;
  createdAt?: string;
};

const API_ORIGIN = "http://localhost:5000";

function initials(name?: string) {
  return name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function postDate(date?: string) {
  if (!date) return "Just now";
  const elapsed = Date.now() - new Date(date).getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function referenceId(value: string | { _id?: string }) {
  return typeof value === "string" ? value : value._id || "";
}

function Avatar({ name, photo, size = "md" }: { name?: string; photo?: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return photo ? (
    <img src={photo} alt="" className={`${dimensions} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-900`}>
      {initials(name)}
    </span>
  );
}

export default function PublicSpace() {
  const user = useSelector(selectuser);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [privacy, setPrivacy] = useState<"public" | "friends">("public");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  const loadMore = async () => {
    if (loadingMore || (!hasMore && !loading)) return;
    setLoadingMore(true);
    setFeedError("");
    try {
      const { data } = await api.get("/feed", { params: cursor ? { cursor } : {} });
      setPosts((existing) => {
        const knownIds = new Set(existing.map((post) => post._id));
        return [...existing, ...data.posts.filter((post: FeedPost) => !knownIds.has(post._id))];
      });
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor && data.posts.length));
    } catch (error: any) {
      const status = error?.response?.status;
      setFeedError(status === 401
        ? "Your session has expired. Sign in again to view and join the community feed."
        : error?.response?.data?.error || "We couldn't load the feed. Check your connection and try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadMore();
  }, []);

  const selectMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > 25 * 1024 * 1024) {
      toast.error("Choose a photo or video under 25 MB");
      event.target.value = "";
      return;
    }
    setFile(selected);
  };

  const submitPost = async () => {
    if (!content.trim() && !file) return;
    setPosting(true);
    const form = new FormData();
    form.append("content", content.trim());
    form.append("privacy", privacy);
    if (file) form.append("media", file);
    try {
      const { data } = await api.post("/post", form, { headers: { "Content-Type": "multipart/form-data" } });
      const post = {
        ...data.post,
        userId: data.post.userId?.name ? data.post.userId : {
          _id: user?._id,
          name: user?.name || user?.displayName,
          username: user?.username,
          photo: user?.photo || user?.photoURL,
        },
        likes: data.post.likes || [],
        saves: data.post.saves || [],
      };
      setPosts((existing) => [post, ...existing]);
      setContent("");
      setFile(null);
      toast.success("Your post is live");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not publish your post");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: FeedPost) => {
    try {
      const { data } = await api.post(`/post/${post._id}/like`);
      setPosts((current) => current.map((item) => item._id === post._id
        ? { ...item, likes: data.liked
          ? [...(item.likes || []), user?._id]
          : item.likes.filter((id) => referenceId(id) !== String(user?._id)) }
        : item));
    } catch {
      toast.error("Could not update your like");
    }
  };

  const toggleSave = async (post: FeedPost) => {
    try {
      const { data } = await api.post(`/post/${post._id}/save`);
      setPosts((current) => current.map((item) => item._id === post._id
        ? { ...item, saves: data.saved
          ? [...(item.saves || []), user?._id]
          : (item.saves || []).filter((id) => referenceId(id) !== String(user?._id)) }
        : item));
      toast.info(data.saved ? "Post saved" : "Removed from saved posts");
    } catch {
      toast.error("Could not save this post");
    }
  };

  const sharePost = async (post: FeedPost) => {
    const postUrl = `${window.location.origin}/public-space#post-${post._id}`;
    try {
      await api.post(`/post/${post._id}/share`);
      if (navigator.share) await navigator.share({ title: "A post on InternArea", url: postUrl });
      else {
        await navigator.clipboard.writeText(postUrl);
        toast.success("Link copied to clipboard");
      }
      setPosts((current) => current.map((item) => item._id === post._id
        ? { ...item, shareCount: (item.shareCount || 0) + 1 }
        : item));
    } catch (error: any) {
      if (error?.name !== "AbortError") toast.error("Could not share this post");
    }
  };

  const toggleComments = async (post: FeedPost) => {
    const isOpen = Boolean(openComments[post._id]);
    setOpenComments((current) => ({ ...current, [post._id]: !isOpen }));
    if (isOpen || comments[post._id]) return;
    try {
      const { data } = await api.get(`/post/${post._id}/comments`);
      setComments((current) => ({ ...current, [post._id]: data.comments.reverse() }));
    } catch {
      toast.error("Could not load comments");
      setOpenComments((current) => ({ ...current, [post._id]: false }));
    }
  };

  const submitComment = async (post: FeedPost) => {
    const draft = commentDrafts[post._id]?.trim();
    if (!draft) return;
    setSendingComment(post._id);
    try {
      const { data } = await api.post(`/post/${post._id}/comments`, { content: draft });
      const comment = {
        ...data.comment,
        userId: { name: user?.name || user?.displayName, photo: user?.photo || user?.photoURL },
      };
      setComments((current) => ({ ...current, [post._id]: [...(current[post._id] || []), comment] }));
      setCommentDrafts((current) => ({ ...current, [post._id]: "" }));
      setPosts((current) => current.map((item) => item._id === post._id
        ? { ...item, commentCount: (item.commentCount || 0) + 1 }
        : item));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not add your comment");
    } finally {
      setSendingComment(null);
    }
  };

  const userName = user?.name || user?.displayName || "Your profile";
  const userPhoto = user?.photo || user?.photoURL;

  return (
    <main className="min-h-screen bg-[#f3f6f4] text-slate-900">
      <div className="border-b border-emerald-950/10 bg-[#e7f1eb]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-7 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">InternArea community</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Public Space</h1>
            <p className="mt-1 text-sm text-slate-600">Ideas, progress, and opportunities from your community.</p>
          </div>
          <Link href="/internship" className="inline-flex h-10 items-center gap-2 border border-emerald-900/20 bg-white px-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">
            <BriefcaseBusiness size={16} /> Explore opportunities
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_250px] lg:px-8 lg:py-8">
        <aside className="hidden lg:block">
          <section className="overflow-hidden border border-slate-200 bg-white">
            <div className="h-16 bg-[linear-gradient(120deg,#145b4b,#76a98b)]" />
            <div className="px-4 pb-4">
              <div className="-mt-6 grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-emerald-100 font-bold text-emerald-900">
                {userPhoto ? <img src={userPhoto} alt="" className="h-full w-full rounded-full object-cover" /> : initials(userName)}
              </div>
              <h2 className="mt-3 truncate font-semibold text-slate-900">{userName}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Connect with people learning and building their careers.</p>
              <Link href="/profile" className="mt-4 inline-flex text-sm font-semibold text-emerald-800 hover:text-emerald-950">View profile</Link>
            </div>
          </section>
          <nav className="mt-3 border border-slate-200 bg-white p-2 text-sm">
            <Link href="/internship" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50">
              <BriefcaseBusiness size={17} className="text-slate-500" /> Find internships
            </Link>
            <Link href="/job" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50">
              <UsersRound size={17} className="text-slate-500" /> Browse jobs
            </Link>
            <Link href="/applications" className="flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50">
              <Bookmark size={17} className="text-slate-500" /> My applications
            </Link>
          </nav>
        </aside>

        <section className="min-w-0" aria-label="Community feed">
          <div className="border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Avatar name={userName} photo={userPhoto} />
              <textarea aria-label="Write a post" value={content}
                onChange={(event) => setContent(event.target.value)} maxLength={3000}
                placeholder="Share something you learned or accomplished..."
                className="min-h-[86px] min-w-0 flex-1 resize-y border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" />
            </div>
            {file && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                <span className="flex min-w-0 items-center gap-2 truncate"><ImagePlus size={16} /> {file.name}</span>
                <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="grid h-7 w-7 shrink-0 place-items-center hover:bg-emerald-100"><X size={15} /></button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-1">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-800">
                  <ImagePlus size={17} className="text-emerald-700" /> Photo / video
                  <input type="file" accept="image/*,video/*" onChange={selectMedia} className="sr-only" />
                </label>
                <label className="flex h-9 items-center gap-2 px-2 text-sm text-slate-600">
                  <Globe2 size={16} className="text-slate-500" />
                  <select aria-label="Post audience" value={privacy} onChange={(event) => setPrivacy(event.target.value as "public" | "friends")}
                    className="max-w-28 border-0 bg-transparent pr-5 text-sm outline-none focus:ring-0">
                    <option value="public">Everyone</option>
                    <option value="friends">Friends</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{content.length}/3000</span>
                <button type="button" onClick={submitPost} disabled={posting || (!content.trim() && !file)}
                  className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45">
                  <Send size={15} /> {posting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3 mt-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Community feed</h2>
            <span className="text-xs text-slate-500">Recent posts and conversations</span>
          </div>
          {feedError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span>{feedError}</span>
              {feedError.startsWith("Your session has expired") ? (
                <Link href="/login" className="font-semibold underline underline-offset-2">Sign in</Link>
              ) : (
                <button onClick={() => { setLoading(true); void loadMore(); }} className="font-semibold underline underline-offset-2">Try again</button>
              )}
            </div>
          )}
          {loading && posts.length === 0 && !feedError && (
            <div role="status" className="border border-slate-200 bg-white p-5 text-sm text-slate-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-700 border-r-transparent align-middle" />
              <span className="ml-2">Loading community posts...</span>
            </div>
          )}
          {!loading && !feedError && posts.length === 0 && (
            <div className="border border-slate-200 bg-white px-6 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-800"><UsersRound size={22} /></div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Your feed starts here</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">Share a milestone, lesson, or question to get the conversation going.</p>
            </div>
          )}

          <div className="space-y-3">
            {posts.map((post) => {
              const author = post.userId || {};
              const authorName = author.name || "Community member";
              const liked = (post.likes || []).some((id) => referenceId(id) === String(user?._id));
              const saved = (post.saves || []).some((id) => referenceId(id) === String(user?._id));
              const mediaUrl = post.mediaUrl?.startsWith("http") ? post.mediaUrl : `${API_ORIGIN}${post.mediaUrl || ""}`;
              return (
                <article id={`post-${post._id}`} key={post._id} className="border border-slate-200 bg-white">
                  <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
                    <Avatar name={authorName} photo={author.photo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{authorName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{author.username ? `@${author.username} · ` : ""}{postDate(post.createdAt)}{post.privacy === "friends" && <span> · Friends</span>}</p>
                        </div>
                        <button aria-label="Post options" title="Post options" className="grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"><MoreHorizontal size={19} /></button>
                      </div>
                    </div>
                  </div>
                  {post.content && <p className="whitespace-pre-wrap break-words px-4 pb-4 pt-3 text-sm leading-6 text-slate-800 sm:px-5">{post.content}</p>}
                  {post.mediaUrl && post.mediaType === "image" && <img src={mediaUrl} alt="Post attachment" className="max-h-[560px] w-full bg-slate-50 object-contain" />}
                  {post.mediaUrl && post.mediaType === "video" && <video src={mediaUrl} controls className="max-h-[560px] w-full bg-black" aria-label="Post video" />}
                  <div className="flex items-center justify-between px-5 py-2.5 text-xs text-slate-500">
                    <span>{post.likes?.length || 0} likes</span>
                    <button onClick={() => void toggleComments(post)} className="hover:text-slate-800">{post.commentCount || 0} comments</button>
                  </div>
                  <div className="mx-4 border-t border-slate-100 sm:mx-5" />
                  <div className="grid grid-cols-4 px-2 py-1.5 sm:px-3">
                    <button onClick={() => void toggleLike(post)} aria-pressed={liked}
                      className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold transition hover:bg-slate-50 sm:gap-2 sm:text-sm ${liked ? "text-emerald-800" : "text-slate-600"}`}>
                      <span aria-hidden="true" className="text-base">{liked ? "♥" : "♡"}</span> Like
                    </button>
                    <button onClick={() => void toggleComments(post)} aria-expanded={Boolean(openComments[post._id])}
                      className="flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:gap-2 sm:text-sm"><MessageCircle size={16} /> Comment</button>
                    <button onClick={() => void sharePost(post)}
                      className="flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:gap-2 sm:text-sm"><Share2 size={16} /> Share</button>
                    <button onClick={() => void toggleSave(post)} aria-pressed={saved}
                      className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold hover:bg-slate-50 sm:gap-2 sm:text-sm ${saved ? "text-emerald-800" : "text-slate-600"}`}><Bookmark size={16} fill={saved ? "currentColor" : "none"} /> Save</button>
                  </div>
                  {openComments[post._id] && (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
                      <div className="space-y-3">
                        {(comments[post._id] || []).map((comment) => (
                          <div key={comment._id} className="flex items-start gap-2.5">
                            <Avatar name={comment.userId?.name} photo={comment.userId?.photo} size="sm" />
                            <div className="min-w-0 flex-1 bg-white px-3 py-2">
                              <p className="text-xs font-semibold text-slate-800">{comment.userId?.name || "Community member"}</p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                        {comments[post._id]?.length === 0 && <p className="text-xs text-slate-500">No comments yet. Start the conversation.</p>}
                      </div>
                      <form className="mt-4 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void submitComment(post); }}>
                        <Avatar name={userName} photo={userPhoto} size="sm" />
                        <input value={commentDrafts[post._id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post._id]: event.target.value }))}
                          maxLength={1000} placeholder="Write a comment..." aria-label="Write a comment"
                          className="h-10 min-w-0 flex-1 border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700" />
                        <button type="submit" disabled={!commentDrafts[post._id]?.trim() || sendingComment === post._id}
                          aria-label="Send comment" className="grid h-10 w-10 shrink-0 place-items-center bg-emerald-800 text-white hover:bg-emerald-900 disabled:opacity-40"><Send size={16} /></button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {hasMore && !loading && !feedError && (
            <button onClick={() => void loadMore()} disabled={loadingMore}
              className="mt-4 h-11 w-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-900 disabled:opacity-50">
              {loadingMore ? "Loading posts..." : "Load more posts"}
            </button>
          )}
          {!hasMore && posts.length > 0 && <p className="py-6 text-center text-xs text-slate-500">You’re all caught up.</p>}
        </section>

        <aside className="hidden lg:block">
          <section className="border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">A good space to grow</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">Share useful lessons, celebrate progress, and keep conversations respectful.</p>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-600">
              <p className="flex gap-2"><Globe2 size={15} className="mt-0.5 shrink-0 text-emerald-700" /> Public posts can be seen in the community feed.</p>
              <p className="flex gap-2"><UsersRound size={15} className="mt-0.5 shrink-0 text-emerald-700" /> Friends-only posts are shared with your friends.</p>
              <p className="flex gap-2"><Video size={15} className="mt-0.5 shrink-0 text-emerald-700" /> Add an image or video to give your post context.</p>
            </div>
          </section>
          <p className="px-2 pt-4 text-[11px] leading-5 text-slate-400">InternArea · Community space</p>
        </aside>
      </div>
    </main>
  );
}