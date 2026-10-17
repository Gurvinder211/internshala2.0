import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next/pages";
import { auth, provider } from "../firebase/firebase";
import { Menu, Search, UserRound, X } from "lucide-react";
import { signInWithPopup, signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { logout, selectuser } from "@/Feature/Userslice";
import LanguageSwitcher from "@/Components/LanguageSwitcher";

const Navbar = () => {
  const { t } = useTranslation("common");
  const user = useSelector(selectuser);
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handlelogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      toast.success("logged in successfully");
    } catch (error) {
      console.error(error);
      toast.error("login failed");
    }
    // setuser({
    //   name: "Rahul",
    //   email: "xyz@gmail.com",
    //   photo:
    //     "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces",
    // });
  };
  const handlelogout = () => {
    signOut(auth).catch(() => {}); // no-op if there's no Firebase session
    localStorage.removeItem("authToken");
    dispatch(logout());
  };
  return (
    <div className="relative">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <a href="/" className="text-xl font-bold text-blue-600">
                <img src={"/logo.png"} alt="" className="h-16" />
              </a>
            </div>
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                <Link href={"/internship"}>
                  <span>{t("navbar.internships")}</span>

                </Link>
              </button>
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                <Link href={"/job"}>
                  <span>{t("Jobs")}</span>
                </Link>
              </button>
              {user && (
              <>
                <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                 <Link href={"/subscription"}>
                <span>{t("Plans")}</span>
                  </Link>
                 </button>
                 <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                   <Link href={"/resume-builder/new"}>
                   <span>{t("Resume Builder")}</span>
                   </Link>
                  </button>
                  <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
  <Link href={"/public-space"}><span>{t("Public Space")}</span></Link>
</button>
<button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
  <Link href={"/friends"}>
    <span>{t("Friends")}{typeof user.friendCount === "number" ? ` (${user.friendCount})` : ""}</span>
  </Link>
</button>
                </>

              )}
              



              
              <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder={t("Search opportunities...")}
                  className="ml-2 bg-transparent focus:outline-none text-sm w-48"
                />
              </div>
            </div>

            {/* Language and auth controls */}
            <div className="hidden items-center space-x-4 md:flex">
              <LanguageSwitcher />
              {user ? (
                <div className="relative flex">
                  <Link
                    href="/profile"
                    aria-label="Open profile"
                    title="Profile"
                    className="mr-2 grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-gray-200 bg-emerald-50 text-sm font-semibold text-emerald-900 hover:ring-2 hover:ring-emerald-700/20"
                  >
                    {user.photo || user.photoURL ? (
                      <img src={user.photo || user.photoURL} alt="" className="h-full w-full object-cover" />
                    ) : user.name ? (
                      user.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()
                    ) : (
                      <UserRound size={19} aria-hidden="true" />
                    )}
                  </Link>
                  <button
                    className="flex items-center w-full px-4 py-2  text-gray-700  hover:bg-gray-200 rounded-lg"
                    onClick={handlelogout}
                  >
                    {t("Logout")}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handlelogin}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 flex items-center justify-center space-x-2 hover:bg-gray-50 "
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-gray-700">{t("Continue with google")}</span>
                  </button>
      {/* new: email/password entry points */}
      <Link href="/login"
        className="text-gray-600 hover:text-gray-800 px-3 py-2">
        {t("Login")}
      </Link>
      <Link
        href="/register"
        className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
      >
        {t("Register")}
      </Link>
                  <a
                    href="/adminlogin"
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {t("navbar.admin")}
                  </a>
                </>
              )}
            </div>

            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50 md:hidden"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>{" "}
          {mobileOpen && (
            <div id="mobile-navigation" className="space-y-4 border-t border-gray-100 py-4 md:hidden">
              <nav className="grid gap-1 text-sm font-medium text-gray-700">
                <Link href="/internship" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                  {t("navbar.internships")}
                </Link>
                <Link href="/job" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                  {t("Jobs")}
                </Link>
                {user && (
                  <>
                    <Link href="/subscription" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                      {t("Plans")}
                    </Link>
                    <Link href="/resume-builder/new" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                      {t("Resume Builder")}
                    </Link>
                    <Link href="/public-space" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                      {t("Public Space")}
                    </Link>
                    <Link href="/profile" onClick={() => setMobileOpen(false)} className="rounded px-3 py-2 hover:bg-gray-50">
                      {t("Profile")}
                    </Link>
                  </>
                )}
              </nav>
              <label className="flex items-center rounded bg-gray-100 px-3 py-2">
                <Search size={16} className="shrink-0 text-gray-400" />
                <input
                  type="search"
                  placeholder={t("Search opportunities...")}
                  className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                <LanguageSwitcher />
                {user ? (
                  <button onClick={() => { handlelogout(); setMobileOpen(false); }}
                    className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {t("Logout")}
                  </button>
                ) : (
                  <>
                    <button onClick={() => { void handlelogin(); setMobileOpen(false); }}
                      className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      {t("Continue with google")}
                    </button>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm text-gray-700">
                      {t("Login")}
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      {t("Register")}
                    </Link>
                    <Link href="/adminlogin" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm text-gray-600">
                      {t("navbar.admin")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;

