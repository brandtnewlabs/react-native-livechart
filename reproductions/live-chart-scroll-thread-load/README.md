# LiveChart scroll-thread load reproduction

Reproduces [issue #304](https://github.com/brandtnewlabs/react-native-livechart/issues/304):
a live chart in a vertically scrolling list with a sticky header, timer-driven
SharedValue updates, pulse, pan/zoom, and a draggable reference line.

The chart displays engine publications and skipped frames per second. With the
scroll gate off, this isolates idle frame publication. Turn the gate on to show
the host-side mitigation: continuous chart frame work pauses only while the list
is being dragged or coasting, while chart gestures remain mounted.

## Run

```bash
npm install
npm run ios
```

Use a Release build and a physical 120 Hz iPhone for the representative trace.
The committed profiling matrix records the deterministic 120 Hz engine baseline;
an Instruments trace should confirm the end-to-end Skia/UI-thread result.
