# GridWise LLM — campus energy optimizer

**Docker fallback** for the live API:

**https://orizon-jet.vercel.app**

Pipeline: operator notes → Mistral (`mistral-small-latest`) → guardrails → 24-hour LP optimizer → schedule validator.

## Endpoints

- `GET /health` → `{"status":"ok"}`
- `POST /optimize-energy` (no auth)

## Run

```bash
docker pull javaman12/gridwise-llm:latest
docker run --rm -p 3000:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e MISTRAL_API_KEY \
  javaman12/gridwise-llm:latest

curl -s http://127.0.0.1:3000/health
```

Pass API keys at runtime. Do not bake secrets into the image.

Source: https://github.com/Zul-Qarnain/orizon
