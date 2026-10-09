# Compact Y-axis tick formatting QA

Issue #397, verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, with the installed Debug app and this branch's JavaScript.

Used recorded data over 7,668,000–7,672,000, three fixed ticks, and a worklet
compact-millions formatter. Temporarily read the actual painted Y-axis entry
shared value; removed that inspection code before committing.

| Native mode | Painted labels |
| --- | --- |
| Formatter with two decimals only | $7.67M / $7.67M / $7.67M |
| Tick-aware formatter, fixed count | $7.672M / $7.67M / $7.668M |
| Tick-aware formatter, dynamic grid | $7.668M / $7.669M / $7.67M / $7.671M / $7.672M |

The video switches precision and then grid mode. The data and fitted range stay
unchanged. Local JSON entries, the fixture and source video are preserved in
`~/Downloads/livechart-seven-issues/`.

Tests exercise the independently expected three million labels, scaled dynamic
intervals in source units, and omitted second arguments for layout samples.
Full verification, declaration build and React Doctor passed. Profiling was
unnecessary for forwarding a formatter argument.
