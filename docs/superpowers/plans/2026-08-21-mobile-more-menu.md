# Bottom Nav Mobile "Lainnya" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile bottom nav expose ALL menu items (currently only the first 5 show; Sumber Dana / Laporan / Pengaturan are unreachable on small screens) by turning the 5th slot into a "Lainnya" button that opens a panel with the remaining items.

**Architecture:** Keep the `nav` array as-is. Change only `MobileNav` in `src/components/layout/Sidebar.tsx`: render 4 primary items (Dashboard, Transaksi, Akun, Kategori) plus a "Lainnya" (MoreHorizontal) button that opens a `Modal` (existing `src/components/ui/Modal.tsx`) listing the remaining items (Berulang, Sumber Dana, Laporan, Pengaturan).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, React Router v7, lucide-react, Vitest, React Testing Library.

## Global Constraints

- All UI copy in Indonesian (matches existing app: "Lainnya").
- No new dependencies. No `any`; strict TypeScript.
- Desktop `Sidebar` unchanged.
- Reuse the existing `Modal` component for the "Lainnya" panel (no new UI primitive unless needed).
- Existing tests must keep passing; updated by the new tests.
- Commands: verify with `npm test`, `npm run lint`, `npm run build`.

---

### Task 1: Implement "Lainnya" button + panel in `MobileNav`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Test: `src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `Modal` from `../ui/Modal`, `MoreHorizontal` from `lucide-react`.
- Produces: `MobileNav` shows 4 primary items + a "Lainnya" button; the button opens a `Modal` listing the remaining items; selecting one navigates and closes the modal; the "Lainnya" button is highlighted when the active route is one of the less-common routes.

- [ ] **Step 1: Add a failing test**

Append to `src/components/layout/Sidebar.test.tsx`. Add a `MoreHorizontal`-driven expectation. Also add a route stub for `/sources` and `/recurring` if not already present in the test's MockRouter (they are: `/sources` and `/recurring` stubs exist). Add:

```tsx
it('shows the primary items and a Lainnya button in the mobile nav', () => {
  renderLayout('/')
  const nav = screen.getByLabelText('Navigasi bawah')
  const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)
  expect(links).toEqual(['Dashboard', 'Transaksi', 'Akun', 'Kategori'])
  const moreBtn = within(nav).getByRole('button', { name: 'Lainnya' })
  expect(moreBtn).toBeInTheDocument()
  expect(links).not.toContain('Berulang')
  expect(links).not.toContain('Sumber Dana')
  expect(links).not.toContain('Laporan')
  expect(links).not.toContain('Pengaturan')
})

it('opens the Lainnya panel listing the remaining items', () => {
  renderLayout('/')
  fireEvent.click(within(screen.getByLabelText('Navigasi bawah')).getByRole('button', { name: 'Lainnya' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Berulang')).toBeInTheDocument()
  expect(within(dialog).getByText('Sumber Dana')).toBeInTheDocument()
  expect(within(dialog).getByText('Laporan')).toBeInTheDocument()
  expect(within(dialog).getByText('Pengaturan')).toBeInTheDocument()
})

it('marks the Lainnya button active when on a less-common route', () => {
  renderLayout('/reports')
  const btn = within(screen.getByLabelText('Navigasi bawah')).getByRole('button', { name: 'Lainnya' })
  expect(btn.className).toContain('text-good')
})
```

Add the needed imports to the test file (`within` is already imported from `@testing-library/react` in the existing file). The `navLabels` const is currently `['Dashboard', 'Transaksi', 'Akun', 'Kategori', 'Berulang']` — replace its use: the mobile-nav expectations change (see below).

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: FAIL — no "Lainnya" button; the mobile-nav test expecting the old 5 items fails.

- [ ] **Step 3: Implement in `src/components/layout/Sidebar.tsx`**

Add `MoreHorizontal` to the lucide-react import. Add a `useState` import. Modify `MobileNav`:

```tsx
import { useState } from 'react'
// ... lucide imports add MoreHorizontal
import { Modal } from '../ui/Modal'

// after the `nav` array:
const mobilePrimary = nav.slice(0, 4)
const mobileMore = nav.slice(4)
const mobileMoreRoutes = new Set(mobileMore.map((m) => m.to))
```

Rewrite `MobileNav`:

```tsx
export function MobileNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = mobileMoreRoutes.has(pathname)

  return (
    <>
      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {mobilePrimary.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-good' : 'text-ink-muted'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Lainnya"
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              moreActive ? 'text-good' : 'text-ink-muted'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            Lainnya
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Lainnya">
        <div className="space-y-1">
          {mobileMore.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-good/15 text-good' : 'text-ink-muted hover:bg-surface-soft hover:text-ink'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </Modal>
    </>
  )
}
```

Add `useLocation` to the `react-router-dom` import in `Sidebar.tsx`:
```tsx
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
```

Note: `mobileNav` (the old `nav.slice(0, 5)`) is no longer used — remove it to avoid an unused-const lint error.

- [ ] **Step 4: Update the existing "limits the mobile bottom nav to five items" test**

The old test asserted the 5-item bottom nav with `navLabels`. Replace/rework the stale `navLabels` const (now unused) and the mobile-nav expectations to match: 4 primary links + the "Lainnya" button (which is a `<button>`, not an `<a>`). Update so `screen.getByLabelText('Navigasi bawah')` checks the 4 links and the Lainnya button. Remove `navLabels` if unused.

- [ ] **Step 5: Run the sidebar tests and confirm they pass**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: PASS (new + updated + all other sidebar tests).

- [ ] **Step 6: Run full lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: add Lainnya menu to mobile bottom nav"
```

---

### Task 2: Final verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all green (~320+ tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (2 pre-existing warnings in TransactionFilters.tsx / Toast.tsx).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `tsc -b` clean and vite build succeeds.

- [ ] **Step 4: Contract/mobile sanity**

The bottom nav shows Dashboard, Transaksi, Akun, Kategori + Lainnya; opening Lainnya shows Berulang, Sumber Dana, Laporan, Pengaturan; desktop sidebar unchanged. Verified via component tests.

- [ ] **Step 5: Commit / done**

No code changes expected. Report completion.
