# Task OS Mission Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Gamma Focus read unfinished tasks from `personal-task-os` and use a selected task as the focus-session mission without writing back to Task OS.

**Architecture:** Add a read-only local bridge in Gamma: a Node runtime API route shells out to the existing `personal-task-os` export command, parses Markdown task lines into mission candidates, and returns JSON. The client uses a small hook and picker component to fill the existing mission draft; session metadata records whether the mission came from manual input or Task OS.

**Tech Stack:** Next.js 16.2.2 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, Vitest, localStorage, Node `child_process` in a server route.

---

## Scope And Boundaries

This plan modifies only `/Users/soichiyo/Develop/atelier/gamma-focus`.

Do not modify:

- `/Users/soichiyo/Develop/studio-prairie/repos/personal-task-os`
- `/Users/soichiyo/Develop/studio-prairie/tasks/today.md`
- Redis keys, Redis credentials, `.env*`, `.vercel`, or Studio Prairie hub files

The first version is read-only and one-way:

```txt
personal-task-os export -> Gamma candidates -> user selects -> Gamma missionDraft
```

No completion sync, review write-back, or Task OS mutation belongs in this pass.

---

## Preflight Gates

- [ ] **Step 1: Confirm Gamma repo and clean worktree**

Run:

```bash
pwd
git status --short --branch
```

Expected:

```text
/Users/soichiyo/Develop/atelier/gamma-focus
## main...origin/main
```

If unexpected dirty files exist, stop and ask before editing.

- [ ] **Step 2: Confirm Task OS export command exists without editing it**

Run:

```bash
test -f /Users/soichiyo/Develop/studio-prairie/repos/personal-task-os/scripts/export-today-md.mjs && echo "export command exists"
```

Expected:

```text
export command exists
```

Do not run writes in `personal-task-os`. This integration uses only the read-only export command.

- [ ] **Step 3: Read local Next.js docs if available**

Run:

```bash
find node_modules/next/dist/docs -maxdepth 2 -type f | sed -n '1,120p'
```

Read the relevant App Router route handler docs before editing `src/app/api/*`. If the docs directory is absent, follow existing project patterns and record that in the implementation notes.

- [ ] **Step 4: Baseline test and build**

Run:

```bash
npm run test
npm run build
```

Expected: both pass before feature work begins.

---

## File Structure

Create:

- `src/types/task-os.ts`: Task OS candidate and API response types.
- `src/task-os/parse-task-os-markdown.ts`: pure parser for exported Markdown.
- `src/task-os/parse-task-os-markdown.test.ts`: parser tests.
- `src/app/api/task-os/tasks/route.ts`: read-only local API route that runs the export command.
- `src/hooks/useTaskOsMissions.ts`: client hook for loading candidates on demand.
- `src/components/TaskOsMissionPicker.tsx`: compact task chooser UI.

Modify:

- `src/types/focus-session.ts`: add mission source metadata to sessions.
- `src/session/focus-session.ts`: allow `createFocusSession` to accept mission source metadata.
- `src/session/storage.ts`: sanitize persisted mission source metadata.
- `src/session/focus-session.test.ts`: cover Task OS mission metadata preservation.
- `src/hooks/useFocusSession.ts`: track selected mission source and expose a helper for Task OS selection.
- `src/components/FocusMissionSetup.tsx`: render an optional picker slot near mission input.
- `src/app/page.tsx`: wire the picker into the setup state.

---

## Task 1: Add Task OS Candidate Types

**Files:**

- Create: `src/types/task-os.ts`

- [ ] **Step 1: Create candidate and response types**

Add:

```ts
export type TaskOsMissionCandidate = {
  id: string;
  text: string;
  sectionTitle: string | null;
  rawLine: string;
  stableId?: string;
  due?: string;
};

export type TaskOsTasksResponse =
  | {
      ok: true;
      candidates: TaskOsMissionCandidate[];
      source: "personal-task-os";
    }
  | {
      ok: false;
      candidates: [];
      source: "personal-task-os";
      error: string;
    };
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/types/task-os.ts
git commit -m "feat: Task OSミッション候補の型を追加"
```

---

## Task 2: Add Markdown Candidate Parser

**Files:**

- Create: `src/task-os/parse-task-os-markdown.ts`
- Create: `src/task-os/parse-task-os-markdown.test.ts`

- [ ] **Step 1: Write parser tests**

Create `src/task-os/parse-task-os-markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTaskOsMissionCandidates } from "@/task-os/parse-task-os-markdown";

describe("parseTaskOsMissionCandidates", () => {
  it("extracts open top-level tasks with section titles", () => {
    const markdown = [
      "## 260626",
      "- [ ] Write Gamma plan @today <!-- tid:abc123 -->",
      "- [x] Already done",
      "  - [ ] child detail should not become a candidate",
      "## Will Do",
      "- [ ] Review PR",
      "",
    ].join("\n");

    const candidates = parseTaskOsMissionCandidates(markdown);

    expect(candidates).toEqual([
      {
        id: "abc123",
        text: "Write Gamma plan @today",
        sectionTitle: "260626",
        rawLine: "- [ ] Write Gamma plan @today <!-- tid:abc123 -->",
        stableId: "abc123",
        due: "today",
      },
      {
        id: "line-4",
        text: "Review PR",
        sectionTitle: "Will Do",
        rawLine: "- [ ] Review PR",
      },
    ]);
  });

  it("uses a null section when a task appears before headings", () => {
    const candidates = parseTaskOsMissionCandidates("- [ ] Loose task\n");

    expect(candidates).toEqual([
      {
        id: "line-0",
        text: "Loose task",
        sectionTitle: null,
        rawLine: "- [ ] Loose task",
      },
    ]);
  });

  it("ignores completed tasks and indented child tasks", () => {
    const markdown = [
      "## Today",
      "- [x] Done",
      "  - [ ] Nested child",
      "    - [ ] Deeper child",
      "- [ ] Open",
    ].join("\n");

    expect(parseTaskOsMissionCandidates(markdown).map((task) => task.text)).toEqual(["Open"]);
  });

  it("strips stable IDs from visible text but keeps metadata", () => {
    const candidates = parseTaskOsMissionCandidates(
      "## Today\n- [ ] Call supplier <!-- tid:k9x7 -->\n",
    );

    expect(candidates[0].text).toBe("Call supplier");
    expect(candidates[0].stableId).toBe("k9x7");
    expect(candidates[0].id).toBe("k9x7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/task-os/parse-task-os-markdown.test.ts
```

Expected: fail because `src/task-os/parse-task-os-markdown.ts` does not exist.

- [ ] **Step 3: Implement parser**

Create `src/task-os/parse-task-os-markdown.ts`:

```ts
import type { TaskOsMissionCandidate } from "@/types/task-os";

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const OPEN_TASK_RE = /^-\s*\[\s\]\s?(.*)$/;
const COMPLETED_TASK_RE = /^-\s*\[[xX]\]\s?(.*)$/;
const TASK_ID_RE = /<!--\s*tid:([a-z0-9]+)\s*-->\s*$/i;

export function parseTaskOsMissionCandidates(markdown: string): TaskOsMissionCandidate[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const candidates: TaskOsMissionCandidate[] = [];
  let sectionTitle: string | null = null;

  lines.forEach((line, index) => {
    const heading = line.match(HEADING_RE);
    if (heading) {
      sectionTitle = heading[2].trim() || null;
      return;
    }

    if (line.startsWith(" ") || line.startsWith("\t")) return;
    if (COMPLETED_TASK_RE.test(line)) return;

    const task = line.match(OPEN_TASK_RE);
    if (!task) return;

    const rawText = task[1].trim();
    const idMatch = rawText.match(TASK_ID_RE);
    const stableId = idMatch?.[1];
    const text = idMatch ? rawText.slice(0, idMatch.index).trimEnd() : rawText;

    if (!text) return;

    const due = detectDue(text);
    candidates.push({
      id: stableId ?? `line-${index}`,
      text,
      sectionTitle,
      rawLine: line,
      ...(stableId ? { stableId } : {}),
      ...(due ? { due } : {}),
    });
  });

  return candidates;
}

function detectDue(text: string): string | undefined {
  if (/(^|\s)@today(\s|$)/i.test(text)) return "today";
  if (/(^|\s)@tomorrow(\s|$)/i.test(text)) return "tomorrow";
  return undefined;
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
npm run test -- src/task-os/parse-task-os-markdown.test.ts
```

Expected: all parser tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/task-os/parse-task-os-markdown.ts src/task-os/parse-task-os-markdown.test.ts
git commit -m "feat: Task OSの未完了タスクを抽出"
```

---

## Task 3: Add Read-Only API Route

**Files:**

- Create: `src/app/api/task-os/tasks/route.ts`

- [ ] **Step 1: Create API route**

Create `src/app/api/task-os/tasks/route.ts`:

```ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { parseTaskOsMissionCandidates } from "@/task-os/parse-task-os-markdown";
import type { TaskOsTasksResponse } from "@/types/task-os";

export const runtime = "nodejs";

const DEFAULT_TASK_OS_ROOT = "/Users/soichiyo/Develop/studio-prairie/repos/personal-task-os";
const EXPORT_TIMEOUT_MS = 8000;

export async function GET() {
  const root = process.env.GAMMA_TASK_OS_ROOT ?? DEFAULT_TASK_OS_ROOT;

  if (!existsSync(root)) {
    return unavailable(`Task OS root not found: ${root}`);
  }

  try {
    const markdown = await runTaskOsExport(root);
    const candidates = parseTaskOsMissionCandidates(markdown);

    return NextResponse.json({
      ok: true,
      candidates,
      source: "personal-task-os",
    } satisfies TaskOsTasksResponse);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "Task OS export failed");
  }
}

function unavailable(error: string) {
  return NextResponse.json(
    {
      ok: false,
      candidates: [],
      source: "personal-task-os",
      error,
    } satisfies TaskOsTasksResponse,
    { status: 200 },
  );
}

function runTaskOsExport(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npm",
      ["run", "-s", "export:today-md", "--", "--latest-block"],
      {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Task OS export timed out"));
    }, EXPORT_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `Task OS export exited with code ${code}`));
    });
  });
}
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Manual API check**

Run:

```bash
npm run dev -- --port 3000
```

In another terminal:

```bash
curl -s http://localhost:3000/api/task-os/tasks | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s); console.log(j.ok, j.source, Array.isArray(j.candidates), j.candidates.length);})'
```

Expected:

```text
true personal-task-os true <number>
```

If Task OS export is unavailable locally, expected:

```text
false personal-task-os true 0
```

Stop the dev server after the check.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/app/api/task-os/tasks/route.ts
git commit -m "feat: Task OSタスク候補APIを追加"
```

---

## Task 4: Add Mission Source Metadata

**Files:**

- Modify: `src/types/focus-session.ts`
- Modify: `src/session/focus-session.ts`
- Modify: `src/session/storage.ts`
- Modify: `src/session/focus-session.test.ts`

- [ ] **Step 1: Extend session types**

In `src/types/focus-session.ts`, add the mission source type after `AudioInterventionId`:

```ts
export type MissionSource =
  | { type: "manual" }
  | {
      type: "personal-task-os";
      taskText: string;
      sectionTitle: string | null;
      stableId?: string;
      rawLine: string;
      importedAt: string;
    };
```

Then add the field to `FocusSession`:

```ts
  missionSource: MissionSource;
```

- [ ] **Step 2: Update session creation**

In `src/session/focus-session.ts`, import `MissionSource` and update `createFocusSession`:

```ts
export function createFocusSession(
  mission: string,
  duration: FocusDuration,
  now = new Date(),
  missionSource: MissionSource = { type: "manual" },
): FocusSession {
  return {
    id: createId(now),
    mission: mission.trim(),
    missionSource,
    duration,
    status: "running",
    startedAt: now.toISOString(),
    pausedAt: null,
    completedAt: null,
    elapsedBeforePauseSeconds: 0,
    checkIns: [],
    review: null,
  };
}
```

Keep the rest of the function unchanged.

- [ ] **Step 3: Sanitize persisted metadata**

In `src/session/storage.ts`, import `MissionSource`:

```ts
import type { FocusSession, MissionSource, PersistedSessionState } from "@/types/focus-session";
```

Add this helper near `sanitizeSession`:

```ts
function sanitizeMissionSource(value: unknown, fallbackMission: string): MissionSource {
  if (!value || typeof value !== "object") return { type: "manual" };
  const source = value as Partial<MissionSource>;

  if (source.type !== "personal-task-os") return { type: "manual" };

  const taskSource = value as {
    type?: string;
    taskText?: unknown;
    sectionTitle?: unknown;
    stableId?: unknown;
    rawLine?: unknown;
    importedAt?: unknown;
  };

  return {
    type: "personal-task-os",
    taskText: typeof taskSource.taskText === "string" ? taskSource.taskText : fallbackMission,
    sectionTitle: typeof taskSource.sectionTitle === "string" ? taskSource.sectionTitle : null,
    rawLine: typeof taskSource.rawLine === "string" ? taskSource.rawLine : fallbackMission,
    importedAt:
      typeof taskSource.importedAt === "string" ? taskSource.importedAt : new Date(0).toISOString(),
    ...(typeof taskSource.stableId === "string" ? { stableId: taskSource.stableId } : {}),
  };
}
```

Then add this field in the returned session object:

```ts
    missionSource: sanitizeMissionSource(session.missionSource, session.mission),
```

- [ ] **Step 4: Add metadata test**

Append this test to `src/session/focus-session.test.ts`:

```ts
  it("stores mission source metadata when a Task OS task starts a session", () => {
    const session = createFocusSession(
      "Write Gamma plan",
      25,
      new Date("2026-06-26T00:00:00.000Z"),
      {
        type: "personal-task-os",
        taskText: "Write Gamma plan",
        sectionTitle: "260626",
        stableId: "abc123",
        rawLine: "- [ ] Write Gamma plan <!-- tid:abc123 -->",
        importedAt: "2026-06-26T00:00:00.000Z",
      },
    );

    expect(session.missionSource).toEqual({
      type: "personal-task-os",
      taskText: "Write Gamma plan",
      sectionTitle: "260626",
      stableId: "abc123",
      rawLine: "- [ ] Write Gamma plan <!-- tid:abc123 -->",
      importedAt: "2026-06-26T00:00:00.000Z",
    });
  });
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm run test -- src/session/focus-session.test.ts
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/types/focus-session.ts src/session/focus-session.ts src/session/storage.ts src/session/focus-session.test.ts
git commit -m "feat: ミッションのTask OS由来メタデータを保存"
```

---

## Task 5: Add Client Hook For Task OS Missions

**Files:**

- Create: `src/hooks/useTaskOsMissions.ts`

- [ ] **Step 1: Add hook**

Create `src/hooks/useTaskOsMissions.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import type { TaskOsMissionCandidate, TaskOsTasksResponse } from "@/types/task-os";

type TaskOsMissionState = {
  candidates: TaskOsMissionCandidate[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
};

export function useTaskOsMissions() {
  const [state, setState] = useState<TaskOsMissionState>({
    candidates: [],
    isLoading: false,
    error: null,
    hasLoaded: false,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/task-os/tasks", { cache: "no-store" });
      const payload = (await response.json()) as TaskOsTasksResponse;

      if (!payload.ok) {
        setState({
          candidates: [],
          isLoading: false,
          error: payload.error,
          hasLoaded: true,
        });
        return;
      }

      setState({
        candidates: payload.candidates,
        isLoading: false,
        error: null,
        hasLoaded: true,
      });
    } catch (error) {
      setState({
        candidates: [],
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load Task OS tasks",
        hasLoaded: true,
      });
    }
  }, []);

  return {
    ...state,
    load,
  };
}
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/hooks/useTaskOsMissions.ts
git commit -m "feat: Task OS候補を読むフックを追加"
```

---

## Task 6: Add Task OS Mission Picker UI

**Files:**

- Create: `src/components/TaskOsMissionPicker.tsx`

- [ ] **Step 1: Add picker component**

Create `src/components/TaskOsMissionPicker.tsx`:

```tsx
"use client";

import { ListChecks, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTaskOsMissions } from "@/hooks/useTaskOsMissions";
import type { TaskOsMissionCandidate } from "@/types/task-os";

type TaskOsMissionPickerProps = {
  onSelect: (candidate: TaskOsMissionCandidate) => void;
};

export function TaskOsMissionPicker({ onSelect }: TaskOsMissionPickerProps) {
  const taskOs = useTaskOsMissions();
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setIsOpen(true);
    if (!taskOs.hasLoaded && !taskOs.isLoading) {
      void taskOs.load();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={open}
        className="flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        <ListChecks className="h-4 w-4 text-purple-400" />
        Choose from Task OS
      </button>

      {isOpen && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Task OS missions</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Read-only unfinished tasks</p>
            </div>
            <button
              type="button"
              onClick={() => void taskOs.load()}
              disabled={taskOs.isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              aria-label="Reload Task OS tasks"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${taskOs.isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {taskOs.error && <p className="text-xs text-amber-300">{taskOs.error}</p>}

          {!taskOs.error && taskOs.hasLoaded && taskOs.candidates.length === 0 && (
            <p className="text-xs text-zinc-500">No unfinished Task OS tasks found.</p>
          )}

          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {taskOs.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  onSelect(candidate);
                  setIsOpen(false);
                }}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
              >
                <span className="block text-sm text-white">{candidate.text}</span>
                <span className="mt-1 flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                  {candidate.sectionTitle ?? "No section"}
                  {candidate.due && <span className="text-purple-400">@{candidate.due}</span>}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-8 rounded-lg bg-zinc-900 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            Close
          </button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/TaskOsMissionPicker.tsx
git commit -m "feat: Task OSミッション選択UIを追加"
```

---

## Task 7: Wire Picker Into Mission Setup

**Files:**

- Modify: `src/components/FocusMissionSetup.tsx`
- Modify: `src/hooks/useFocusSession.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add optional slot to mission setup**

In `src/components/FocusMissionSetup.tsx`, add:

```ts
import type { ReactNode } from "react";
```

Add the prop:

```ts
  taskPickerSlot?: ReactNode;
```

Destructure it:

```ts
  taskPickerSlot,
```

Render it immediately after the mission input block:

```tsx
      {taskPickerSlot}
```

- [ ] **Step 2: Track mission source in focus hook**

In `src/hooks/useFocusSession.ts`, import:

```ts
import type { TaskOsMissionCandidate } from "@/types/task-os";
```

Also import `MissionSource`:

```ts
  MissionSource,
```

Add state:

```ts
  const [missionSourceDraft, setMissionSourceDraft] = useState<MissionSource>({ type: "manual" });
```

When loading an active session, set:

```ts
    setMissionSourceDraft(restored.activeSession?.missionSource ?? { type: "manual" });
```

In `startSession`, pass the source:

```ts
    const session = createFocusSession(missionDraft, durationDraft, new Date(), missionSourceDraft);
```

Update the dependency list to include `missionSourceDraft`.

Add this callback before `submitReview`:

```ts
  const selectTaskOsMission = useCallback((candidate: TaskOsMissionCandidate) => {
    setMissionDraft(candidate.text);
    setMissionSourceDraft({
      type: "personal-task-os",
      taskText: candidate.text,
      sectionTitle: candidate.sectionTitle,
      ...(candidate.stableId ? { stableId: candidate.stableId } : {}),
      rawLine: candidate.rawLine,
      importedAt: new Date().toISOString(),
    });
  }, []);
```

In `setMissionDraft` usage, manual typing should reset the source. Replace the returned `setMissionDraft` with:

```ts
    setMissionDraft: (mission: string) => {
      setMissionDraft(mission);
      setMissionSourceDraft({ type: "manual" });
    },
```

After submitting review, reset:

```ts
    setMissionSourceDraft({ type: "manual" });
```

Return:

```ts
    selectTaskOsMission,
```

- [ ] **Step 3: Render picker from page**

In `src/app/page.tsx`, import:

```ts
import { TaskOsMissionPicker } from "@/components/TaskOsMissionPicker";
```

Pass the slot:

```tsx
            taskPickerSlot={
              <TaskOsMissionPicker onSelect={focus.selectTaskOsMission} />
            }
```

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Manual browser check**

Run:

```bash
npm run dev -- --port 3000
```

Open `http://localhost:3000`.

Verify:

- Manual mission entry still enables `Start Focus Session`.
- `Choose from Task OS` opens the picker.
- If Task OS export is available, selecting a task fills the mission input.
- If Task OS export is unavailable, manual input still works.
- Starting a session after selecting a task still shows the normal timer.

Stop the dev server after checking.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/FocusMissionSetup.tsx src/hooks/useFocusSession.ts src/app/page.tsx
git commit -m "feat: Task OSタスクをミッションに選択"
```

---

## Task 8: Add Storage Tests For Mission Source

**Files:**

- Modify: `src/session/storage.test.ts`

- [ ] **Step 1: Add storage test**

Append this test to `src/session/storage.test.ts`:

```ts
  it("round-trips Task OS mission metadata", () => {
    const session = createFocusSession(
      "Write Gamma plan",
      25,
      new Date("2026-06-26T00:00:00.000Z"),
      {
        type: "personal-task-os",
        taskText: "Write Gamma plan",
        sectionTitle: "260626",
        stableId: "abc123",
        rawLine: "- [ ] Write Gamma plan <!-- tid:abc123 -->",
        importedAt: "2026-06-26T00:00:00.000Z",
      },
    );

    saveSessionState({
      version: 1,
      activeSession: session,
      history: [session],
      coachSettings: { checkInIntervalMinutes: 15, enableAudioInterventions: true },
    });

    const state = loadSessionState();

    expect(state.activeSession?.missionSource).toEqual({
      type: "personal-task-os",
      taskText: "Write Gamma plan",
      sectionTitle: "260626",
      stableId: "abc123",
      rawLine: "- [ ] Write Gamma plan <!-- tid:abc123 -->",
      importedAt: "2026-06-26T00:00:00.000Z",
    });
  });
```

- [ ] **Step 2: Run storage tests**

Run:

```bash
npm run test -- src/session/storage.test.ts
```

Expected: tests pass.

- [ ] **Step 3: Run all tests and build**

Run:

```bash
npm run test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/session/storage.test.ts
git commit -m "test: Task OS由来ミッションの保存を検証"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full command check**

Run:

```bash
npm run test
npm run build
```

Expected: both pass.

- [ ] **Step 2: API check**

Run:

```bash
npm run dev -- --port 3000
```

In another terminal:

```bash
curl -s http://localhost:3000/api/task-os/tasks | head -c 500
```

Expected: JSON beginning with either:

```json
{"ok":true,"candidates":
```

or:

```json
{"ok":false,"candidates":[],"source":"personal-task-os"
```

Both are acceptable because the UI must degrade to manual mission entry.

- [ ] **Step 3: UI smoke check**

In the browser:

- Open Gamma Focus.
- Click `Choose from Task OS`.
- Select a candidate if available.
- Confirm the mission input changes.
- Start a session.
- Complete review.
- Confirm Recent Sessions still renders.

- [ ] **Step 4: Check no Task OS files changed**

Run:

```bash
git -C /Users/soichiyo/Develop/studio-prairie/repos/personal-task-os status --short --branch
```

Expected: no new changes caused by this Gamma implementation. If that repo was already dirty before implementation, the dirty list should be unchanged.

- [ ] **Step 5: Stop dev server and check Gamma status**

Run:

```bash
git status --short --branch
```

Expected: clean after commits, or only intentional uncommitted files if the implementer is not committing.

---

## Notes For Claude

- Keep the integration read-only.
- Do not import code from `personal-task-os`; treat it as an external local command.
- Do not add cloud auth, Redis reads, completion sync, or review write-back.
- Do not block the core Gamma experience if Task OS is unavailable.
- Avoid logging full task Markdown or absolute source details in the normal browser UI.
- If App Router route handler behavior differs in Next.js 16 docs, follow the docs and update this plan with the exact adjustment before coding further.

