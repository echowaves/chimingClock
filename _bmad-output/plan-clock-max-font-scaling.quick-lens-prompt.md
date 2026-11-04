# Quick review lens prompt (launch failed 2026-11-03 — run in a fresh session and paste findings back)

Read `/Users/dmitry/hacks/chimingClock/_bmad-output/plan-clock-max-font-scaling.md` and `/Users/dmitry/hacks/chimingClock/_bmad-output/plan-safe-area-context-migration.md` — they hold the acceptance criteria and intent. There are no AGENTS.md/CLAUDE.md instruction files at this repository root. Regenerate the diff of the change under review with:

```bash
cd /Users/dmitry/hacks/chimingClock && git diff 5746c68 -- App.js package.json > /tmp/bmad-sac-font.diff
```

(the full current file is `App.js`; pre-change version is at git commit `5746c68`).

Context: an earlier review of an intermediate state found that react-native-safe-area-context's `SafeAreaView` implements insets as padding and its `onLayout` reports the full border box, so this change replaced layout-measurement with `useSafeAreaInsets()` subtraction (the reviewer-recommended approach). Judge whether that is now implemented correctly: motion box = window dims minus live insets on both platforms; digit placement offset by insets inside the full-window tap-target `Pressable`; font fitted to the largest size in the inset box minus EDGE_TRAVEL_MARGIN with no other ceiling.

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what goes wrong, and evidence checked against the surrounding code. Output a Markdown list of findings only — no severity, priority, or ranking.

Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates. Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
