# Rollback Plan for [Feature/Release]

## Trigger Conditions
Roll back immediately if ANY of the following occur:
- Error rate > 2x baseline
- P95 latency > 2s
- User reports of critical failure

## Rollback Steps
1. **Feature Flag Fallback:** Disable the associated feature flag in `featureFlags.js`.
   OR
2. **Hard Revert:** `git revert <commit>` and push to `main`.
3. **Verify:** Check `/metrics` to ensure error rates have returned to baseline.

## Time to Rollback
- Feature flag: < 1 minute
- Re-deploy previous commit: < 5 minutes
