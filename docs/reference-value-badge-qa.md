# Reference value badge QA

Validation for issue #375, on 2026-10-09.

## Automated checks

- `npm run verify -- -- --runInBand`: typecheck and lint passed; 142 suites,
  2,059 tests passed, 5 skipped. Tests ran serially to limit resource use.
- `npm run build:lib`: passed.
- `npm run verify:bundle-mode-consumer`: packed-package iOS Bundle Mode export passed.
- React Doctor: 100/100, no issues.

Regression coverage includes separate price formatting, live drag overrides,
price-column and floating placement, independent font metrics, offset tap
rectangles, right/center name-pill collisions, connector endpoints, full-width
strokes, off-axis pins, price-only pills, grouping counts, and custom-renderer
hit-target suppression. Repeated reference updates with the new axis pills
preserve the gesture constructors introduced in #387.

## Manual iOS checks

The existing iOS 26.5 simulator and development app were used for Working orders:

- Tapped SELL's price pill; the event log reported `Tapped SELL`.
- Dragged BUY's axis price pill; the committed value changed from 97.00 to 98.15.
- Dragged SELL's name pill; the committed value changed from 103.00 to 103.40.
- Enabled grouping and moved alerts above the chart; both member pills vanished
  into the count handle. Nearby reference levels joined the same group.
- Switched to a floating axis and checked price-pill alignment at the right edge.
- Hid the live badge and switched the price pills inside the plot; they remained
  visible with their connectors.

Video and screenshots are saved locally in `~/Downloads/livechart-375-qa/` for
attachment to the PR. The simulator was deleted and the development server was
stopped after these checks.

## Limits

Runtime CPU/frame/memory profiling was not completed. These checks do not establish
production-device performance. Android, physical devices, and a manual multi-series
pass were not tested. Geometry and test-only cleanup after the simulator session
were covered by the final automated checks, without launching another simulator.
