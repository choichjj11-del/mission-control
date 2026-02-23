# Mission Control — iOS App Roadmap

## Tech Decision: Capacitor (not React Native)

| Factor | Capacitor | React Native |
|--------|-----------|--------------|
| Existing codebase | Wraps current HTML/JS as-is | Requires full UI rewrite |
| Development time | Days | Weeks |
| Widget/Lock Screen | Swift Extension (same either way) | Swift Extension (same either way) |
| PWA compatibility | Full — shares same codebase | Separate codebase |

The frontend is vanilla HTML/JS with no framework. Capacitor wraps the existing web app in a native WebView, giving us native APIs (push, haptics, etc.) with zero UI rewrite. Widgets and Lock Screen features require Swift regardless of approach.

---

## Phase 1 — Capacitor Wrapper + APNs Push (1-2 days)

**Goal:** App runs on iPhone with real iOS push notifications.

### Steps
1. `npx cap init "Mission Control" "ai.lucyhome.missioncontrol"` in project root
2. Create `capacitor.config.ts`:
   - `server.url: 'https://dashboard.lucyhome.ai'` (remote loading)
   - Or bundle local files for offline support
3. `npm install @capacitor/push-notifications @capacitor/haptics`
4. In `chat-preview.html`, detect `window.Capacitor` to branch:
   - Web: existing Web Push (service worker + VAPID)
   - Native: `@capacitor/push-notifications` for APNs token
5. Server: add `/api/push/register-native` endpoint to store APNs device tokens
6. Server: use Firebase Admin SDK (FCM) to send push via APNs
   - Parallel to existing `web-push` in `cron.js`
7. Build in Xcode → test on iPhone

### Prerequisites
- macOS with Xcode (latest)
- Apple Developer Account ($99/year)
- Firebase project with APNs key configured

### Files to Create/Modify
- `capacitor.config.ts` (new)
- `chat-preview.html` — native push branch
- `server/routes/push.js` — `/register-native` endpoint
- `server/lib/fcm.js` (new) — FCM send logic
- `server/lib/cron.js` — add FCM alongside web-push

---

## Phase 2 — Home Screen Widget (2-3 days)

**Goal:** iOS home screen widgets showing progress, tasks, and goals.

### Architecture
```
[Capacitor JS] → WidgetBridge plugin → UserDefaults (App Group)
                                              ↓
[WidgetKit Swift] ← reads UserDefaults ← App Group
```

### Steps
1. Create Widget Extension in Xcode (WidgetKit)
2. Configure App Group: `group.ai.lucyhome.missioncontrol`
3. Create Capacitor custom plugin `WidgetBridge`:
   - JS calls `WidgetBridge.updateData({...})`
   - Swift side writes to `UserDefaults(suiteName: "group.ai.lucyhome.missioncontrol")`
4. Implement widget SwiftUI views:

#### Widget Sizes
- **Small (accessoryCircular):** Circular progress ring showing completion %
- **Medium:** Today's task list (top 4-5 items) + goal summary
- **Large:** Full dashboard — progress ring, category breakdown, top tasks

### Data Schema (UserDefaults)
```json
{
  "percent": 18,
  "done": 7,
  "total": 38,
  "urgent": 9,
  "topTasks": ["트렌딩 뮤직 리서치", "갓텐홈 개선", "..."],
  "goalTitle": "월 수익 1,000만원",
  "goalPercent": 5,
  "updatedAt": "2026-02-23T12:00:00Z"
}
```

---

## Phase 3 — Lock Screen + Live Activities (2-3 days)

**Goal:** Progress visible on lock screen throughout the day.

### Lock Screen Widgets
1. Add `.accessoryCircular` family — progress ring
2. Add `.accessoryRectangular` family — "MC: 18% | 7/38 done"

### Live Activities (ActivityKit)
1. Define `MissionControlAttributes` and `ContentState`
2. Capacitor plugin `LiveActivity`:
   - `start()` — morning cron triggers via push
   - `update(state)` — on each task completion
   - `end()` — evening cron
3. Lock screen display: "MC: 18% | 월 수익 1,000만원"
4. Dynamic Island (compact): progress % | (expanded): task list + goal

### Cron Integration
- Morning (8 AM): `LiveActivity.start()` via silent push
- Task completion: `LiveActivity.update()` via push
- Evening (11 PM): `LiveActivity.end()` via silent push

---

## Future Plans

### Short-term
- [ ] TestFlight beta distribution
- [ ] Haptic feedback on task completion
- [ ] Siri Shortcuts integration ("Hey Siri, brain dump")

### Mid-term
- [ ] App Store submission
- [ ] Apple Watch companion app (complication showing %)
- [ ] Offline mode with local data sync

### Long-term
- [ ] Android version (Capacitor makes this straightforward)
- [ ] iPad layout optimization
- [ ] Focus mode integration
