# CORS Proxy on Vercel

Deploy your own CORS proxy using Vercel Serverless Functions.

## Deploy

1. Create a GitHub repo and add these files.
2. Import the repo into [Vercel](https://vercel.com) and deploy.
3. (Optional) Set environment variable `ALLOWLIST` with a comma-separated list of hostnames to allow, e.g. `api.publicapis.org,example.com`.

## Usage

**GET JSON example**
```
https://<your-project>.vercel.app/api/proxy?url=https%3A%2F%2Fapi.publicapis.org%2Fentries
```

**Pass custom headers to the upstream** (base64 JSON in `h64`):
```
# {"Authorization":"Bearer <token>"}
h64=eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyIDx0b2tlbj4ifQ==
https://<your-project>.vercel.app/api/proxy?url=<ENCODED_URL>&h64=<BASE64_JSON>
```

**POST with body** (from your frontend)
```html
<script>
const proxy = 'https://<your-project>.vercel.app/api/proxy?url=';
const target = 'https://httpbin.org/post';

async function send() {
  const r = await fetch(proxy + encodeURIComponent(target), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({hello:'world'})
  });
  const data = await r.json();
  console.log(data);
}
</script>
```

## Notes

- Handles preflight `OPTIONS` automatically with permissive CORS.
- Streams the upstream response, so it works with JSON, text, images, etc.
- If a site still blocks you, it might be using additional anti-bot or origin checks server-side that a plain proxy can't bypass.
