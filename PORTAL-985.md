# 985 website portal

The portal uses the same Firebase project and collections as the native app. The public site, Forms, Directory, Family Tree, Gallery, Birthdays, Blog and chapter link pages retain their existing modules. No legacy collection was deleted.

## Portal modules

`portal-985-core.js` supplies authenticated API requests, safe text rendering, images, mentions and shared controls. Feed, profiles, chat, events, roster, administration and map each have a separate module. `portal-985-policy.js` mirrors channel presentation eligibility; Firestore and server functions remain authoritative.

- Feed and announcements: `forumPosts`, replies, likes, `postStatistics`, `polls`.
- Messaging: `socialChannels/{room}/messages`, `conversations`, `socialAccess`, `blocks`, `channelMutes`, `activity`, `roomReads`. Direct-message IDs use the same sorted UID SHA-256 scheme as iOS.
- Events: `appEvents` and the `eventAction` callable. Admin create/edit/delete/review is enforced on the server. Non-admin hosts submit for approval. Guest lists unlock after RSVP, and private guest phone numbers are never exposed to other guests.
- Profiles: `users`, with native `avatarPath`, social profile URL fields, class and leadership titles.
- Roster: `masterRosterClasses`, `masterRoster`, with separate conservative comparisons against `familyTree`. Identity edits preserve tree relationships.
- Administration: `membershipApplications`, `organization/leadership`, `organization/adminAuthority`, `leadershipAudit`; changes use `reviewMembership` and `manageLeadership`. Only the authority owner can grant/revoke admin access or assign admin-granting national roles.
- Globe: `brotherLocations`, displaying only valid approximate areas updated within seven days. No browser geolocation is requested or uploaded. Map data attribution initially appears and collapses to an information button after five seconds.

Post bookmarks have been removed from both clients. The deployed Firestore rules permit saving only events and documents; existing saved-post records are retained but excluded from the app's Saved list.

## Account requests

The old client-side invite-code signup and admin-code privilege grant have been removed. Signup uses `membershipReadiness` and `submitMembership`. The Firebase `serverConfiguration/membership.enabled` switch was **off** when checked on November 3, 2026. Requests report that registration is not open until the existing membership migration is completed and that switch is enabled. Existing approved brothers can still sign in normally. Do not bypass this guard or create client-side `users` records for applicants.

## Validation

Run `node --test tests/portal-985.test.cjs`. To compare the UI circle list against the backend implementation, set `NAP_SERVER_POLICY` to the absolute path of `backend/functions/social-policy.js` in the iOS repository.

November 3 checks: 6 portal checks including all supported circle grants; 13 event/public-event checks; 50 compatible Firestore/Storage checks. Tested browser interactions against an isolated local fixture (never production posts/RSVPs). The iOS no-post-bookmarks change builds for generic iOS without signing. That build is not an installed phone update.

The local fixture server and sample account data are outside this repository and are never published. Static files publish through the existing GitHub Pages master branch. Backend updates deploy separately from the iOS repository.
