# 80HD v0.0.1 Testing Checklist

**Version**: 0.0.1 - "The Observing Eye"
**Test Date**: _____________
**Tested By**: _____________

---

## Pre-Test Setup

- [ ] Delete existing database (if testing fresh start)
  ```bash
  rm ~/Library/Application\ Support/80HD/database.sqlite
  ```
- [ ] Quit any running instance of 80HD
- [ ] Open Xcode project: `80HD.xcodeproj`
- [ ] Select "80HD" scheme
- [ ] Clean build folder (Cmd+Shift+K)

---

## Build & Launch

- [ ] **Build succeeds** (Cmd+B) - no errors, warnings okay
- [ ] **App launches** (Cmd+R) - no crash
- [ ] **Menu bar icon appears** - brain icon visible in menu bar
- [ ] **Permissions requested** - macOS asks for Screen Recording permission
  - If not prompted: System Settings → Privacy & Security → Screen Recording → Enable "80HD"
- [ ] **Database created** - File exists at `~/Library/Application Support/80HD/database.sqlite`

**Expected**: Clean build, successful launch, menu bar icon visible

---

## First Run (Fresh Database)

- [ ] **Menu bar icon shows** - Brain icon in menu bar
- [ ] **Click menu icon** - Menu opens with options
- [ ] **Menu items present**:
  - Deep work duration (e.g., "Deep Focus (0h 0m)")
  - Collaboration debt indicator
  - Sacred time status
  - "Dashboard" option
  - "Settings..." option
  - "Quit 80HD" option

**Expected**: All menu items visible, no crashes

---

## Dashboard - Opening

- [ ] **Open dashboard** - Click "Dashboard" or press Cmd+D
- [ ] **Window appears** - 800×600 window titled "80HD - The Observing Eye"
- [ ] **Three tabs visible**:
  - Tab 1: "Today's Attention"
  - Tab 2: "Current Session"
  - Tab 3: "History"

**Expected**: Dashboard window opens, all tabs present

---

## Dashboard - Tab 1: Today's Attention

- [ ] **Timeline visible** - Horizontal timeline bar showing time zones
- [ ] **Sacred time zone highlighted** - Blue gradient from 9 AM to 12 PM
- [ ] **Boundary markers visible** - "🧘 9 AM" and "12 PM" markers
- [ ] **Hover over sacred zone** - Tooltip appears: "🧘 Sacred Time (9 AM - 12 PM)..."
- [ ] **Work mode segments** - After 5+ minutes, colored segments appear

**Expected**: Timeline renders, sacred time clearly marked

---

## Dashboard - Tab 2: Current Session

- [ ] **Live metrics card** - Shows session duration, current mode, sacred time status
- [ ] **Current context card** - Shows active app, git repo, branch, commits, app switches
- [ ] **Work mode signals card** - Shows struggle signals and pressure signals
- [ ] **All cards render** - No layout issues

**Wait 5 minutes, then check:**
- [ ] **Session duration updates** - Increments from "0h 0m" to "0h 5m"
- [ ] **Current context updates** - Active app matches what you're actually using
- [ ] **Git context detected** - If working in a git repo, shows repo name and branch

**Expected**: All cards visible, live data updates every 5 minutes

---

## Dashboard - Tab 3: History

- [ ] **Placeholder visible** - Shows "History view coming soon" or similar message
- [ ] **No crash** - Tab loads without errors

**Expected**: History tab loads (even if empty/placeholder)

---

## Menu Bar - Sacred Time

**Test during sacred time (9 AM - 12 PM):**
- [ ] **Sacred time indicator shows** - Menu bar button shows "🧘" emoji
- [ ] **Menu shows countdown** - "🧘 Sacred time: Active (Xh Xm remaining)"

**Test before 9 AM:**
- [ ] **Menu shows start time** - "Sacred time: Not active (starts in Xh Xm)"

**Test after 12 PM:**
- [ ] **Menu shows ended** - "Sacred time: Not active (ended at 12 PM)"

**Expected**: Sacred time indicators update based on current time

---

## Menu Bar - Work Mode Updates

**Test after 10+ minutes of running:**
- [ ] **Work mode updates** - Menu shows current mode (e.g., "Deep Focus", "Normal", "Struggling")
- [ ] **Duration updates** - Menu shows elapsed time (e.g., "Deep Focus (0h 15m)")
- [ ] **Collaboration debt shows** - Menu shows "Collaboration debt: LOW/MEDIUM/HIGH"

**Test by switching apps frequently (20+ times in 5 minutes):**
- [ ] **Mode changes to Struggling or Pressure** - Detects high app switching

**Expected**: Menu bar reflects actual work mode based on behavior

---

## Work Mode Detection

**Test Deep Focus:**
1. Open Xcode or VS Code
2. Work in a git repository
3. Make a commit: `git commit -m "test"`
4. Keep app switching low (<10 switches/hour)
5. Wait 5 minutes

- [ ] **Mode shows "Deep Focus"** - Dashboard Tab 2 shows blue mode indicator
- [ ] **Timeline shows blue segment** - Tab 1 timeline has blue segment

**Test Struggling:**
1. Switch between apps frequently (20+ switches in 5 minutes)
2. Don't make any git commits
3. Wait 5 minutes

- [ ] **Mode shows "Struggling"** - Dashboard shows orange mode indicator
- [ ] **Timeline shows orange segment** - Tab 1 timeline has orange segment

**Expected**: Work modes change based on observable signals

---

## Git Monitoring

**Test in a git repository:**
- [ ] **Repo detected** - Dashboard Tab 2 shows "Git Repository: [repo name]"
- [ ] **Branch detected** - Shows "Branch: [branch name]"
- [ ] **Commits counted** - Shows "Commits today: [number]"

**Test outside a git repository:**
- [ ] **No git context** - Dashboard shows "Git Repository: —" or empty

**Expected**: Git context detected when working in a repo, empty otherwise

---

## App Switches

**Requires Screen Recording permission enabled:**
- [ ] **App switches tracked** - Dashboard Tab 2 shows "App Switches (last hour): [number]"
- [ ] **Number increases** - After switching apps multiple times, number increases

**If shows 0 or —:**
- [ ] **Verify permission** - System Settings → Privacy & Security → Screen Recording → "80HD" enabled
- [ ] **Restart app** - Quit and relaunch after enabling permission

**Expected**: App switches counted correctly (non-zero after switching apps)

---

## Data Persistence

- [ ] **Quit app** - Menu bar → "Quit 80HD"
- [ ] **Relaunch app** - Run from Xcode again
- [ ] **Data survives** - Dashboard Tab 1 shows previous timeline segments
- [ ] **Session ID increments** - New session created, old data preserved

**Expected**: Historical data persists across app restarts

---

## Database

- [ ] **Database file exists** - `~/Library/Application Support/80HD/database.sqlite`
- [ ] **Database has data** - After 15+ minutes of running, database > 0 KB

**Check database contents (optional):**
```bash
sqlite3 ~/Library/Application\ Support/80HD/database.sqlite
.tables  # Should show: work_sessions, context_snapshots, interventions
SELECT COUNT(*) FROM context_snapshots;  # Should show number of snapshots
.quit
```

**Expected**: Database file exists, contains snapshots

---

## Clear Data (Testing Reset)

- [ ] **Menu has "Clear All Data"** - Menu bar → "Clear All Data..." option
- [ ] **Confirmation shown** - Alert asks "Are you sure?"
- [ ] **Cancel works** - Click "Cancel", data not deleted
- [ ] **Confirm works** - Click "Clear All Data", database deleted
- [ ] **Fresh start** - Dashboard resets, timeline empty, new session

**Expected**: Clear data works, app recovers gracefully

---

## Database Stats

- [ ] **Menu shows stats** - Menu bar shows snapshot count (e.g., "Snapshots: 42")
- [ ] **Menu shows size** - Menu bar shows DB size (e.g., "Database: 1.2 MB")
- [ ] **Stats update** - After 5 minutes, snapshot count increments

**Expected**: Database stats visible in menu, update over time

---

## Performance

**After 30+ minutes of running:**
- [ ] **Memory < 50 MB** - Activity Monitor shows 80HD using < 50 MB RAM
- [ ] **CPU < 1% idle** - When idle, CPU usage < 1%
- [ ] **CPU < 5% during snapshot** - Every 5 minutes, brief spike < 5%
- [ ] **No hangs** - UI remains responsive during snapshot capture

**Expected**: Low memory and CPU usage, no UI freezing

---

## Edge Cases

**Test with no git repository:**
- [ ] **App doesn't crash** - Dashboard shows "—" for git fields, app continues

**Test with no Screen Recording permission:**
- [ ] **App switches show —** - Dashboard shows "—" or 0 for app switches
- [ ] **App doesn't crash** - Monitoring continues, just missing app switch data

**Test during sacred time (9 AM - 12 PM):**
- [ ] **Indicators work** - Menu bar shows 🧘, countdown visible
- [ ] **Timeline highlights** - Blue gradient on timeline during sacred hours

**Test outside sacred time:**
- [ ] **Indicators cleared** - No 🧘 in menu bar
- [ ] **Timeline normal** - No special highlighting

**Expected**: App handles missing data gracefully, no crashes

---

## Known Issues (v0.0.1)

Document any bugs or issues found during testing:

**Bugs:**
- [ ] _______________________________________________________
- [ ] _______________________________________________________
- [ ] _______________________________________________________

**Annoyances:**
- [ ] _______________________________________________________
- [ ] _______________________________________________________

**Feature Requests:**
- [ ] _______________________________________________________
- [ ] _______________________________________________________

---

## Sign-Off

- [ ] **All critical tests passed** - No blocking issues found
- [ ] **App is usable** - Can run for hours without crashing
- [ ] **Data persists** - Database survives app restart
- [ ] **Ready for daily use** - Travis can use this app in real work

**Tester Signature**: _______________________
**Date**: _______________________

**Notes:**
