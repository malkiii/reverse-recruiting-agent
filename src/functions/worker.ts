import { createServer } from "node:http";
import { acceptFunctionRequest } from "./accept-function-request";
import { functions, functionServices } from "./index";
import { runFunction } from "./run-function";

const PORT = 8000;

const services = functionServices();

const server = createServer(async (request, response) => {
  const functionName = request.url?.match(/^\/functions\/([\w-]+)$/)?.[1];
  const work = functionName ? functions.get(functionName) : undefined;
  if (request.method !== "POST" || !functionName || !work) {
    response.writeHead(404).end();
    return;
  }

  try {
    const result = await acceptFunctionRequest(
      { functionName, authorization: request.headers.authorization },
      { ...services, start: (runId) => runFunction(runId, work, services).catch(console.error) },
    );
    response.writeHead(result.status, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

server.listen(PORT, () => console.log(`Worker listening on port ${PORT}`));
