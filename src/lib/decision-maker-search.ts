import { apifyTokenRouter } from "./apify-tokens";
import type {
  ActorGateway,
  ActorRunStore,
  ApplicationActorRun,
  DecisionMakerStore,
  EmailsActor,
  EmployeesActor,
  FoundPerson,
  SkippedApifyTokenStore,
} from "./gateways";
import type { JobFunction } from "./schema";

/** The most Decision Makers one Application has, and how many people each employees run asks for. */
export const DECISION_MAKERS_PER_APPLICATION = 4;

/** Human Resources, Entrepreneurship, Operations, Product Management, then Program & Project Management. */
const FUNCTION_ORDER: JobFunction[] = ["12", "9", "18", "19", "20"];
const POLL_DELAY_MS = 10_000;
// 20 minutes, well inside prepare-application's time limit with the earlier steps. A Retry resumes the run still going.
const MAX_POLLS = 120;

export type DecisionMakerSearchDeps = {
  employeesActor: EmployeesActor;
  emailsActor: EmailsActor;
  actorRuns: ActorRunStore;
  decisionMakers: DecisionMakerStore;
  apifyTokens: string;
  skippedApifyTokens: SkippedApifyTokenStore;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
};

type SearchedCompany = { id: number; linkedinUrl: string };

const nameKey = (name: string) => name.trim().toLowerCase();

/** A LinkedIn profile URL for matching: without protocol, www, query or trailing slash, ignoring case. */
const profileKey = (url: string) =>
  url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");

/**
 * Runs the Application's actors one at a time. Each run is saved before polling, so a Retry polls and rereads
 * the same run instead of paying for another, and starts again only a run that failed.
 */
async function actorRunner(deps: DecisionMakerSearchDeps, applicationId: number) {
  const saved = await deps.actorRuns.listForApplication(applicationId);
  const router = apifyTokenRouter({
    apifyTokens: deps.apifyTokens,
    skippedTokens: deps.skippedApifyTokens,
    lastToken: () => deps.actorRuns.lastToken(),
    now: deps.now,
  });
  let pollsLeft = MAX_POLLS;

  return async function run<Input, Result>(gateway: ActorGateway<Input, Result>, purpose: string, input: Input) {
    let run = saved.findLast((run) => run.purpose === purpose);
    if (run) {
      console.log(`Application ${applicationId}: resuming actor run ${run.runId} (${purpose})`);
    } else {
      const { token, result: runId } = await router.withToken((token) => gateway.start(input, token));
      const started: ApplicationActorRun = {
        runId,
        actor: gateway.actor,
        token,
        search: null,
        applicationId,
        purpose,
        startedAt: deps.now(),
      };
      await deps.actorRuns.save(started);
      run = started;
      console.log(`Application ${applicationId}: started actor run ${runId} (${purpose})`);
    }

    let status = await gateway.status(run);
    while (status === "running") {
      if (pollsLeft === 0) throw new Error(`Actor run ${run.runId} (${purpose}) is still running: Retry to resume it`);
      pollsLeft -= 1;
      await deps.sleep(POLL_DELAY_MS);
      status = await gateway.status(run);
    }
    if (status === "failed") {
      await deps.actorRuns.close(run.runId, deps.now());
      throw new Error(`Actor run ${run.runId} (${purpose}) failed: Retry to start it again`);
    }
    return gateway.results(run);
  };
}

/**
 * Finds up to 4 Decision Makers with emails, function by function, and saves everyone found to the Company,
 * including those with no email. Emails are looked up only for as many people as are still needed. "any" is
 * searched only when nobody with an email was found. Returns the Application's Decision Makers, none for No Contacts.
 */
export async function findDecisionMakers(
  deps: DecisionMakerSearchDeps,
  applicationId: number,
  company: SearchedCompany,
) {
  const run = await actorRunner(deps, applicationId);
  const found: FoundPerson[] = [];
  const withEmail = () => found.filter(({ email }) => email).length;

  async function search(jobFunction: JobFunction) {
    const employees = await run(deps.employeesActor, `employees:${jobFunction}`, {
      companyUrl: company.linkedinUrl,
      jobFunction,
      maxEmployees: DECISION_MAKERS_PER_APPLICATION,
    });
    const people: FoundPerson[] = [];
    for (const employee of employees) {
      const key = nameKey(employee.name);
      if (!key || [...found, ...people].some(({ name }) => nameKey(name) === key)) continue;
      people.push({ ...employee, name: employee.name.trim(), email: null, jobFunction });
    }
    found.push(...people);

    const lookUp = people.slice(0, DECISION_MAKERS_PER_APPLICATION - withEmail());
    if (lookUp.length > 0) {
      const emails = await run(
        deps.emailsActor,
        `emails:${jobFunction}`,
        lookUp.map(({ profileUrl }) => profileUrl),
      );
      for (const person of lookUp) {
        person.email =
          emails.find(({ profileUrl }) => profileKey(profileUrl) === profileKey(person.profileUrl))?.email ?? null;
      }
    }
    console.log(
      `Application ${applicationId}: function ${jobFunction} found ${people.length} new people, ${withEmail()} with emails so far`,
    );
  }

  for (const jobFunction of FUNCTION_ORDER) {
    if (withEmail() >= DECISION_MAKERS_PER_APPLICATION) break;
    await search(jobFunction);
  }
  if (withEmail() === 0) await search("any");

  const saved = await deps.decisionMakers.save(company.id, found, deps.now());
  const chosen = saved.filter(({ email }) => email);
  if (chosen.length > 0)
    await deps.decisionMakers.addToApplication(
      applicationId,
      chosen.map(({ id }) => id),
    );
  return chosen;
}
