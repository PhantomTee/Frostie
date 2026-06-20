module frostie::marketplace {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use frostie::yeti_nft::{Self, YetiNFT};

    /// 5% royalty on every sale, paid to the marketplace treasury.
    const ROYALTY_BPS: u64 = 500;
    const BPS_DENOM: u64 = 10000;

    /// Thrown when someone other than the seller tries to cancel a listing.
    const ENotSeller: u64 = 0;
    /// Thrown when the payment coin is smaller than the listing price.
    const EInsufficientPayment: u64 = 1;

    /// Shared per-NFT escrow. Holding the NFT here (rather than leaving it
    /// with the seller) is what lets any buyer purchase it trustlessly.
    public struct Listing has key, store {
        id: UID,
        seller: address,
        price: u64,
        nft: YetiNFT,
    }

    /// Shared registry holding only the royalty destination -- listings are
    /// independent shared objects, discovered off-chain via the events below
    /// rather than tracked in an on-chain index.
    public struct Marketplace has key {
        id: UID,
        treasury: address,
    }

    public struct AdminCap has key, store {
        id: UID,
    }

    public struct Listed has copy, drop {
        listing_id: ID,
        nft_id: ID,
        seller: address,
        price: u64,
        tier: u8,
    }

    public struct Sold has copy, drop {
        listing_id: ID,
        buyer: address,
    }

    public struct Cancelled has copy, drop {
        listing_id: ID,
    }

    // Module `init` only runs at the package's original publish -- this
    // module is added in a later upgrade, so the Marketplace/AdminCap are
    // created by calling this once by hand right after the upgrade lands.
    public entry fun initialize(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        transfer::transfer(AdminCap { id: object::new(ctx) }, sender);
        transfer::share_object(Marketplace {
            id: object::new(ctx),
            treasury: sender,
        });
    }

    public entry fun set_treasury(_admin: &AdminCap, market: &mut Marketplace, new_treasury: address) {
        market.treasury = new_treasury;
    }

    /// Lists `nft` for `price` MIST, moving it into escrow until it's
    /// bought or the seller cancels.
    public entry fun list_nft(price: u64, nft: YetiNFT, ctx: &mut TxContext) {
        let seller = tx_context::sender(ctx);
        let nft_id = object::id(&nft);
        let tier = yeti_nft::tier(&nft);
        let listing = Listing { id: object::new(ctx), seller, price, nft };
        event::emit(Listed { listing_id: object::id(&listing), nft_id, seller, price, tier });
        transfer::share_object(listing);
    }

    /// Returns the escrowed NFT to the seller and tears down the listing.
    public entry fun cancel_listing(listing: Listing, ctx: &TxContext) {
        let Listing { id, seller, price: _, nft } = listing;
        assert!(seller == tx_context::sender(ctx), ENotSeller);
        let listing_id = object::uid_to_inner(&id);
        object::delete(id);
        event::emit(Cancelled { listing_id });
        transfer::public_transfer(nft, seller);
    }

    /// Buys `listing`: the royalty cut goes to the marketplace treasury,
    /// the rest to the seller, and the NFT to whoever paid.
    public entry fun buy_nft(
        market: &Marketplace,
        listing: Listing,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        let Listing { id, seller, price, nft } = listing;
        assert!(coin::value(&payment) >= price, EInsufficientPayment);
        let listing_id = object::uid_to_inner(&id);
        object::delete(id);

        let mut payment = payment;
        let royalty_amount = price * ROYALTY_BPS / BPS_DENOM;
        if (royalty_amount > 0) {
            let royalty_coin = coin::split(&mut payment, royalty_amount, ctx);
            transfer::public_transfer(royalty_coin, market.treasury);
        };
        transfer::public_transfer(payment, seller);

        let buyer = tx_context::sender(ctx);
        event::emit(Sold { listing_id, buyer });
        transfer::public_transfer(nft, buyer);
    }
}
