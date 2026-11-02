# Security Specification: NexTrip Travels Manager

## Data Invariants
1. A passenger entry must have a non-empty name, phone, and status.
2. The `createdBy` field must match the UID of the user who created it.
3. The `status` must be one of the predefined values.
4. Timestamps (`createdAt`, `updatedAt`) must be server-generated.

## The Dirty Dozen (Test Payloads)
1. Creating a passenger with an arbitrary `createdBy` UID (not own). -> DENIED
2. Updating a passenger's `createdBy` or `sl` once set. -> DENIED
3. Setting an invalid `status` (e.g., "Ready to go"). -> DENIED
4. Creating a passenger without a `phone` number. -> DENIED
5. Updating `createdAt` timestamp. -> DENIED
6. Deleting a passenger (if not admin/owner - currently no delete allowed in UI). -> DENIED
7. Reading passengers without being logged in. -> DENIED
8. Injecting a massive string into `country`. -> DENIED
9. Modifying `name` field during an update that should only change `status`. -> ALLOWED (but we check schema)
10. Creating entry with future `createdAt`. -> DENIED
11. Updating `sl` field. -> DENIED
12. Creating entry with invalid ID format. -> DENIED
