"""Thin Modal wrapper. All logic stays in TypeScript, see src/functions/cli.ts."""

import json
import os
import subprocess

import modal

APP_DIR = "/app"
CLI = ["npx", "tsx", "src/functions/cli.ts"]
COLLECT_JOBS_TIMEOUT = 30 * 60  # COLLECTION_TIME_LIMIT_MS in src/lib/job-collection.ts

image = modal.Image.from_dockerfile("Dockerfile", add_python="3.12").pip_install("fastapi[standard]")
secrets = [modal.Secret.from_name("reverse-recruiting-agent")]
app = modal.App("reverse-recruiting-agent", image=image, secrets=secrets)


@app.function(timeout=60)
def noop(run_id: int):
    subprocess.run([*CLI, "run", "noop", str(run_id)], cwd=APP_DIR, check=True)


@app.function(timeout=COLLECT_JOBS_TIMEOUT)
def collect_jobs(run_id: int):
    subprocess.run([*CLI, "run", "collect-jobs", str(run_id)], cwd=APP_DIR, check=True)


# Late in the UTC day, because Job Collection keeps only Jobs posted today.
@app.function(timeout=COLLECT_JOBS_TIMEOUT, schedule=modal.Cron("0 22 * * *"))
def scheduled_collect_jobs():
    subprocess.run([*CLI, "scheduled", "collect-jobs"], cwd=APP_DIR, check=True)


@app.function()
@modal.asgi_app()
def web():
    from fastapi import FastAPI, Header
    from fastapi.responses import JSONResponse

    api = FastAPI()

    def accept(function_name: str, function: modal.Function, authorization: str | None):
        env = {**os.environ, "FUNCTION_AUTHORIZATION": authorization or ""}
        output = subprocess.run(
            [*CLI, "accept", function_name], cwd=APP_DIR, env=env, check=True, stdout=subprocess.PIPE, text=True
        ).stdout
        result = json.loads(output.strip().splitlines()[-1])
        if result["status"] == 202:
            function.spawn(result["runId"])
        return JSONResponse(result, status_code=result["status"])

    @api.post("/functions/noop")
    def start_noop(authorization: str | None = Header(default=None)):
        return accept("noop", noop, authorization)

    @api.post("/functions/collect-jobs")
    def start_collect_jobs(authorization: str | None = Header(default=None)):
        return accept("collect-jobs", collect_jobs, authorization)

    return api
