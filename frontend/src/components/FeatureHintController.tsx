import { Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  hasCompletedOnboarding,
  hasSeenFeatureHint,
  markFeatureHintSeen,
} from "../lib/onboarding";
import "../styles/Onboarding.css";

type Hint = {
  key: string;
  title: string;
  body: string;
};

function getHint(pathname: string): Hint | null {
  if (pathname.startsWith("/settlements/history/")) {
    return {
      key: "settlement-history",
      title: "Every balance has a story",
      body: "Full Settlement shows every room, item, wallet payment, manual collection, offset, and pending amount behind this friend balance.",
    };
  }
  if (pathname.startsWith("/settlements/")) {
    return {
      key: "settlement-details",
      title: "These are adjusted settlements",
      body: "Payable and Receivable can combine dues from several rooms. Remind or manually collect from one person, then open Full Settlement for the complete breakdown.",
    };
  }
  if (pathname === "/split-rooms") {
    return {
      key: "split-rooms",
      title: "Create first, then add people naturally",
      body: "Create the room first. Assign To and Split Between use your friend list and automatically keep the room member list updated.",
    };
  }
  if (pathname === "/friends") {
    return {
      key: "friends",
      title: "Build your SplitVerse circle",
      body: "Search for people, send requests, and keep your friend list ready for shared rooms and expense splitting.",
    };
  }
  if (pathname === "/wallet" || pathname === "/wallet-top-up") {
    return {
      key: "wallet",
      title: "Your wallet activity lives here",
      body: "Review balances, incoming and outgoing activity, and use supported wallet payments when settling with friends.",
    };
  }
  if (pathname === "/transactions") {
    return {
      key: "transactions",
      title: "Review every wallet movement",
      body: "Transaction History keeps your wallet activity easy to trace whenever you need to check a payment or transfer.",
    };
  }
  if (pathname === "/settings") {
    return {
      key: "settings",
      title: "Make SplitVerse yours",
      body: "Adjust Privacy Mode, currency, language, appearance, wallet preferences, and notifications without changing your expense history.",
    };
  }
  if (pathname === "/dashboard") {
    return {
      key: "dashboard",
      title: "Your shared spending at a glance",
      body: "Use the dashboard to see your current position and jump quickly into the parts of SplitVerse you use most.",
    };
  }
  return null;
}

export default function FeatureHintController() {
  const location = useLocation();
  const { user, dbUser } = useAuth();
  const hint = useMemo(() => getHint(location.pathname), [location.pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function checkHint() {
      if (!user?.uid || !dbUser || dbUser.has_wallet_pin === false || !hint || !hasCompletedOnboarding(user.uid)) {
        setVisible(false);
        return;
      }
      setVisible(!hasSeenFeatureHint(user.uid, hint.key));
    }

    checkHint();
    window.addEventListener("splitverse:onboarding-complete", checkHint);
    return () => window.removeEventListener("splitverse:onboarding-complete", checkHint);
  }, [dbUser, hint, user?.uid]);

  if (!visible || !user?.uid || !hint) return null;

  function dismiss() {
    if (!user?.uid || !hint) return;
    markFeatureHintSeen(user.uid, hint.key);
    setVisible(false);
  }

  return (
    <aside className="sv-feature-hint" aria-live="polite">
      <button type="button" className="sv-feature-hint-close" onClick={dismiss} aria-label="Dismiss tip">
        <X size={17} />
      </button>
      <div className="sv-feature-hint-icon"><Lightbulb size={23} /></div>
      <div className="sv-feature-hint-copy">
        <span>QUICK TIP</span>
        <strong>{hint.title}</strong>
        <p>{hint.body}</p>
      </div>
      <button type="button" className="sv-feature-hint-button" onClick={dismiss}>Got it</button>
    </aside>
  );
}
