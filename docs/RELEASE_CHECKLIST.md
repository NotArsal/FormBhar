# Release & Rollout Checklist

Follow this checklist for preparing, canary testing, and launching new releases of FormBhar to production.

---

## 1. Pre-Launch Checks

- [ ] All automated tests pass (`npm test` in backend is green).
- [ ] Linter validation completes with no errors (`npm run lint` in backend is clean).
- [ ] Manifest version is incremented in `manifest.json`.
- [ ] Telemetry backend production URL is correct in `analytics.js`.
- [ ] No debug console statements or hardcoded API keys exist in code.

---

## 2. Staged Rollout Strategy

We use a staged rollout sequence to minimize blast radius on version upgrades.

```
[Staging Verification] ──> [Canary Rollout (10%)] ──> [Full Production Rollout]
                                 │                            │
                                 └── If Errors > 2%           └── If Errors > 2%
                                       └── [ROLLBACK]               └── [ROLLBACK]
```

### Phase A: Canary Rollout (10% of users)
1. Deploy the new backend server to the Render canary/staging instance.
2. Publish Chrome Extension update to the Chrome Web Store, configured for a **10% random rollout** (Chrome Web Store developer console parameter).
3. Monitor backend logs for the first 24 hours.

### Phase B: Verification Thresholds
Monitor the following metrics in logs and dashboards during the canary period:

| Metric | Target | Action Threshold | Rollback Trigger |
|---|---|---|---|
| API Error Rate | <0.5% | >1% (Hold & Investigate) | >2% (Immediate Rollback) |
| Latency (p95) | <1.5s | >2s (Optimize) | >3s (Rollback) |
| Active User Pings | Constant | Drop >10% (Investigate) | Drop >20% (Rollback) |

---

## 3. Rollback Plan

If any rollback trigger is reached, execute these recovery steps immediately:

### Step 1: Revert Extension Release
1. Open the Chrome Web Store Developer Console.
2. Select the FormBhar extension.
3. Click "Roll back to previous version" (or update version string to the last stable package and request expedited review).

### Step 2: Revert Backend Deploy
1. Revert the commit on `main`:
   ```bash
   git revert HEAD -m "revert release"
   git push origin main
   ```
2. Render will automatically redeploy the last stable commit.
3. Confirm that the health check `/` returns `200 OK` and logs return to baseline.
