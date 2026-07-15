# Reanimated/Worklets Hermes module-retention reproduction

This standalone Expo app isolates a native iOS Release/Hermes memory increase
from mounting Reanimated worklets. It does not import LiveChart or Skia.

The app follows a fixed timeline so the three phases are visible in Instruments:

| Time | Phase | Worklets |
| --- | --- | ---: |
| 0–15s | baseline | 0 |
| 15–45s | mounted | 128 `useDerivedValue` hooks |
| 45s onward | unmounted | 0 |

Each hook has a separate call site (and therefore a distinct worklet hash) and
reads a shared value that is updated from the JS thread. The hook-owning React
component is removed at 45 seconds.

## Run on a physical iPhone

From this directory:

```sh
npm install
npx expo run:ios --device --configuration Release --no-bundler
```

Choose the connected iPhone, then record the installed app with Instruments'
Activity Monitor or Allocations template for at least 60 seconds. Do not attach
Metro: the reproduction is intended to exercise a production bundle and Hermes.

For a command-line Activity Monitor capture, first obtain the device identifier
from `xcrun xctrace list devices`, then run:

```sh
xcrun xctrace record \
  --template 'Activity Monitor' \
  --device DEVICE_UDID \
  --time-limit 60s \
  --output /tmp/worklets-retention.trace \
  --launch com.brandtnewlabs.worklets-hermes-retention
```

Expected signal: resident memory rises when the 128 hooks mount and
does not return near the baseline after they unmount. In Allocations, the retained
heap is dominated by Hermes source compilation reached through
`evalInEnvironment` and `createBCProviderFromSrc`; repeated 256 KiB allocator
regions make the effect easy to see.

The Mount and Unmount buttons allow repeating the transition manually after the
automatic sequence.

## Observed result

On an iPhone 17 Pro Max running iOS 26.6, with the dependency versions pinned
in this reproduction, a 65-second Activity Monitor capture reported:

| Phase | Mean physical footprint |
| --- | ---: |
| baseline (5–15s) | 90.41 MiB |
| mounted (20–44s) | 171.06 MiB |
| unmounted (50–64s) | 172.69 MiB |

The post-unmount footprint remained about 82 MiB above baseline. A separate
Allocations capture showed 521 persistent 256 KiB malloc regions (130.25 MiB).
The heaviest retained stack was:

```text
evalInEnvironment
  → hermes::hbc::createBCProviderFromSrc
  → hermes::Context::Context
  → hermes::BacktrackingBumpPtrAllocator
```

The allocator accounted for about 125 MiB of the persistent call tree after the
hook-owning component had unmounted.
