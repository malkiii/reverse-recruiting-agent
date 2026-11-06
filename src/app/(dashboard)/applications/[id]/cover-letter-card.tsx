"use client";

import { useState } from "react";
import { buttonClass } from "@/components/button";
import { SubmitButton } from "@/components/submit-button";
import type { DriveFile } from "@/lib/gateways";

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:text-sm";

/** The Cover Letter, read-only until the Admin taps Edit while it's In Review, which swaps in the form in place. */
export function CoverLetterCard({
  applicationId,
  subject,
  coverLetter,
  resumeFileId,
  resumes,
  editable,
  save,
}: {
  applicationId: number;
  subject: string;
  coverLetter: string;
  resumeFileId: string | null;
  resumes: DriveFile[];
  editable: boolean;
  save: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 md:rounded-xl">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Cover Letter</h2>
        {editable && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost")}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={save} className="space-y-4 px-4 py-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="currentResumeFileId" value={resumeFileId ?? ""} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Resume</span>
            <select name="resumeFileId" defaultValue={resumeFileId ?? undefined} className={inputClass}>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Subject</span>
            <input name="subject" defaultValue={subject} required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Cover Letter</span>
            <textarea
              name="coverLetter"
              defaultValue={coverLetter}
              required
              rows={14}
              className={`${inputClass} font-mono leading-relaxed`}
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Keep <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{{name}}"}</code> in the first line and
            end with <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{{resume_link}}"}</code>.
          </p>
          <div className="flex gap-2">
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("secondary")}>
              Discard
            </button>
          </div>
        </form>
      ) : (
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Subject</p>
          <p className="mb-4 font-medium">{subject}</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{coverLetter}</div>
        </div>
      )}
    </section>
  );
}
