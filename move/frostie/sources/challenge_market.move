module frostie::challenge_market {
    use std::string::String;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use frostie::run_score::{Self, RunScore};

    /// Markets auto-expire a day after creation if nobody beats the score.
    const ONE_DAY_MS: u64 = 86_400_000;
    /// Cut taken by the treasury on a win or an expiry refund.
    const TREASURY_BPS: u64 = 1000;
    const BPS_DENOM: u64 = 10000;

    const ENotParticipant: u64 = 0;
    const EAlreadyJoined: u64 = 1;
    const EWrongStake: u64 = 2;
    const EMarketSettled: u64 = 3;
    const EMarketClosed: u64 = 4;
    const EMarketStillOpen: u64 = 5;

    /// Shared per-challenge pot. `target_score` and every participant's
    /// attempt score are sourced from a RunScore receipt (see run_score.move)
    /// rather than a raw client-supplied number, so nobody can fabricate a
    /// score to win the pool.
    public struct ChallengeMarket has key {
        id: UID,
        creator: address,
        target_score: u64,
        stake_amount: u64,
        pool: Balance<SUI>,
        participants: vector<address>,
        replay_blob_id: String,
        created_ms: u64,
        closes_ms: u64,
        settled: bool,
        winner: address,
    }

    /// Shared config holding only the royalty/treasury destination, mirroring
    /// marketplace.move's Marketplace struct.
    public struct ChallengeConfig has key {
        id: UID,
        treasury: address,
    }

    public struct AdminCap has key, store {
        id: UID,
    }

    public struct MarketCreated has copy, drop {
        market_id: ID,
        creator: address,
        target_score: u64,
        stake_amount: u64,
        closes_ms: u64,
    }

    public struct ChallengerJoined has copy, drop {
        market_id: ID,
        challenger: address,
        pool_total: u64,
    }

    public struct MarketWon has copy, drop {
        market_id: ID,
        winner: address,
        score: u64,
        payout: u64,
    }

    public struct MarketExpired has copy, drop {
        market_id: ID,
        total_refunded: u64,
    }

    // Module `init` only runs at the package's original publish -- this
    // module is added in a later upgrade, so the ChallengeConfig/AdminCap are
    // created by calling this once by hand right after the upgrade lands.
    public entry fun initialize(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        transfer::transfer(AdminCap { id: object::new(ctx) }, sender);
        transfer::share_object(ChallengeConfig {
            id: object::new(ctx),
            treasury: sender,
        });
    }

    public entry fun set_treasury(_admin: &AdminCap, config: &mut ChallengeConfig, new_treasury: address) {
        config.treasury = new_treasury;
    }

    /// Opens a market targeting the score on `run`, staking `stake` as the
    /// creator's own entry into the pool. Consuming the receipt here is what
    /// ties `target_score` to an actual completed, on-chain-recorded run.
    public entry fun create_market(
        run: RunScore,
        stake: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let (player, score, _ms, replay_blob_id) = run_score::unpack(run);
        let creator = tx_context::sender(ctx);
        assert!(creator == player, ENotParticipant);

        let stake_amount = coin::value(&stake);
        let created_ms = clock::timestamp_ms(clock);
        let closes_ms = created_ms + ONE_DAY_MS;
        let market = ChallengeMarket {
            id: object::new(ctx),
            creator,
            target_score: score,
            stake_amount,
            pool: coin::into_balance(stake),
            participants: vector[creator],
            replay_blob_id,
            created_ms,
            closes_ms,
            settled: false,
            winner: @0x0,
        };
        event::emit(MarketCreated {
            market_id: object::id(&market),
            creator,
            target_score: score,
            stake_amount,
            closes_ms,
        });
        transfer::share_object(market);
    }

    /// Buys into an open market with a stake matching the creator's exactly.
    public entry fun join_market(
        market: &mut ChallengeMarket,
        stake: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!market.settled, EMarketSettled);
        assert!(clock::timestamp_ms(clock) < market.closes_ms, EMarketClosed);
        assert!(coin::value(&stake) == market.stake_amount, EWrongStake);

        let challenger = tx_context::sender(ctx);
        assert!(!market.participants.contains(&challenger), EAlreadyJoined);
        market.participants.push_back(challenger);
        balance::join(&mut market.pool, coin::into_balance(stake));

        event::emit(ChallengerJoined {
            market_id: object::id(market),
            challenger,
            pool_total: balance::value(&market.pool),
        });
    }

    /// Submits a completed run as an attempt against the market's target.
    /// Consumes the receipt regardless of outcome -- a participant who
    /// misses can keep playing and submit a fresh receipt to retry, without
    /// re-staking, until either someone wins or the market expires.
    public entry fun submit_attempt(
        market: &mut ChallengeMarket,
        config: &ChallengeConfig,
        run: RunScore,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!market.settled, EMarketSettled);
        assert!(clock::timestamp_ms(clock) < market.closes_ms, EMarketClosed);

        let (player, score, _ms, _replay_blob_id) = run_score::unpack(run);
        let sender = tx_context::sender(ctx);
        assert!(sender == player, ENotParticipant);
        assert!(market.participants.contains(&sender), ENotParticipant);

        if (score > market.target_score) {
            let total = balance::value(&market.pool);
            let treasury_cut = total * TREASURY_BPS / BPS_DENOM;
            let payout = total - treasury_cut;
            let cut_balance = balance::split(&mut market.pool, treasury_cut);
            let payout_balance = balance::split(&mut market.pool, payout);

            transfer::public_transfer(coin::from_balance(cut_balance, ctx), config.treasury);
            transfer::public_transfer(coin::from_balance(payout_balance, ctx), sender);

            market.settled = true;
            market.winner = sender;
            event::emit(MarketWon {
                market_id: object::id(market),
                winner: sender,
                score,
                payout,
            });
        };
    }

    /// Refunds every participant (minus the treasury's cut) once a market's
    /// day has passed with nobody beating the target. Anyone can trigger
    /// this -- it's a cleanup call, not a privileged one.
    public entry fun close_expired(
        market: &mut ChallengeMarket,
        config: &ChallengeConfig,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!market.settled, EMarketSettled);
        assert!(clock::timestamp_ms(clock) >= market.closes_ms, EMarketStillOpen);

        let total_refunded_bps = BPS_DENOM - TREASURY_BPS;
        let refund_per_participant = market.stake_amount * total_refunded_bps / BPS_DENOM;
        let mut total_refunded = 0;

        let mut i = 0;
        let len = market.participants.length();
        while (i < len) {
            let participant = *market.participants.borrow(i);
            let refund_balance = balance::split(&mut market.pool, refund_per_participant);
            total_refunded = total_refunded + balance::value(&refund_balance);
            transfer::public_transfer(coin::from_balance(refund_balance, ctx), participant);
            i = i + 1;
        };

        // Remaining balance is the treasury's cut plus any rounding dust.
        let remainder = balance::withdraw_all(&mut market.pool);
        transfer::public_transfer(coin::from_balance(remainder, ctx), config.treasury);

        market.settled = true;
        event::emit(MarketExpired {
            market_id: object::id(market),
            total_refunded,
        });
    }
}
