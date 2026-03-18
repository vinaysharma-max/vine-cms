# Vine

Vine is a Next.js + Convex headless publishing app. It includes workspace-aware dashboard routes, a rich text editor, media management backed by Convex storage, API keys, and documentation served from the same app.

## Stack

- Next.js App Router for product routes and docs
- Convex for auth, database, mutations/queries, and file storage
- Bun for package management and scripts
- Tailwind CSS + Radix UI for the interface
- TipTap for rich text editing
- Fumadocs for docs content

## Repository Layout

```text
.
├── app/            # Next.js routes, layouts, route handlers, docs pages
├── components/     # UI, editor, dashboard, and workspace components
├── content/docs/   # MDX documentation content
├── convex/         # Convex schema, queries, mutations, auth config
├── hooks/          # Client hooks for Convex and UI state
├── lib/            # Shared utilities and env parsing
├── public/         # Static assets
├── types/          # Shared TypeScript types
├── package.json
└── bun.lock
```

## Route Structure

Workspace routes are slug-first:

- `/:workspaceSlug/dashboard`
- `/:workspaceSlug/posts`
- `/:workspaceSlug/editor`
- `/:workspaceSlug/authors`
- `/:workspaceSlug/categories`
- `/:workspaceSlug/tags`
- `/:workspaceSlug/media`
- `/:workspaceSlug/members`
- `/:workspaceSlug/keys`

There are also non-workspace routes such as:

- `/sign-in`
- `/accept-invite`
- `/workspaces`
- `/profile`
- `/docs`

Legacy `/dashboard/:workspaceSlug/...` URLs are redirected to the current structure.

## Quick Start

1. Install dependencies

```bash
bun install
```

2. Create `.env.local`

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

3. Start Convex

```bash
bun run convex:dev
```

4. Start Next.js

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Application env in `.env.local`:

- `NEXT_PUBLIC_APP_URL`: public app URL for local/dev usage
- `NEXT_PUBLIC_CONVEX_URL`: Convex client URL used by the frontend
- `CONVEX_SITE_URL`: Convex site domain used by auth config
- `AUTH_GOOGLE_ID`: Google OAuth client ID
- `AUTH_GOOGLE_SECRET`: Google OAuth client secret
- `RESEND_API_KEY`: optional, only needed for email sending flows

Convex deployment env should also include:

- `SITE_URL`: app URL for the deployment environment
- `JWT_PRIVATE_KEY`
- `JWKS`

## Scripts

- `bun run dev`: start the Next.js dev server
- `bun run start`: start the production server
- `bun run lint`: run ESLint
- `bun run convex:codegen`: generate `convex/_generated`
- `bun run convex:dev`: run Convex in development/watch mode
- `bun run convex:deploy`: deploy Convex functions/schema

`postinstall` runs Convex codegen automatically, which is required because `convex/_generated` is not committed.

## Media

Media uploads use Convex storage. Media records store `storageId`, and the app resolves file URLs from Convex storage when rendering the media library or editor image picker.

## Public API

The currently implemented public API is:

- `GET /api/public/v1/{API_KEY}/posts`
- `GET /api/public/v1/{API_KEY}/posts/{postSlug}`
- `GET /api/public/v1/{API_KEY}/authors`
- `GET /api/public/v1/{API_KEY}/categories`
- `GET /api/public/v1/{API_KEY}/tags`
- `GET /api/public/v1/{API_KEY}/stats`

The API key is part of the path and identifies the workspace for public reads.

Only posts with `status = "published"` are returned.
Post payloads also include `thumbnailUrl` when a thumbnail is set, plus `readingTimeMinutes`, estimated from text plus rich-content signals like images and code blocks.

## Notes

- This repository no longer uses the old Express/Vite monorepo structure.
- The active application lives at the repository root.
- Deployments should install with Bun so `postinstall` and Convex codegen run correctly.

## License

Distributed under the MIT License. See `LICENSE` for details.
