import Footer from "@/Components/Fotter";
import Navbar from "@/Components/Navbar";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { store } from "../store/store";
import { Provider, useDispatch } from "react-redux";
import { appWithTranslation } from "next-i18next/pages";
import { useEffect } from "react";
import { auth } from "@/firebase/firebase";
import { login, logout } from "@/Feature/Userslice";
import axios from "axios";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import enCommon from "../../public/locales/en/common.json";
import esCommon from "../../public/locales/es/common.json";
import frCommon from "../../public/locales/fr/common.json";
import hiCommon from "../../public/locales/hi/common.json";
import ptCommon from "../../public/locales/pt/common.json";
import zhCommon from "../../public/locales/zh/common.json";

const i18nConfig = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "fr", "hi", "pt", "zh"],
    localeDetection: false as false,
  },
  resources: {
    en: { common: enCommon },
    es: { common: esCommon },
    fr: { common: frCommon },
    hi: { common: hiCommon },
    pt: { common: ptCommon },
    zh: { common: zhCommon },
  },
};

function App({ Component, pageProps }: AppProps) {
  function AuthListener() {
    const dispatch = useDispatch();
    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((authuser) => {
        const restoreSession = async () => {
          if (authuser) {
            try {
              const idToken = await authuser.getIdToken();
              const { data } = await axios.post("http://localhost:5000/api/user/sync", {}, {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              dispatch(login(data.user));
            } catch {
              dispatch(login({
                uid: authuser.uid,
                photo: authuser.photoURL,
                name: authuser.displayName,
                email: authuser.email,
                phoneNumber: authuser.phoneNumber,
              }));
            }

            return;
          }

          const localToken = localStorage.getItem("authToken");
          if (!localToken) {
            dispatch(logout());
            return;
          }

          try {
            const { data } = await axios.get("http://localhost:5000/api/auth/me", {
              headers: { Authorization: `Bearer ${localToken}` },
            });
            dispatch(login(data.user));
          } catch {
            localStorage.removeItem("authToken");
            dispatch(logout());
          }
        };

        void restoreSession();
      });

      return unsubscribe;
    }, [dispatch]);
    return null;
  }

  return (
    <Provider store={store}>
      <AuthListener />
      <div className="bg-white">
        <ToastContainer/>
        <Navbar />
        <Component {...pageProps} />
        <Footer />
      </div>
    </Provider>
  );
}
export default appWithTranslation(App, i18nConfig);