module frostie::delegate {
    use sui::table::{Self, Table};

    /// Shared object mapping a session/burner address to the main wallet
    /// that authorized it. Lets the client sign routine moves (score
    /// submits, mints) with a disposable key instead of popping up the
    /// main wallet every time, while on-chain effects still land on the
    /// real player.
    public struct DelegateRegistry has key {
        id: UID,
        owners: Table<address, address>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(DelegateRegistry {
            id: object::new(ctx),
            owners: table::new(ctx),
        });
    }

    /// Called by the MAIN wallet to authorize `delegate` (a session key) to
    /// act on its behalf. Safe to call repeatedly — re-registering just
    /// overwrites the mapping with the same owner.
    public entry fun register_delegate(
        registry: &mut DelegateRegistry,
        delegate: address,
        ctx: &TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        if (table::contains(&registry.owners, delegate)) {
            *table::borrow_mut(&mut registry.owners, delegate) = owner;
        } else {
            table::add(&mut registry.owners, delegate, owner);
        };
    }

    /// Resolves `addr` to the wallet it's authorized for, or `addr` itself
    /// if it isn't a registered delegate (so unregistered senders are
    /// simply treated as acting on their own behalf).
    public fun owner_of(registry: &DelegateRegistry, addr: address): address {
        if (table::contains(&registry.owners, addr)) {
            *table::borrow(&registry.owners, addr)
        } else {
            addr
        }
    }
}
