const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const OPEN_MIN = 5 * 60;          // 05:00
const CLOSE_MIN = 11 * 60 + 45;   // 11:45 (orders are blocked from 11:45:00)

export function isPaymentWindowOpen(now = new Date()) {
  // DEV ONLY: lets you test outside the window. Must be false in production.
  if (process.env.PAYMENT_WINDOW_BYPASS === 'true') return true;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}