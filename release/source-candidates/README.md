# Review inputs, not a production installer

These SQL files are preserved source candidates from the payment and legal worktrees.
They have NOT been reconciled into a production-specific installer. Do not apply them,
copy their history to production, run `supabase db push`, or reset a hosted database.

The payment foundations include excluded delivery, Ozow and corporate functionality.
The original manual migration also changes gateway settings. The settings-revision
candidate explicitly permits only a disposable fixture or the staging ref. None is a
production migration merely because a copy appears here. Do not remove guards or
change a project marker to make these inputs install.

The B/C/D/E chain requires versioned legal/commercial and manual banking foundations;
these foundations are absent from production at the recorded observation. Preserve
existing acceptance stores and historical financial records when extracting the
minimum foundations. No second vendor acceptance system is proposed.

`checks/reference-regressions/` preserves the synthetic legacy test context, including
excluded features as historical test dependencies. Only its PGlite wrapper is run.
This archive is not part of the frontend entry graph or an installation sequence.
