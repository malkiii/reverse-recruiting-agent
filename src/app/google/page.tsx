import Link from "next/link";
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
  if (folders.length === 0) return <p>Your Google Drive has no folders. Create one for your Resumes first.</p>;
  return (
    <form action={chooseFolder}>
      <label>
        Resume Folder{" "}
        <select name="folderId" defaultValue={current?.id} required>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="submit">Save</button>
    </form>
  );
}

async function ResumeFolder({ drive, folder }: { drive: DriveGateway; folder: DriveFolder }) {
  const [files, shared] = await Promise.all([drive.listFiles(folder.id), drive.isSharedByLink(folder.id)]);
  const resumes = resumesIn(files);
  const others = files.filter((file) => !resumes.includes(file));

  return (
    <>
      <p>
        Resume Folder: <strong>{folder.name}</strong> <Link href="/google?change=1">Change</Link>
      </p>
      {!shared && (
        <p role="alert">
          This folder isn&apos;t shared as &quot;Anyone with the link&quot;, so recipients can&apos;t open your
          Resume links. Share it in Google Drive.
        </p>
      )}
      <h2>Resumes</h2>
      <p>PDFs whose names end in &quot;resume&quot; or &quot;CV&quot;, in any case.</p>
      <FileList files={resumes} empty="No Resumes in this folder." />
      {others.length > 0 && (
        <>
          <h2>Other files</h2>
          <p>These aren&apos;t Resumes, so they&apos;re never sent.</p>
          <FileList files={others} empty="" />
        </>
      )}
    </>
  );
}

function FileList({ files, empty }: { files: DriveFile[]; empty: string }) {
  if (files.length === 0) return <p>{empty}</p>;
  return (
    <ul>
      {files.map((file) => (
        <li key={file.id}>
          <a href={file.webViewLink}>{file.name}</a>
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
    <main>
      <h1>Google</h1>
      <nav>
        <Link href="/jobs">Jobs</Link> <Link href="/settings">Settings</Link>
      </nav>
      {error && <p role="alert">{error}</p>}

      {!drive ? (
        <>
          <p>{connectionProblem}</p>
          <p>The agent sends Applications from your Gmail and reads your Resumes from one Google Drive folder.</p>
          <p>
            <a href="/google/connect">Connect Google</a>
          </p>
        </>
      ) : (
        <>
          <p>
            Google is connected. <a href="/google/connect">Reconnect</a>
          </p>
          {!folder || change ? (
            <>
              <p>Choose the Google Drive folder that holds your Resumes.</p>
              <FolderChooser folders={await drive.listFolders()} current={folder} />
            </>
          ) : (
            <ResumeFolder drive={drive} folder={folder} />
          )}
        </>
      )}
    </main>
  );
}
