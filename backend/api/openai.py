from fastapi import APIRouter, Request
import os
import openai

router = APIRouter()

openai.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")

@router.post("/api/openai")
async def ask_openai(request: Request):
    body = await request.json()
    prompt = body.get("prompt")
    if not prompt:
        return {"error": "prompt required"}
    try:
        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
        )
        result = response.choices[0].message.get("content", "")
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}
