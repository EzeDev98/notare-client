# Release 1.0 audits (step 20b)

Fill in one line per audit: date, Pass or Fail, and a note. A Fail needs a fix and a re-run before release.
Device matrix for the visual audits: 375x667, 390x844, 768x1024, 1280x800, 1920x1080; light and dark;
reduced motion on and off; online and offline. Tick each cell you covered under "Matrix".

Build: ____   Server: ____   Tester: ____

## Audits

| Audit | Pass condition | Date | Pass/Fail | Notes |
|---|---|---|---|---|
| Layout jump | Loading, empty, error, offline and every step 14 state cause no layout jump (or the jump is the accepted O-11 choice) | | | |
| Type | Every text node computes to Red Hat Text, weight 400, a size from the scale; note body 14/20; inputs 16px | | | |
| Token | No hex, rgb, hsl or px outside tokens.css (lint) | | | |
| Motion | Only transform and opacity animate; no routine duration above 260ms except fly 440; reduced motion gives 120ms fades | | | |
| Focus | Every control reachable by keyboard with the brand ring; Escape closes only the top overlay; focus returns to the opener | | | |
| Empty note | Create and abandon 10 notes quickly: zero rows on the device and zero on the server | | | |
| Offline | Install, go offline, cold-start, write, record a clip, come online: everything syncs once, no duplicates | | | |
| Two-device | Edit the same note offline on both devices: they merge with no overwrite | | | |
| Install | The onboarding line "Checked: Notare opens without a connection" is true | | | |
| Role | For Owner, Editor and Viewer every menu item and button matches master 6.3.1, and the server rejects what the client hides | | | |
| Transcription | Online; offline (queues and runs on reconnect); failed (Retry works); app closed mid-job (result is there on return); Editor allowed; Viewer read-only | | | |
| Purge | A note deleted 31 days ago is gone with its clips and transcripts; the days-left figure matches the server date | | | |
| Migration | Counts of notes, clips, shares, transcripts and connections match before and after on a copy of real data; no duplicates (see the server repo's docs/migration.md) | | | |
| Reset | Reset this device with unsynced changes shows the warning; afterwards everything returns from the account | | | |

## Accessibility pass

| Check | Date | Pass/Fail | Notes |
|---|---|---|---|
| axe-core on every screen: zero serious or critical issues | | | |
| VoiceOver (iPhone): sign in, list, editor, voice block, share modal | | | |
| TalkBack (Android): sign in, list, editor, voice block, share modal | | | |

## PWA pass

| Check | Date | Pass/Fail | Notes |
|---|---|---|---|
| Install on Android Chrome; open from the home screen | | | |
| Install on iPhone Safari; open from the home screen | | | |
| Update flow: deploy a new build, "Update available" appears, reload applies it | | | |

## Matrix (tick what you covered for the visual audits)

| | Light | Dark | Reduced motion on | Reduced motion off | Online | Offline |
|---|---|---|---|---|---|---|
| 375x667 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 390x844 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 768x1024 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 1280x800 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 1920x1080 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Result

- [ ] Every row above is Pass, with a date.
- Failures and fixes: ____
