module frostie::run_score {
    use std::string::String;
    use sui::clock::{Self, Clock};

    /// One-time receipt minted to a player right after a completed run.
    /// Consumed (via `unpack`) by challenge_market to source a market's
    /// target score or a challenger's attempt score, so neither ever
    /// crosses into a money-moving call as a raw client-supplied number --
    /// both are sourced from a receipt that only `record_run` can mint.
    public struct RunScore has key {
        id: UID,
        player: address,
        score: u64,
        ms: u64,
        replay_blob_id: String,
    }

    public fun score(run: &RunScore): u64 {
        run.score
    }

    public fun player(run: &RunScore): address {
        run.player
    }

    /// Mints a receipt for the sender's just-completed run. `replay_blob_id`
    /// is the Walrus blob id of the run's input log, or an empty string if
    /// replay storage isn't wired up yet.
    public entry fun record_run(
        score: u64,
        replay_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        transfer::transfer(
            RunScore {
                id: object::new(ctx),
                player,
                score,
                ms: clock::timestamp_ms(clock),
                replay_blob_id,
            },
            player,
        );
    }

    /// Consumes a receipt, returning its fields. The only way to read a
    /// RunScore's score outside this module without going through this
    /// (i.e. without giving up the receipt) is the read-only `score`
    /// accessor above, which doesn't destroy it.
    public fun unpack(run: RunScore): (address, u64, u64, String) {
        let RunScore { id, player, score, ms, replay_blob_id } = run;
        object::delete(id);
        (player, score, ms, replay_blob_id)
    }
}
