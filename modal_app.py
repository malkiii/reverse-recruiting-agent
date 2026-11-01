"""Thin Modal wrapper. All logic stays in TypeScript, see src/functions/cli.ts."""

import json
import os
import subprocess

import modal

APP_DIR = "/app"
CLI = ["npx", "tsx", "src/functions/cli.ts"]

image = modal.Image.from_dockerfile("Dockerfile", add_python="3.12").pip_install("fastapi[standard]")
secrets = [modal.Secret.from_name("reverse-recruiting-agent")]
app = modal.App("reverse-recruiting-agent", image=image, secrets=secrets)


@app.function(timeout=60)
def noop(run_id: int):
    subprocess.run([*CLI, "run", "noop", str(run_id)], cwd=APP_DIR, check=True)


@app.function()
@modal.asgi_app()
def web():
    from fastapi import FastAPI, Header
    from fastapi.responses import JSONResponse

    api = FastAPI()

    @api.post("/functions/noop")
    def start_noop(authorization: str | None = Header(default=None)):
        env = {**os.environ, "FUNCTION_AUTHORIZATION": authorization or ""}
        output = subprocess.run(
            [*CLI, "accept", "noop"], cwd=APP_DIR, env=env, check=True, stdout=subprocess.PIPE, text=True
        ).stdout
        result = json.loads(output.strip().splitlines()[-1])
        if result["status"] == 202:
            noop.spawn(result["runId"])
        return JSONResponse(result, status_code=result["status"])

    return api
