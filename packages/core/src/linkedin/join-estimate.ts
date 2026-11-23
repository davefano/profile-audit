// Member IDs are assigned roughly in order, so a member ID implies an
// approximate join date. Calibration points are (memberId, "Joined LinkedIn")
// pairs read from the About-this-member dialog. More points = better estimates.

const DAY = 86_400_000;

/** Earliest possible join: LinkedIn launched May 2003. */
const LAUNCH = Date.UTC(2003, 4, 5);

/** Sorted by memberId. Join dates are mid-month since the dialog gives month precision. */
export const MEMBER_ID_CALIBRATION: ReadonlyArray<readonly [memberId: number, joinedAt: number]> = [
  [1, LAUNCH],
  [8_800_000, Date.UTC(2006, 11, 15)],
  [251_749_025, Date.UTC(2013, 4, 15)],
  [810_000_000, Date.UTC(2020, 3, 15)],
  [1_810_000_000, Date.UTC(2026, 6, 15)],
];

/** Estimate a join date (ms) by interpolating between calibration points. */
export function estimateJoinedAt(memberId: number, now = Date.now()): number | null {
  const pts = MEMBER_ID_CALIBRATION;
  if (!Number.isFinite(memberId) || memberId <= 0 || pts.length < 2) return null;
  let i = pts.findIndex(([id]) => id >= memberId);
  if (i <= 0) i = i === 0 ? 1 : pts.length - 1; // extrapolate from the nearest segment
  const [id0, t0] = pts[i - 1]!;
  const [id1, t1] = pts[i]!;
  const t = t0 + ((memberId - id0) * (t1 - t0)) / (id1 - id0);
  return Math.round(Math.min(Math.max(t, LAUNCH), now - DAY));
}
