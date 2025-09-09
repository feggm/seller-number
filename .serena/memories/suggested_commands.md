# Suggested Commands

## Development Commands
```bash
# Install dependencies and PocketBase binary
pnpm install

# Start development (runs both PocketBase and Vite concurrently)
pnpm dev

# Build production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Type checking
pnpm typecheck
```

## Task Completion Commands
After making code changes, run:
1. `pnpm lint` - Check code style and catch errors
2. `pnpm typecheck` - Validate TypeScript types

## Development Notes
- PocketBase serves on port 8090 by default
- Frontend development server runs on Vite's default port
- Use `pnpm dev` to run both servers concurrently