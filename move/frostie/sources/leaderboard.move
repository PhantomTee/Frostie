module frostie::leaderboard {
    use sui::table::{Self, Table};
    use frostie::delegate::{Self, DelegateRegistry};

    /// Shared object holding every player's best score. Read by yeti_nft to
    /// gate rarer mints, and written by the game client after each run.
    public struct Leaderboard has key {
        id: UID,
        scores: Table<address, u64>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(Leaderboard {
            id: object::new(ctx),
            scores: table::new(ctx),
        });
    }

    /// Records `score` as the player's best if it beats their current best.
    /// `ctx`'s sender may be a session/burner key registered as a delegate
    /// for the real player — `delegate::owner_of` resolves to whichever
    /// wallet should actually be credited. Lower scores are silently
    /// ignored rather than erroring, since the client calls this
    /// unconditionally after every run.
    public entry fun submit_score(
        board: &mut Leaderboard,
        registry: &DelegateRegistry,
        score: u64,
        ctx: &TxContext,
    ) {
        let player = delegate::owner_of(registry, tx_context::sender(ctx));
        if (table::contains(&board.scores, player)) {
            let current = table::borrow_mut(&mut board.scores, player);
            if (score > *current) {
                *current = score;
            };
        } else {
            table::add(&mut board.scores, player, score);
        };
    }

    public fun highest_score(board: &Leaderboard, player: address): u64 {
        if (table::contains(&board.scores, player)) {
            *table::borrow(&board.scores, player)
        } else {
            0
        }
    }
}
