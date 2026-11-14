# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **PII Isolation**: Player emails reside exclusively in `/playersPrivate/{uid}` and are readable/writable only by `request.auth.uid == uid`. Public profiles (`/playersPublic/{uid}`) contain zero PII.
2. **Identity Integrity**: Every player-owned document (`PlayerPublic`, `PlayerPrivate`, `PlayerLevelProgress`, `PlayerDraftLevel`, `ServerLevel`, `ServerLevelLike`, `ServerLevelComment`) enforces `uid == request.auth.uid` or `authorUid == request.auth.uid` on creation and immutability on update.
3. **Server Timestamp Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`.
4. **Atomic Like Integrity**: Creating or deleting `/serverLevels/{levelId}/likes/{uid}` requires atomically updating `/serverLevels/{levelId}.likes` by `+1` or `-1` verified via `existsAfter` / `getAfter`.
5. **Bounded Payloads**: `objects` arrays in drafts and server levels are capped at `<= 1500` items; `coinsCollected` is capped at `<= 3`; all string fields have strict `.size()` caps; all document IDs match `^[a-zA-Z0-9_\-]+$` with length `<= 128`.
6. **Parent Existence**: Comments and likes require `exists()` on the parent `/serverLevels/{levelId}` document.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Server Level**: Creating `/serverLevels/lvl1` with `authorUid: "victim_uid"` while authenticated as `"attacker_uid"` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on Public Profile**: Creating `/playersPublic/{uid}` with an extra `"isAdmin": true` ghost field -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Attempting any write with `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
4. **PII Leak Attempt**: Reading `/playersPrivate/{otherUid}` as an authenticated non-owner -> `PERMISSION_DENIED`.
5. **Resource Exhaustion (1MB String ID)**: Creating a document with a 500-character ID or invalid characters (`../bad`) -> `PERMISSION_DENIED`.
6. **Oversized Objects Array**: Publishing a `ServerLevel` with `objects.size() > 1500` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Creating a comment with `createdAt` set to a client-chosen past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Like Count Inflation**: Updating `/serverLevels/{levelId}` to set `likes: existing.likes + 100` without an atomic like subdocument -> `PERMISSION_DENIED`.
9. **Orphaned Comment**: Creating a comment under a non-existent `/serverLevels/missing_id` -> `PERMISSION_DENIED`.
10. **Author Hijack on Update**: Updating an existing `ServerLevel` to change `authorUid` -> `PERMISSION_DENIED`.
11. **Non-Owner Draft Access**: Listing `/playersPrivate/{otherUid}/drafts` while signed in as `attacker_uid` -> `PERMISSION_DENIED`.
12. **Type Poisoning on Update**: Updating `playersPublic/{uid}` with `stars: "99999"` (string instead of int) -> `PERMISSION_DENIED`.
