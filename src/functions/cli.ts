import { acceptFunctionRequest } from "./accept-function-request";
import { functions, functionServices } from "./index";
import { runFunction } from "./run-function";

/**
 * The entry points the Python wrapper in modal_app.py runs in Node:
 *   accept <function>, with the Authorization header in FUNCTION_AUTHORIZATION, prints the response as JSON.
 *   run <function> <runId> does the work and records how it ended.
 */
async function main() {
  const [command, functionName, runId] = process.argv.slice(2);

  const work = functions.get(functionName);
  if (!work) throw new Error(`Unknown Function: ${functionName}`);

  const services = functionServices();

  if (command === "accept") {
    const authorization = process.env.FUNCTION_AUTHORIZATION;
    // Modal spawns the Function once this returns, so there is nothing to start here.
    const result = await acceptFunctionRequest({ functionName, authorization }, { ...services, start: () => {} });
    console.log(JSON.stringify(result));
  } else if (command === "run") {
    await runFunction(Number(runId), work, services);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
