module frostie::yeti_nft {
    use frostie::leaderboard::{Self, Leaderboard};
    use frostie::delegate::{Self, DelegateRegistry};
    use sui::table::{Self, Table};
    use std::string::{Self, String};

    const TIER_COMMON: u8 = 0;
    const TIER_RARE: u8 = 1;
    const TIER_LEGENDARY: u8 = 2;

    const UNLOCK_RARE: u64 = 100;
    const UNLOCK_LEGENDARY: u64 = 500;

    /// Thrown when a wallet has already minted this tier.
    const EAlreadyMinted: u64 = 0;
    /// Thrown when the sender's recorded leaderboard score is below the
    /// tier's unlock threshold.
    const EScoreTooLow: u64 = 1;

    public struct YetiNFT has key, store {
        id: UID,
        name: String,
        tier: u8,
    }

    public fun tier(nft: &YetiNFT): u8 {
        nft.tier
    }

    public fun name(nft: &YetiNFT): String {
        nft.name
    }

    /// Shared object tracking which tiers each wallet has minted, as a
    /// per-tier bitmask, so a wallet can never mint the same tier twice.
    public struct MintRegistry has key {
        id: UID,
        minted: Table<address, u8>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(MintRegistry {
            id: object::new(ctx),
            minted: table::new(ctx),
        });
    }

    fun mark_minted(registry: &mut MintRegistry, player: address, tier: u8) {
        let bit = 1u8 << tier;
        if (table::contains(&registry.minted, player)) {
            let mask = table::borrow_mut(&mut registry.minted, player);
            assert!(*mask & bit == 0, EAlreadyMinted);
            *mask = *mask | bit;
        } else {
            table::add(&mut registry.minted, player, bit);
        };
    }

    /// Frostie (COMMON) is unlocked from the start — no score check.
    /// `ctx`'s sender may be a session/burner key; `delegate::owner_of`
    /// resolves the real player, who is the one credited with the mint
    /// and who actually receives the NFT.
    public entry fun mint_frostie(
        registry: &mut MintRegistry,
        delegates: &DelegateRegistry,
        ctx: &mut TxContext,
    ) {
        let player = delegate::owner_of(delegates, tx_context::sender(ctx));
        mark_minted(registry, player, TIER_COMMON);
        transfer::transfer(
            YetiNFT { id: object::new(ctx), name: string::utf8(b"Frostie"), tier: TIER_COMMON },
            player,
        );
    }

    /// Blizzard (RARE) requires a recorded leaderboard score >= 100.
    public entry fun mint_blizzard(
        registry: &mut MintRegistry,
        board: &Leaderboard,
        delegates: &DelegateRegistry,
        ctx: &mut TxContext,
    ) {
        let player = delegate::owner_of(delegates, tx_context::sender(ctx));
        assert!(leaderboard::highest_score(board, player) >= UNLOCK_RARE, EScoreTooLow);
        mark_minted(registry, player, TIER_RARE);
        transfer::transfer(
            YetiNFT { id: object::new(ctx), name: string::utf8(b"Blizzard"), tier: TIER_RARE },
            player,
        );
    }

    /// Glacier (LEGENDARY) requires a recorded leaderboard score >= 500.
    public entry fun mint_glacier(
        registry: &mut MintRegistry,
        board: &Leaderboard,
        delegates: &DelegateRegistry,
        ctx: &mut TxContext,
    ) {
        let player = delegate::owner_of(delegates, tx_context::sender(ctx));
        assert!(leaderboard::highest_score(board, player) >= UNLOCK_LEGENDARY, EScoreTooLow);
        mark_minted(registry, player, TIER_LEGENDARY);
        transfer::transfer(
            YetiNFT { id: object::new(ctx), name: string::utf8(b"Glacier"), tier: TIER_LEGENDARY },
            player,
        );
    }
}
