# Screenshots

Captured with `npm run docs:screenshots` (headless Edge/Chrome against the running dev server).

| File | What it shows |
|---|---|
| 01-detection-deadlock.png | Detection mode, step 5: DFS found the cycle T1 → T2 → T1 (red edges), lock table with wait queues |
| 02-detection-dark.png | Dark theme, three-transaction ring deadlock |
| 03-detection-victim.png | Victim selection and rollback (red diamond), waiter wakes up |
| 04-prevention-wait-die.png | Wait-die: younger T2 dies |
| 05-prevention-wound-wait.png | Wound-wait: older T1 wounds T2 |
| 06-bankers-safe.png | Banker's safety algorithm mid-trace: Work/Finish, Need matrix, safe sequence chips |
| 07-bankers-denied.png | Resource-request algorithm denying an unsafe request |
| 08-game-level.png | Game board — level "Three-way ring" |
| 09-history-analytics.png | History with analytics dashboard and saved runs |
| 10-theory.png | Theory page |
| 11-innovation.png | Innovation tab — what makes the project different, comparison table |
| 12-developed-by.png | Developed By tab — team photos, register numbers and guide |
