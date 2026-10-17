export const UNLIMITED = -1;
export const CYCLE_DAYS = 30;

export const PLANS = {
  FREE:   { key: 'FREE',   name: 'Free',   price: 0,    quota: 1,         rank: 0 },
  BRONZE: { key: 'BRONZE', name: 'Bronze', price: 100,  quota: 3,         rank: 1 },
  SILVER: { key: 'SILVER', name: 'Silver', price: 300,  quota: 5,         rank: 2 },
  GOLD:   { key: 'GOLD',   name: 'Gold',   price: 1000, quota: UNLIMITED, rank: 3 },
};