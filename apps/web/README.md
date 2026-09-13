# Digital Business Platform — web

Next.js (TypeScript) app for POS and back-office. Package manager: **Bun**. Hosted on **Vercel**: https://srd-biz.vercel.app

```bash
bun install
bun run dev
```

Talks only to FastAPI (`NEXT_PUBLIC_API_URL`), not directly to Supabase for business operations.
