# Result Detail Dashboard - Implementation Guide

## Overview

The Result Detail Dashboard is a comprehensive result viewer for QAgent test runs. It displays detailed information about completed test executions with a 2-column layout optimized for analysis and troubleshooting.

**Location**: `/history/[runId]`

## Architecture

### Main Page: `frontend/app/history/[runId]/page.tsx`

The main page component implements a split-view layout:
- **Left Column (40%)**: Summary, scenario list, and login warnings
- **Right Column (60%)**: Media viewer and execution timeline

### Reusable Components: `frontend/components/ResultDetailComponents.tsx`

A library of composable UI components for building result dashboards:
- `Card` - Base card container
- `CardHeader` - Card header with title and optional right element
- `Badge` - Status badge with multiple variants
- `StatusBadge` - Test status display
- `ProgressBar` - Progress visualization
- `TabGroup` - Tab navigation
- `Button` - Reusable button component
- `TimelineItem` - Timeline step visualization
- `StatBox` - Statistics display
- `Accordion` - Expandable content
- Icon components: `CheckCircle`, `XCircle`
- `EmptyState` - Empty state display

### Mock Data: `frontend/lib/mockRunData.ts`

Sample data for testing and development:
- `mockRunData` - Successful run with mixed results
- `mockRunDataWithLoginFailure` - Run with login authentication failure

## Layout Structure

### Left Column (40%)

#### 1. Execution Summary Card
Displays high-level run information:
- Title: "실행 결과" (Execution Result)
- Status badge (Pass/Fail)
- Run metadata (date, case count)
- Progress bar (filled based on completion)
- Three stat boxes: Total / Passed / Failed

```tsx
<ExecutionSummaryCard
  total={data.total}
  passed={data.passed}
  failed={data.failed}
  status={data.status === "failed" ? "Fail" : "Pass"}
  createdAt={data.createdAt}
/>
```

#### 2. Login Failure Warning (Conditional)
Only shown when `loginStatus === "fail"`:
- Red border and background
- Key icon + "로그인 실패" text
- Expandable accordion showing:
  - Login failure reason
  - Step-by-step login process log

```tsx
{data.loginStatus === "fail" && (
  <LoginFailureWarning
    loginFailReason={data.loginFailReason}
    loginSteps={data.loginSteps}
  />
)}
```

#### 3. Scenario List Section
Filterable list of test scenarios:

**Tabs**: "전체" | "✅ 완료" | "❌ 실패" | "⚠️ 확인 필요"

**Scenario Cards**:
- Status indicator (✓, ✗, ⏳)
- Scenario text (clamped to 3 lines)
- "전체 보기 ∨" button for truncated text
- Active card has blue border highlight

#### 4. Retry Button
Full-width button at bottom:
- Text: "시나리오 수정 후 재시도"
- Redirects to `/new` with pre-filled URL and scenarios
- Only shown for `natural` mode runs with scenarios

### Right Column (60%)

#### 1. Media Viewer Card
Displays test output media:
- Video player (if `videoUrl` available)
- Screenshot (from `screenshotBase64` or `screenshotUrl`)
- Fallback message: "스크린샷 없음"

```tsx
<MediaViewerCard activeCase={activeCase} />
```

#### 2. Execution Timeline Card
Vertical timeline of test execution:

**Header**: "실행 타임라인"

**Content**:
1. Failure reason box (if `status === "Fail"`)
   - Red border
   - Format: "실패 사유: {failReason}"

2. Timeline steps from `consoleLogs`:
   - Vertical gray line
   - Numbered circles (1, 2, 3...)
   - Step content in rounded gray boxes
   - Parsed format: `[Step X] Action — Details`

```tsx
<ExecutionTimelineCard
  consoleLogs={activeCase?.consoleLogs ?? []}
  failReason={activeCase?.failReason}
  status={activeCase?.status ?? "Pending"}
/>
```

## Data Flow

### TypeScript Interfaces

```typescript
interface RunResult {
  runId: string;
  status: "running" | "completed" | "failed";
  paused?: boolean;
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  cases: TestCase[];
  mode?: "excel" | "natural";
  targetUrl?: string;
  scenarios?: string;
  loginStatus?: "running" | "success" | "fail";
  loginFailReason?: string;
  loginSteps?: string[];
}

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: "Pass" | "Fail" | "Pending";
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  screenshotBase64?: string;
  consoleLogs?: string[];
  suggestions?: UXSuggestion[];
  verificationStatus?: "approved" | "rejected" | "pending";
}
```

### Data Fetching

```tsx
const { data, error, isLoading } = useSWR<RunResult>(
  `/api/status?run_id=${runId}`,
  fetcher,
  {
    refreshInterval: 0,        // No auto-refresh for history detail
    revalidateOnFocus: false,  // No refetch on window focus
  }
);
```

The API endpoint returns a `RunResult` object with all necessary test case data.

## Design System

### Color Tokens (in `COLORS`)

```typescript
const C = {
  indigo: "#0066cc",      // Primary blue
  indigoDark: "#0055aa",  // Darker blue
  indigoBg: "#eff6ff",    // Light blue background
  indigoBg2: "#dbeafe",   // Medium blue background
  green: "#16a34a",       // Success green
  greenBg: "#f0fdf4",     // Light green background
  red: "#dc2626",         // Error red
  redBg: "#fef2f2",       // Light red background
  amber: "#d97706",       // Warning amber
  amberBg: "#fffbeb",     // Light amber background
  glass: "#ffffff",       // White
  border: "#e0e0e0",      // Standard border
  borderSoft: "#f0f0f0",  // Soft border
  text: "#1d1d1f",        // Primary text
  textMid: "#6b7280",     // Secondary text
  textLight: "#9ca3af",   // Tertiary text
  textFaint: "#d1d5db",   // Faint text
  bgGray: "#f5f5f7",      // Page background
};
```

### Spacing & Sizing

- **Card radius**: `16px` (rounded-xl)
- **Button radius**: `12px` (rounded-lg)
- **Small element radius**: `8-10px` (rounded-lg)
- **Gaps**: `24px` between major sections, `12px` within
- **Padding**: `16-20px` for card content

### Typography

- **Titles**: `15px` / `700` weight
- **Section headers**: `13px` / `700` weight
- **Body text**: `12-13px` / `400` weight
- **Labels**: `11px` / `600` weight
- **Small text**: `10px` / `500-600` weight

## Usage Examples

### Basic Usage

```tsx
import HistoryDetailPage from "@/app/history/[runId]/page";

// Automatically fetches from /api/status?run_id={runId}
// Display at /history/[runId]
```

### With Mock Data (Development)

```tsx
import { mockRunData } from "@/lib/mockRunData";

// Replace API call in development:
const data = mockRunData;

// Or use query parameter:
// /history/[runId]?demo=true
```

### Importing Reusable Components

```tsx
import {
  Card,
  CardHeader,
  Badge,
  Button,
  TimelineItem,
  StatBox,
  COLORS,
} from "@/components/ResultDetailComponents";

// Use in custom dashboard views
```

## Customization

### Modifying Colors

Edit `COLORS` in `ResultDetailComponents.tsx`:

```typescript
const C = {
  indigo: "#0066cc",  // Change primary color here
  // ... other colors
};
```

### Adding New Status Badges

Extend the `StatusBadge` component:

```tsx
const map = {
  Pass: { ... },
  Fail: { ... },
  Pending: { ... },
  // Add new status here
};
```

### Extending Timeline

Parse console logs differently in `ExecutionTimelineCard`:

```tsx
const parseStep = (log: string) => {
  // Customize parsing logic
  const m = log.match(/your_custom_regex/);
  if (m) return { /* parsed step */ };
  return { /* default */ };
};
```

## Production Checklist

- [ ] Verify API endpoint returns correct `RunResult` format
- [ ] Test with various run states (pass, fail, pending, mixed)
- [ ] Test with login failures (displays warning accordion)
- [ ] Test with missing media (screenshot/video)
- [ ] Test with long console logs (scrollable timeline)
- [ ] Test on mobile/narrow viewports (may need responsive adjustments)
- [ ] Verify error handling for failed API calls
- [ ] Test retry button navigation with URL parameters
- [ ] Verify date formatting for locale (ko-KR)
- [ ] Test tab filtering with all states
- [ ] Verify accessibility (keyboard navigation, screen reader)

## Known Limitations

1. **Media size**: Large videos/screenshots may impact performance
2. **Console logs**: Very large log arrays may need pagination
3. **Timeline layout**: Narrow screens may have layout issues
4. **Responsive design**: Currently optimized for desktop (40/60 split)

## Future Enhancements

- [ ] Screenshot error highlighting overlay (red box on failure area)
- [ ] AI suggestions display from `TestCase.suggestions`
- [ ] Verification workflow for review status
- [ ] Export report to PDF/CSV
- [ ] Comparison with previous runs
- [ ] Real-time log streaming for running tests
- [ ] Responsive design for tablets/mobile
- [ ] Dark mode support
- [ ] Search/filter console logs
- [ ] Download media files

## Related Files

- Main page: `frontend/app/history/[runId]/page.tsx`
- Components: `frontend/components/ResultDetailComponents.tsx`
- Mock data: `frontend/lib/mockRunData.ts`
- API endpoint: `frontend/app/api/status/route.ts`
- Existing dashboard: `frontend/components/RunDashboard.tsx`

## Troubleshooting

### Page shows "데이터를 불러올 수 없습니다"
- Check API endpoint `/api/status?run_id={runId}` is accessible
- Verify backend returns valid `RunResult` JSON
- Check browser console for CORS errors

### Timeline not displaying
- Verify `consoleLogs` array exists and has entries
- Check log format matches expected pattern: `[Step X] Action — Details`
- Look for parsing errors in browser console

### No screenshot displayed
- Confirm `screenshotBase64`, `screenshotUrl`, or `videoUrl` is set
- Verify base64 data is properly encoded
- Check CORS if loading from external URL

### Styling issues
- Verify Tailwind CSS is loaded (if using class-based components)
- Check that color tokens are properly imported
- Inspect element in browser dev tools for applied styles
