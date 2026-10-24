# Committed practice poker and private replay

Each new hand receives a separate 52-card server-generated shuffle. Before any hole cards are assigned, the database writes an append-only commitment containing 52 salted card hashes and fixed destinations for each seat and the five community cards. Table ID, hand number, deck position, rank, suit and a fresh 256-bit secret bind each card. Hold'em deals two cards to up to eight seats; Omaha deals four cards to up to six seats. Tournament tables use their own independent hand records.

Actions, street advances, time extensions, timeouts and settlements append numbered frames to a hash chain. The browser verifies card openings, the complete replay sequence and previously observed commitments. The table page includes a hand list, previous/next controls, playback and a step slider. Completed hands remain available to their original participants after tournament moves or elimination.

Players receive their own hole cards. Opponent holes become visible only for non-folded participants at a completed showdown. Fold wins expose no opponent holes. The full shuffle seed and secrets for hidden cards never leave the backend. Direct client access to archive tables and actor-selecting RPCs is denied; the authenticated Edge Function supplies the actor identity.

These records verify consistency with a published commitment. They do not independently certify that the operator did not select a deck before committing it, that the operator never rewrote unobserved records, or that all 52 hidden cards are unique. The database validates a standard unique deck, and the browser can detect changes to records it previously observed. An independent witness or stronger shuffle proof would be needed for those additional guarantees.

Deployment applies the new migration to `qonqemhljgxlwpghkxhn`, then updates only `poker-table-v1`, `poker-events-v1` and `admin-crash-rounds`. Hands already underway are not retroactively certified. New verified history begins with the next hand. Existing Omaha evaluation, social features, player statistics, practice scope and authentication are preserved.

Automatic multiplayer Crash generation tops up to 25 when fewer than five rounds remain. Existing committed rounds drain normally. The separate manual batch endpoint accepts an integer count from 1 through 75, defaults to 75 and rejects larger or malformed requests. The retired legacy operator forms remain unavailable.

Verification covers actual repository poker migrations in PostgreSQL, eight-seat Hold'em, six-seat Omaha, pre-deal commitments, immutable records, folded-card privacy, outsider denial, tournament consolidation, short blinds, timeout actions, pagination, displayed-card mismatches and edited/truncated records. The local database fixture uses SHA-256 equivalents for pgcrypto; hosted pgcrypto is checked separately during deployment.
