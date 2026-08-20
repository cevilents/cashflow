import { Outlet } from 'react-router-dom'
import { MobileNav, QuickAddButton, Sidebar } from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <QuickAddButton />
    </div>
  )
}