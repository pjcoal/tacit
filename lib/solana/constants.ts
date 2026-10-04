/**
 * Highest transaction version we ask RPCs to return. Mainnet carries v1
 * transactions; requesting less makes getTransaction fail for them.
 */
export const MAX_TX_VERSION = 1;
