import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./verifyFirebaseToken.js";

export function normalizeAdminEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(normalizeAdminEmail)
      .filter(Boolean),
  );
}


export function isConfiguredAdminEmail(value: unknown) {
  const email = normalizeAdminEmail(value);
  return Boolean(email) && getAdminEmails().has(email);
}

export function isAdminRequest(req: AuthRequest) {
  const email = normalizeAdminEmail(req.user?.email);
  if (!email) return false;
  if (req.user?.email_verified === false) return false;
  return getAdminEmails().has(email);
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "Your session has expired. Please sign in again.",
    });
  }

  if (!isAdminRequest(req)) {
    return res.status(403).json({
      code: "ADMIN_ACCESS_DENIED",
      message: "You do not have permission to access the SplitVerse Admin Portal.",
    });
  }

  next();
}

export function getAdminIdentity(req: AuthRequest) {
  return {
    firebaseUid: String(req.user?.uid || req.user?.sub || ""),
    email: normalizeAdminEmail(req.user?.email),
  };
}
