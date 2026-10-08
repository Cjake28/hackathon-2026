import { Outlet, createRootRoute } from '@tanstack/react-router';

// Public pages (login, register, verify) live directly in routes/.
// Pages that need a logged-in user live in routes/_app/ (see _app.tsx).
export const Route = createRootRoute({ component: Outlet });
