# Loadout Lab

Loadout Lab is a personal visual-mod collection manager built as a fork of
Dota 2 Mod Manager. Its focus is control before convenience: profiles are
assembled as drafts, changes are shown before they reach the game folder, and
the user can return the manager's changes to a clean state.

## Safety boundary

- No process injection, memory access, macros, bots, Steam automation, or
  gameplay-affecting functionality.
- No promises about bans or Valve policy.
- No downloading or extracting Workshop assets. User imports only files they
  obtained from an author with permission.
- The default path stays in the upstream project's Safe mode. Features that
  patch Valve files are not part of this fork's roadmap.

## Product flow

1. Browse a personal collection and hero-oriented showcase.
2. Assemble a profile without changing Dota.
3. Inspect the resulting change set, missing mods, and conflicts.
4. Apply only after a deliberate confirmation.
5. Keep a restore point and offer a clear return to manager-free state.

## First delivery

- Read-only `ChangeSet` domain model for profile comparisons.
- IPC route ready for the future profile screen.
- Product rename and explicit fork attribution.
- Unit coverage for the change-set decisions.

## Next deliveries

- Profile editor and showcase.
- Change-set screen and confirmation flow.
- Clean-state restore with a verification report.
- Import provenance for manually supplied VPK/ZIP files.
- Mod Doctor and restore-point history.

## Attribution

This is a modified GPL-3.0 fork of Dota 2 Mod Manager by TheFleece. The
original copyright and NOTICE remain part of the distribution. Loadout Lab is
a distinct product name and does not claim affiliation with Valve or the
original project.
