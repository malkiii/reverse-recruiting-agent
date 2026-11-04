import { createServer, type IncomingMessage } from "node:http";
import { acceptFunctionRequest, parseRequestBody } from "./accept-function-request";
import { functions, functionServices } from "./index";
import { runFunction } from "./run-function";

const PORT = 8000;

const services = functionServices();

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return parseRequestBody(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const functionName = request.url?.match(/^\/functions\/([\w-]+)$/)?.[1];
  const definition = functionName ? functions.get(functionName) : undefined;
  if (request.method !== "POST" || !functionName || !definition) {
    response.writeHead(404).end();
    return;
  }

  try {
    const { claim } = definition;
    const result = await acceptFunctionRequest(
      {
        functionName,
        timeLimitMs: definition.timeLimitMs,
        authorization: request.headers.authorization,
        body: await readBody(request),
      },
      {
        ...services,
        claim: claim && ((body) => claim(services, body)),
        start: (runId, applicationId) =>
          runFunction(runId, functionName, () => definition.work(services, applicationId), services).catch(
            console.error,
          ),
      },
    );
    response.writeHead(result.status, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

server.listen(PORT, () => console.log(`Worker listening on port ${PORT}`));
