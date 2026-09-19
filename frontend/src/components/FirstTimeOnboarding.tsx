import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  IndianRupee,
  UsersRound,
  ReceiptText,
  ShieldCheck,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
} from "../lib/onboarding";
import "../styles/Onboarding.css";

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
};

const steps: Step[] = [
  {
    eyebrow: "WELCOME",
    title: "Split smarter. Settle faster.",
    body: "Create shared rooms, divide expenses fairly, and always know what you owe or what others owe you.",
    detail: "SplitVerse keeps shared spending, settlements, wallet activity, and reminders together.",
    icon: CheckCircle2,
  },
  {
    eyebrow: "FRIENDS & ROOMS",
    title: "Build your circle, then share expenses.",
    body: "Add friends and create Split Rooms for trips, dinners, shopping, rent, or anything you share.",
    detail: "Friends can be added to a room automatically when you assign an item or choose who should split it.",
    icon: UsersRound,
  },
  {
    eyebrow: "SPLITTING",
    title: "Split expenses your way.",
    body: "Use Manual Split when an item belongs to a specific person, or Automatic Split to divide an amount between selected friends.",
    detail: "Assign To and Split Between both use your friend list and keep the room members in sync.",
    icon: IndianRupee,
  },
  {
    eyebrow: "PAYABLE & RECEIVABLE",
    title: "See the amount that actually matters.",
    body: "SplitVerse adjusts expenses across rooms so Payable and Receivable show your real net position with each friend.",
    detail: "Opposite dues can offset each other automatically instead of making you settle every raw expense separately.",
    icon: ReceiptText,
  },
  {
    eyebrow: "SETTLEMENTS",
    title: "Remind, collect, and see the full story.",
    body: "Send a reminder to one person, record a manual collection, or open Full Settlement to see every room and item behind a balance.",
    detail: "Settlement history keeps wallet payments, manual collections, offsets, pending amounts, and item-level details transparent.",
    icon: BellRing,
  },
  {
    eyebrow: "WALLET & NOTIFICATIONS",
    title: "Keep payments and activity in one place.",
    body: "Use your SplitVerse Wallet for supported payments and stay updated with friend requests, settlements, and reminders.",
    detail: "Incoming, outgoing, and notification activity stay easy to review whenever you need them.",
    icon: WalletCards,
  },
  {
    eyebrow: "PRIVACY & SETTINGS",
    title: "Make SplitVerse yours.",
    body: "Use Privacy Mode for sensitive screens and personalize currency, language, appearance, and notification preferences from Settings.",
    detail: "You can change these choices later without affecting your rooms or settlement history.",
    icon: ShieldCheck,
  },
];

export default function FirstTimeOnboarding() {
  const { user, dbUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!user?.uid || !dbUser || dbUser.has_wallet_pin === false) {
      setVisible(false);
      return;
    }

    const completed = hasCompletedOnboarding(user.uid);
    setVisible(!completed);
    if (!completed) setStepIndex(0);
  }, [dbUser, user?.uid]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const progressLabel = useMemo(
    () => `${stepIndex + 1} of ${steps.length}`,
    [stepIndex],
  );

  if (!visible || !user?.uid) return null;

  const Icon = step.icon;

  function finish() {
    if (!user?.uid) return;
    markOnboardingCompleted(user.uid);
    setVisible(false);
  }

  return (
    <div className="sv-onboarding-overlay" role="dialog" aria-modal="true" aria-label="SplitVerse walkthrough">
      <div className="sv-onboarding-shell">
        <div className="sv-onboarding-topbar">
          <div className="sv-onboarding-brand">Split<span>Verse</span></div>
          {!isLast ? (
            <button className="sv-onboarding-skip" type="button" onClick={finish}>
              Skip <X size={16} />
            </button>
          ) : (
            <span />
          )}
        </div>

        <div className="sv-onboarding-grid">
          <div className="sv-onboarding-visual">
            <div className="sv-onboarding-icon-halo">
              <Icon size={82} strokeWidth={1.7} />
            </div>
            <div className="sv-onboarding-mini-cards" aria-hidden="true">
              <div className="sv-onboarding-mini-card"><i /><span /><span /></div>
              <div className="sv-onboarding-mini-card success"><i /><span /><span /></div>
            </div>
          </div>

          <div className="sv-onboarding-copy">
            <span className="sv-onboarding-eyebrow">{step.eyebrow}</span>
            <h1>{step.title}</h1>
            <p className="sv-onboarding-body">{step.body}</p>
            <p className="sv-onboarding-detail">{step.detail}</p>
          </div>
        </div>

        <div className="sv-onboarding-footer">
          <div className="sv-onboarding-progress">
            <div className="sv-onboarding-dots" aria-label={progressLabel}>
              {steps.map((item, index) => (
                <span key={item.eyebrow} className={index === stepIndex ? "active" : ""} />
              ))}
            </div>
            <small>{progressLabel}</small>
          </div>

          <div className="sv-onboarding-actions">
            {stepIndex > 0 ? (
              <button type="button" className="sv-onboarding-back" onClick={() => setStepIndex((value) => Math.max(0, value - 1))}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="sv-onboarding-next"
              onClick={() => {
                if (isLast) {
                  finish();
                  return;
                }
                setStepIndex((value) => value + 1);
              }}
            >
              {isLast ? "Start using SplitVerse" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
