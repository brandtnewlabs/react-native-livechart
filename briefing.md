# Phantom 5-minute Up/Down market showcase

## Outcome

Build a new full-screen example-app showcase that recreates the Phantom 5-minute SOL Up/Down market shown in `ScreenRecording_08-08-2026 16-38-29_1.mov`, while using the example app's Plus Jakarta Sans font and synthetic price data.

This is a visual/interaction demo, not a wallet integration or a trade execution flow. The chart, five-minute round clock, target price, timeframe loading states, and live price behavior are real within the simulation; lower-page market/chat content may be static.

Suggested route: `app/showcase/phantom-up-down.tsx`

Suggested Examples card:

- Title: `Phantom · Up/Down`
- Tagline: `5-minute SOL market — round target, live threshold + timeframe morphs`
- Accent: `#4EF95D`
- Route: `/showcase/phantom-up-down`

## Hard requirements

1. The market runs in epoch-aligned five-minute rounds and remains time-correct after the app is backgrounded and resumed.
2. The area above the chart closely reproduces the recording's Phantom layout, colors, scale, and spacing, but all app/chart text uses Plus Jakarta Sans.
3. The five timeframe controls use the recording's fixed geometry: every slot is `61 × 24` points, with a `4`-point inter-slot gap. They must not size to their text.
4. `Live` displays a 30-second chart window. Other windows are `15M`, `1H`, `1D`, and `1W`.
5. On a timeframe press, the selected pill changes immediately, the existing plotted series remains mounted at `0.5` opacity for exactly `1,000 ms`, and the replacement range then enters smoothly. Axes and the round reference line remain at full opacity.
6. The reference price is the SOL price at the start of the current five-minute round. It remains the same while switching timeframes and changes only at a round boundary.
7. The entire plotted line is green while the current price is at/above the reference and red while the current price is below it.
8. The reference price pill is a fixed `60 × 24` points, sits `8` points left of the shared Y-axis value column, and is centered vertically on the dotted reference line. The dotted line must terminate at the pill's left edge; it must not be drawn underneath or through the pill.
9. The five-minute starting price does not force the market Y-range to expand. When it falls outside the visible range, pin the pill and dotted reference line inside the nearest plot edge and add an outward caret that points toward the off-axis starting price. The line remains connected to the pill instead of disappearing.
9. The plotted market series must stop before the reserved Y-axis column; it must never draw underneath the price labels.

## Recording review

The source is a 26.4-second portrait recording at 884 × 1920 and approximately 60 fps. Extracted frames show one persistent screen while the user cycles through chart ranges.

| Approx. time    | State         | Behavior to reproduce                                                                                             |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `0.0–7.4s`      | Live          | `Live` selected; short angular line, glowing endpoint, five-minute target line, timer counts down continuously.   |
| `~7.5s`         | Live → 15M    | `15M` becomes selected immediately; outgoing Live line dims while it is retained.                                 |
| `~8.0s`         | 15M ready     | A denser 15-minute history replaces the Live shape and settles without an empty-chart flash.                      |
| `~11.2s`        | 15M → 1H      | Same retain/dim/load/replace pattern.                                                                             |
| `~12.2s`        | 1H ready      | One-hour range is fully visible.                                                                                  |
| `~13.5s`        | 1H → 1D       | Selected pill moves first; chart stays visible at reduced opacity.                                                |
| `~14.5s`        | 1D ready      | One-day range replaces the old data.                                                                              |
| `~15.8s`        | 1D → 1W       | Same loading transition.                                                                                          |
| `~16.8s`        | 1W ready      | One-week range is fully visible.                                                                                  |
| `~18.3s`        | 1W → Live     | `Live` selects immediately; one-week data dims during the handoff.                                                |
| `~19.3s onward` | Live restored | A fresh 30-second range enters and resumes streaming. Price, percent, line endpoint, and timer continue updating. |

The countdown moves from about `01:29` to `01:05` across the recording and never resets on a timeframe change. The target stays `$75.950` while the current price changes around `$76.050`; `$0.100 / $75.950` gives the displayed `+0.13% above target`.

## Measured design geometry

The recording resolves to approximately 441 logical points wide at 2× scale. Use point values rather than raw recording pixels.

### Horizontal system

- Screen content inset: `20` points on both sides.
- Timeframe-row status chip: `69 × 24`.
- Gap after the status chip: `12`.
- Timeframe group: five fixed `61 × 24` slots with `4`-point gaps.
- Total row width: `69 + 12 + (5 × 61) + (4 × 4) = 402`, which exactly fills a 442-point screen inside 20-point margins.
- Timer pill: approximately `73 × 24`.
- Reference pill: `60 × 24`, about `24` points from the physical right edge.
- Header action buttons: `40 × 40` circles.
- Logo tile: `40 × 40`.

Do not replace the fixed timeframe widths with `flex: 1`; on wider/narrower devices, keep the slot geometry and center or safely clip the entire row. The capture-width device is the visual acceptance target.

### Vertical order

From the safe area downward:

1. Centered grabber: approximately `35 × 5`.
2. Header row: Phantom/Solana-style mark on the left; favorite and share actions on the right.
3. Eyebrow: `Up or Down`.
4. Market selector: `SOL 5min` with a small down chevron.
5. Current price: three decimal places, for example `$76.050`.
6. Outcome delta: `+0.13% above target` or `−0.08% below target`.
7. Timer pill: hourglass plus `MM:SS`.
8. Chart and right-side Y-axis labels.
9. Status chip and timeframe row.
10. Static lower content: Live Chat, market details, and region availability card.

The chart area in the reference is roughly `280` points tall. Fine-tune its top/bottom insets against a device screenshot rather than shrinking the fixed pills.

### Typography

Use the fonts already loaded in `app/_layout.tsx`:

- `PlusJakartaSans_400Regular`
- `PlusJakartaSans_500Medium`
- `PlusJakartaSans_600SemiBold`
- `PlusJakartaSans_700Bold`

Suggested starting sizes:

| Element                  | Size / weight                   |
| ------------------------ | ------------------------------- |
| Eyebrow                  | `13`, Medium                    |
| Market name              | `23`, SemiBold                  |
| Current price            | `30`, SemiBold, tabular numbers |
| Outcome delta            | `13`, Medium, tabular numbers   |
| Timer                    | `13`, Medium, tabular numbers   |
| Y-axis / reference value | `11`, Medium, tabular numbers   |
| Timeframe labels         | `11`, Medium                    |
| Lower-section headings   | `16`, SemiBold                  |

Pass `PlusJakartaSans_500Medium` as the chart font `typeface` as well as using the registered family for React Native text. This keeps the Skia Y-axis/reference typography consistent with the rest of the screen.

### Color tokens

Values sampled or inferred from the recording:

```ts
const C = {
  background: "#000000",
  surface: "#171717",
  surfaceStrong: "#222222",
  text: "#F5F5F5",
  muted: "#A3A3A3",
  faint: "#747474",
  green: "#4EF95D",
  red: "#FF5C5C",
  reference: "#8A8A8A",
  referencePill: "#EDEDED",
  referencePillText: "#242424",
} as const;
```

The green is sampled from the solid chart stroke. The red is its inferred negative-state companion and should be visually checked on-device because the recording never enters a below-target state.

## Screen behavior

### Five-minute round clock

Five-minute rounds align to wall-clock boundaries, matching the recording (for example, a 16:35–16:40 round):

```ts
const ROUND_MS = 5 * 60 * 1000;
const roundId = Math.floor(Date.now() / ROUND_MS);
const roundStartMs = roundId * ROUND_MS;
const roundEndMs = roundStartMs + ROUND_MS;
```

The clock must be deadline-based, not decrement-based. Never store “299 and subtract one every second”; that drifts and becomes wrong when iOS/Android suspends the process.

Implementation shape:

- Keep `roundId`, `roundStartMs`, and `roundEndMs` as the source of truth.
- Isolate the visible countdown in a small `RoundCountdown` component so its one-Hz text update does not re-render the chart screen.
- Use a self-correcting timeout scheduled to the next whole-second boundary.
- Format `Math.ceil((roundEndMs - nowMs) / 1000)` as `MM:SS`.
- Listen to `AppState`; on every transition to `active`, recompute the round from `Date.now()` immediately.
- If the app resumes one or several rounds later, jump directly to the current epoch-aligned round—do not replay missed ticks.
- The OS may suspend JavaScript/UI work in the background. “Runs in the background” therefore means the deadline continues in wall-clock time and is correct on resume; it does not require an iOS background execution entitlement.
- A timeframe request never owns or resets the clock.

At a new `roundId`, calculate the new target from the simulated price function at the exact `roundStartMs`, then update both the outcome-comparison SharedValue and the reference-line React state once. This avoids bridge traffic during the round.

### Coherent simulated SOL data

Create a focused `usePhantomMarketSimulation` hook under `sim/`. Follow the performance pattern used by `useSimulatedChartData` and `app/demo/threshold.tsx`:

- One deterministic, continuous `priceAt(unixSeconds)` function is the source of truth for every range.
- Compose seeded, quintic-smoothed value-noise bands across sub-second, intraday, and multi-day scales around a `$76` center. Modulate the shorter bands with a slow volatility regime and add sparse directional impulses with gradual mean reversion. Avoid repeating sine waves: the path should show irregular momentum, clustered volatility, unequal reversals, and small microstructure movement while remaining continuous and time-addressable.
- Update the scalar `value` SharedValue at roughly 30 Hz for a smooth endpoint.
- Commit a new Live chart point at roughly 10 Hz using `displayData.modify(...)`; return a copied, capped short buffer so an in-flight morph can safely retain its source array and the history never grows without bound.
- Build historical replacements only when requested. Every range derives from the same `priceAt` function and ends at the exact same current value.
- Anti-alias historical ranges according to their display bucket. Keep Live, 15M, and 1H raw; use a causal triangular aggregate across two display buckets for 1D and 48 display buckets (12 hours) for 1W. Use at least nine source samples per aggregate and, for wider windows, sample every display bucket so short-lived movement cannot alias between sparse filter taps. Reconcile the final 12 buckets smoothly to the exact raw current value so range switching never moves the endpoint. This suppresses intraday source movement that would otherwise make the weekly line falsely noisy.

Suggested sample densities:

| Timeframe |     Window | Sampling target | Approx. points |
| --------- | ---------: | --------------: | -------------: |
| Live      |      `30s` |          `0.1s` |          `300` |
| 15M       |     `900s` |            `2s` |          `450` |
| 1H        |   `3,600s` |           `10s` |          `360` |
| 1D        |  `86,400s` |          `120s` |          `720` |
| 1W        | `604,800s` |          `900s` |          `672` |

Keep one stable `displayData: SharedValue<LiveChartPoint[]>` and one stable `value: SharedValue<number>` for the lifetime of the screen. Do not mount one chart per timeframe and do not run five independent random walks; independent feeds would make the endpoint and target jump on selection.

### Timeframe state machine

Maintain separate selected and committed values:

- `selectedTimeframe`: drives the white pill and changes on touch-down/press.
- `committedTimeframe`: drives the `LiveChart.timeWindow` and changes only when replacement data is ready.
- `requestVersion`: monotonically increasing token used to discard stale one-second loads.
- `seriesOpacity`: `SharedValue<number>` passed to `LiveChart`.
- `dataSnapVersion`: increments only after the new `displayData` has been written.

Transition sequence:

1. Ignore a press on the already selected/committed timeframe.
2. Increment `requestVersion` and set `selectedTimeframe` immediately.
3. Set `seriesOpacity` to `0.5`; keep old `displayData`, axes, reference line, and chart instance mounted.
4. Start a deterministic `1,000 ms` timeout.
5. At timeout completion, abort if its request version is stale.
6. Generate the selected range ending at the current wall-clock time.
7. Normalize the old and replacement shapes to the larger point count, sampling each by its `0...1` progress. Put both shapes on the replacement timestamps and pin their final values to the same live endpoint.
8. Update `committedTimeframe`/`timeWindow`. On the following frame, write the normalized old shape and increment `dataSnapVersion` once so the new X range and framing settle around that still-familiar shape.
9. On the next frame, interpolate every point value from the normalized old shape to the replacement shape over `500 ms` with smoothstep easing. Write the exact replacement at completion.
10. Restore `seriesOpacity` with `withTiming(1, { duration: 200 })` as the geometry morph starts.
11. If the committed range is Live, resume appending 10 Hz Live points after the morph; historical ranges can remain static until another selection.

Morfi's existing mobile market-chart ordering is the transition baseline: retain old data, dim only plotted content to `0.5`, reuse the stable SharedValue, snap framing after the range handoff, then fade back to one. The Phantom demo adds the explicit normalized geometry interpolation required here; Morfi's snap/fade sequence alone is not a dataset morph. Keeping a single chart instance and stable SharedValues avoids a blank frame while the point values visibly travel into the new range shape.

Rapid taps restart the full one-second delay for the latest selection. A stale `15M` timeout must never overwrite a newer `1D` request.

### Target comparison and chart color

Use one `roundStartPrice: SharedValue<number>` as the source of truth. Derive only the binary outcome on the UI thread and cross to React state when that outcome changes—not on every price tick:

```tsx
useAnimatedReaction(
  () => value.get() >= roundStartPrice.get(),
  (isUp, wasUp) => {
    if (isUp !== wasUp) runOnJS(setOutcomeSide)(isUp ? "up" : "down");
  },
);
```

Pass the resulting `outcomeColor` to both `accentColor` and `line.color`. This changes the entire plotted line, endpoint, and its static glow together when the latest price crosses the target. Do not use the segment-splitting `threshold` prop here; mixed red/green history would not match the requested whole-line Up/Down state.

The header readout compares `value` with the same target:

- Above: `+0.13% above target` in green.
- Below: `−0.08% below target` in red.
- Equal after display rounding: `0.00% at target` in muted text.

Keep price formatting at exactly three fractional digits everywhere: header, Y-axis, and target pill.

### Reference line and price pill

Use one custom `renderOverlay` for both the once-per-round target pill and its
dashed connector, positioned with `usePriceY`. Do not also create a built-in
`referenceLines` entry: its off-axis clamp would compete with the inset pill and
make the connector appear to jump to the pill's top edge.

Key geometry:

- Let the normal Y-axis layout measure its labels and reserve the required plot gutter. Do not provide a manual right inset and do not set `float: true`; floating mode deliberately runs plotted data underneath its labels.
- `renderOverlay` returns an opaque `60 × 24` RN pill with `borderRadius: 12`. `usePriceY(context, roundStartPriceNumber)` keeps it vertically centered on the target while the axis rescales.
- Recreate the five live formatted tick strings from the overlay scale, measure them with the same Skia font used by the Y-axis, and take their maximum width. Resolve the axis column at `canvasWidth - labelRightMargin - widestTickWidth`, then place the pill `8` points left of it even when proportional digits change the individual string widths.
- Render the `[4, 4]` dashed connector in the same overlay as the pill. Derive a shared `connectorY` from `pillY + pillHeight / 2`, draw from the plot's left edge to the pill's left edge, and use it in every in-range and off-axis state. The line therefore stays vertically centered on the pill, never hands off between renderers, and is never painted beneath or through it.
- Do not put a larger wrapper or blanket mask behind the pill. When an ordinary Y-axis tick collides vertically with the target, measure that tick's font line box and cover only its text rectangle with the chart background before drawing the pill. The pill itself remains exactly `60 × 24`, with no visible border or dark halo, and no mask extends into the plot. Add only a low-opacity, zero-offset soft glow around the pill.
- Keep the target out of `referenceLines`; the live range is therefore never expanded by a distant five-minute target, and the fixed overlay pill is the only target-price label. Classify the target against the live `scale.min` / `scale.max`: an above-range target pins the pill and its centered connector `6` points below the top plot edge with an upward caret, while a below-range target pins them `6` points above the bottom edge with a downward caret.
- Base the off-axis caret on Morfi mobile's market-share-goal treatment, but soften its loop for this smaller price pill: its closed position overlaps the pill edge by `1` point, then it bobs outward by `1.5` points with a reversing `700 ms` half-period and sine ease-in-out. The zero-velocity endpoints prevent a visible snap at either reversal. Animate only the caret, not the pill or line, and keep the caret static when reduced motion is enabled.
- Use `yAxis={{ count: 5, labelRightMargin: 29, gridEndGap: 8 }}` and a transparent grid. With the current 11-point Plus Jakarta Sans price format and the explicit pill offset, that keeps the 60-point reference pill about 24 points from the physical right edge. The automatically reserved gutter keeps the plotted market series out from underneath every Y-axis label.
- Do not use the auto-width built-in pill for the final design; its width changes with font metrics and cannot guarantee the recording's 60-point column.
- Reference line and pill remain at opacity `1` during a timeframe load because `seriesOpacity` affects plotted data only.
- The pill glow is a local React Native shadow, not a chart-library API. Keep its zero-offset `color`, `blur: 8`, and `opacity: 0.2` together in the screen's `REFERENCE_PILL_GLOW` constant.

### Chart configuration

Starting configuration:

```tsx
<LiveChart
  data={displayData}
  value={value}
  seriesOpacity={seriesOpacity}
  timeWindow={TIMEFRAME_SECONDS[committedTimeframe]}
  snapKey={dataSnapVersion}
  theme="dark"
  accentColor={outcomeColor}
  palette={{ bgRgb: [0, 0, 0], gridLabel: C.muted }}
  style={styles.transparentChart}
  canvasMode="opaque"
  font={PHANTOM_CHART_FONT}
  line={{
    color: outcomeColor,
    width: 2.5,
    curve: "linear",
    join: "round",
    cap: "round",
  }}
  gradient={false}
  dot={{
    radius: 4,
    color: outcomeColor,
    ring: { color: C.background, width: 2 },
    glow: { radius: 9, blur: 5, opacity: 0.28 },
  }}
  pulse={false}
  badge={false}
  valueLine={false}
  renderOverlay={renderTargetOverlay}
  yAxis={{ count: 5, labelRightMargin: 16 }}
  gridStyle={{ color: "transparent", opacity: 0 }}
  xAxis={false}
  scrub={false}
  momentum={false}
  degen={false}
  leftEdgeFade={false}
  insets={{ left: 4, top: 18, bottom: 18 }}
/>
```

The endpoint glow is static and deliberately opt-in. The library's `DotConfig.glow`
controls its source radius, blur, opacity, and optional color independently from
the animated `pulse`; Phantom disables `pulse` entirely.

Validate `canvasMode="opaque"` on Android. If it conflicts with rounded parent clipping or screenshots, return to the default transparent canvas; the page background is already black.

## Lower-page content

The chart experience is the feature. Reproduce enough static structure below it for the screen to read as the captured market:

- `Live Chat` heading with chevron.
- One dark rounded prompt/input placeholder.
- `About this market` heading.
- Static description: `Predict whether SOL will finish above or below the round's starting price.`
- A dark availability/region card with a purple leading icon.

These elements do not need working chat, wallet, or trading behavior. They must not push the measured hero/timeframe geometry off-screen on the acceptance device; place the page in a `ScrollView` if needed, with the hero at the top.

## Accessibility and interaction

- Every timeframe is an `accessibilityRole="button"` with selected state.
- Labels: `Show live 30-second chart`, `Show 15-minute chart`, and so on.
- Expose the timer as `Round ends in 1 minute 29 seconds`; avoid announcing every one-second update. Use a polite announcement only at the last 10 seconds or at round rollover if announcements are added.
- The visual pill is 61 × 24, but wrap it in or add hit slop to reach at least a 44 × 44 touch target without changing visible geometry.
- Favorite/share buttons have labels even if their demo actions are no-ops.
- Respect safe-area top/bottom insets.

## Files expected in the implementation

- `app/showcase/phantom-up-down.tsx` — screen and exact visual composition.
- `sim/usePhantomMarketSimulation.ts` — coherent multi-range price source and stable SharedValues.
- `sim/phantomRound.ts` — pure five-minute boundary/countdown math.
- `sim/phantomRound.test.ts` — timer and round-boundary unit tests.
- `sim/usePhantomMarketSimulation.test.tsx` — range handoff, stale request, and buffer behavior.
- `demo-lib/examples.ts` — register the ready showcase card.
- `docs/showcase/index.mdx` — add the showcase card after the screen is implemented.

No public library API change is expected. The existing automatic Y-axis gutter and normal reference-line endpoint plus the `renderOverlay`/`usePriceY` bridge provide the required composition. If implementation still requires a new public prop, update source JSDoc, `docs/api-reference/`, the relevant guide, and `CHANGELOG.md` in the same change.

## Validation plan

### Automated

- Round math aligns any timestamp to the correct five-minute start/end.
- Countdown uses the absolute deadline and cannot drift negative.
- Resuming after less than one round preserves the target; resuming after one or several boundaries selects the current round and target.
- Selecting a timeframe immediately changes the selected pill but retains old chart data for `999 ms`.
- At `1,000 ms`, replacement data is written, committed timeframe changes, snap version increments, and opacity animates toward one.
- A rapid second selection invalidates the first request.
- Live produces approximately 30 seconds of visible history and resumes appending after returning from a historical range.
- All generated ranges end at the same current price within formatting tolerance.
- Above/below percent copy and three-decimal price formatting are correct.
- Run `npm run verify` before handoff.

### Visual/device

- Compare on a 441/442-point-wide iPhone target against frames near `0s`, `7.5s`, `8.5s`, `11.3s`, `12.3s`, `18.5s`, and `19.5s`.
- Verify each timeframe slot is 61 × 24 with 4-point gaps and no width shift as selection moves.
- Render the Live status dot as a separate centered `4 × 4` circle beside the `LIVE` label, not as a bullet glyph whose baseline shifts with the font.
- Verify the timer/reference pills are 24 points high.
- Verify the reference pill begins exactly `8` points left of the Y-axis number column.
- Zoom the reference row: no dotted pixel may appear inside or to the right of the opaque pill, and there should be no visible gap before the pill.
- Drive the target above and below the visible scale: the pill and dotted line remain connected at the pill's vertical center at the corresponding plot edge, and the caret points and subtly bobs outward. No dotted pixel may enter the pill. When the target returns in range, the caret disappears and the same overlay connector follows the true target Y without a handoff or duplicate line.
- Confirm the market line and its endpoint stop before the Y-axis label column and never render underneath the price text.
- Confirm timer continuity while repeatedly switching timeframes.
- Let price cross the target in both directions and confirm path/header copy switch green/red.
- Background the app across a round boundary, return, and confirm the timer, round target, current value, and displayed outcome reconcile immediately.
- Profile a release build on iOS and Android: no chart remounts, no growing array reassignment on live ticks, no sustained JS-frame drops during timeframe loads, and stable memory over several rounds.

## Acceptance criteria

The screen is ready when:

- It is reachable from the Examples tab and can navigate back.
- Its hero reads as the Phantom Up/Down screen from the recording while consistently using Plus Jakarta Sans.
- The live round timer is wall-clock accurate through background/resume and independent of chart range selection.
- Live is exactly a 30-second window.
- All five timeframe slots retain the measured fixed geometry.
- Every range change visibly holds the old line at 0.5 opacity for one second, then completes without blank frames, remount flashes, or stale request races.
- The reference is the current five-minute round's opening price and stays stable for that round.
- Red/green rendering and header language always agree with the reference comparison.
- The reference pill is fixed over the Y-axis column and the visible dotted line terminates precisely at its left edge.
- The plotted series terminates at the Y-axis gutter instead of running underneath the labels.
- `npm run verify` passes.

## Repository note

This checkout does not contain a `react-native-livechart/mobile` directory. The matching retain/dim/write/snap/fade implementation is in the sibling mobile app at `/Users/brandtnewww/Projects/morfi/mobile/src/screens/market-detail/components/market-chart-card.tsx`. The plan above adopts that ordering while keeping all implementation work in this repository's existing checkout.
