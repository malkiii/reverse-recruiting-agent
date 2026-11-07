import Link from "next/link";
import { buttonClass } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card, CardBody, CardHeader, ExternalLink, inputClass, labelClass, PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardGoogle } from "@/lib/dashboard-google";
import type { DriveFile, DriveFolder, DriveGateway } from "@/lib/gateways";
import { GoogleConnectionError } from "@/lib/google-connection";
import { resumesIn } from "@/lib/resumes";

async function chooseFolder(formData: FormData) {
  "use server";

  const google = dashboardGoogle();
  const id = String(formData.get("folderId"));
  // Looked up again rather than trusted from the form, so only one of the Admin's folders can be saved.
  const drive = await google.drive();
  const folder = (await drive.listFolders()).find((folder) => folder.id === id);
  if (!folder) throw new Error(`Not one of your Drive folders: ${id}`);
  await google.resumeFolder.save(folder);
  redirect("/google");
}

function FolderChooser({ folders, current }: { folders: DriveFolder[]; current?: DriveFolder }) {
  if (folders.length === 0)
    return <Alert tone="warning">Your Google Drive has no folders. Create one for your Resumes first.</Alert>;
  return (
    <form action={chooseFolder} className="space-y-3">
      <label className="block">
        <span className={labelClass}>Resume Folder</span>
        <select name="folderId" defaultValue={current?.id} required className={inputClass}>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

async function ResumeFolder({ drive, folder }: { drive: DriveGateway; folder: DriveFolder }) {
  const [files, shared] = await Promise.all([drive.listFiles(folder.id), drive.isSharedByLink(folder.id)]);
  const resumes = resumesIn(files);
  const others = files.filter((file) => !resumes.includes(file));

  return (
    <>
      <Card>
        <CardHeader
          title={<>Resume Folder: {folder.name}</>}
          action={
            <Link href="/google?change=1" className={buttonClass("ghost")}>
              Change
            </Link>
          }
        />
        <CardBody className="space-y-3">
          {!shared && (
            <Alert tone="warning">
              This folder isn&apos;t shared as &quot;Anyone with the link&quot;, so recipients can&apos;t open your
              Resume links. Share it in Google Drive.
            </Alert>
          )}
          <p className="text-sm text-muted">
            Resumes are PDFs whose names end in &quot;resume&quot; or &quot;CV&quot;, in any case.
          </p>
        </CardBody>
        <FileList files={resumes} empty="No Resumes in this folder." />
      </Card>
      {others.length > 0 && (
        <Card>
          <CardHeader title="Other files" />
          <CardBody>
            <p className="text-sm text-muted">These aren&apos;t Resumes, so they&apos;re never sent.</p>
          </CardBody>
          <FileList files={others} empty="" />
        </Card>
      )}
    </>
  );
}

function FileList({ files, empty }: { files: DriveFile[]; empty: string }) {
  if (files.length === 0)
    return empty ? <p className="px-4 pb-4 text-sm text-muted">{empty}</p> : null;
  return (
    <ul className="divide-y divide-line border-t border-line">
      {files.map((file) => (
        <li key={file.id}>
          <ExternalLink href={file.webViewLink} className="block truncate px-4 py-3 text-sm font-medium hover:bg-subtle">
            {file.name}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

export default async function GooglePage({ searchParams }: { searchParams: Promise<{ error?: string; change?: string }> }) {
  await connection();
  const { error, change } = await searchParams;
  const google = dashboardGoogle();

  let drive: DriveGateway | undefined;
  let connectionProblem: string | undefined;
  try {
    drive = await google.drive();
  } catch (problem) {
    if (!(problem instanceof GoogleConnectionError)) throw problem;
    connectionProblem = problem.message;
  }
  const folder = await google.resumeFolder.get();

  return (
    <div className="space-y-4">
      <Link href="/settings" className="inline-flex min-h-9 items-center text-sm text-muted hover:text-fg">
        ‹ Settings
      </Link>
      <PageHeader title="Google" />
      {error && <Alert>{error}</Alert>}

      {!drive ? (
        <Card>
          <CardBody className="space-y-3">
            {connectionProblem && <Alert tone="warning">{connectionProblem}</Alert>}
            <p className="text-sm">
              The agent sends Applications from your Gmail and reads your Resumes from one Google Drive folder.
            </p>
            <a href="/google/connect" className={buttonClass("primary")}>
              Connect Google
            </a>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> Google is connected
              </p>
              <a href="/google/connect" className={buttonClass("ghost")}>
                Reconnect
              </a>
            </CardBody>
          </Card>
          {!folder || change ? (
            <Card>
              <CardHeader title="Choose your Resume Folder" />
              <CardBody>
                <p className="mb-3 text-sm text-muted">
                  Choose the Google Drive folder that holds your Resumes.
                </p>
                <FolderChooser folders={await drive.listFolders()} current={folder} />
              </CardBody>
            </Card>
          ) : (
            <ResumeFolder drive={drive} folder={folder} />
          )}
        </>
      )}
    </div>
  );
}
