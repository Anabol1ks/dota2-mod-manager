# Loadout Lab

Loadout Lab is a personal visual-mod collection manager built as a fork of
Dota 2 Mod Manager. Its focus is control before convenience: profiles are
assembled as drafts, changes are shown before they reach the game folder, and
the user can return the manager's changes to a clean state.

## Safety boundary

- No process injection, memory access, macros, bots, Steam automation, or
  gameplay-affecting functionality.
- No promises about bans or Valve policy.
- Workshop integration is metadata-only: Loadout Lab never subscribes to a
  Workshop item, downloads its content, signs in to Steam, or automates the Steam client.
- A Workshop card may be linked to a VPK, ZIP, or folder the user explicitly selects.
  Those bytes go through the existing validated local-import path; the Workshop page is
  provenance, never a download source.
- The default path stays in the upstream project's Safe mode. Any manager file changes
  remain explicit and reversible.

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

- End-to-end coverage for profile → ChangeSet → apply → clean-state restore.
- More profile showcase polish and richer local preview coverage.
- Optional Workshop-card editing/removal and duplicate-management UX.
- Release packaging and a first user-testable Windows build.

## Delivered in the first PR

- Profiles show a read-only change set before apply and can be described, shared, and reviewed.
- `Чистая Dota` restores the manager's original files and disables managed packs without deleting
  the user's library or profiles.
- Manual imports retain a source kind and content fingerprint, never an absolute local path.
- Mod Doctor runs the same checks as the support report without writing to the game folder.
- Workshop Link validates a Steam Workshop ID against Dota 2 public metadata when available,
  shows a safe metadata card, and keeps an ID-only fallback when Steam metadata is unavailable.
- Workshop cards can be attached to profiles and exported without local paths. A user may
  explicitly link a local VPK/ZIP/folder through the same safe import path; the resulting
  provenance keeps both the Workshop ID and the content fingerprint.

## Attribution

This is a modified GPL-3.0 fork of Dota 2 Mod Manager by TheFleece. The
original copyright and NOTICE remain part of the distribution. Loadout Lab is
a distinct product name and does not claim affiliation with Valve or the
original project.
