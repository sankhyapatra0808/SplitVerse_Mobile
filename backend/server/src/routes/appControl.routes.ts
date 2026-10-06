import { Router } from "express";
import { db } from "../config/db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [configResult, flagsResult] = await Promise.all([
      db.query(`SELECT key,value FROM app_configuration WHERE key LIKE 'android_%' OR key LIKE 'maintenance_%'`),
      db.query(`SELECT key,enabled,rollout_percent FROM feature_flags`),
    ]);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({
      config: Object.fromEntries(configResult.rows.map((row) => [row.key, row.value])),
      featureFlags: Object.fromEntries(flagsResult.rows.map((row) => [row.key, { enabled: row.enabled, rolloutPercent: row.rollout_percent }])),
    });
  } catch (error) {
    console.error("App control config failed:", error);
    res.status(503).json({ message: "App control configuration is temporarily unavailable" });
  }
});

export default router;
