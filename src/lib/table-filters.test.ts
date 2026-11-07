import { expect, test } from "vitest";
import {
  filterApplications,
  hasJobFilters,
  paginate,
  parseJobFilters,
  parsePage,
  PAGE_SIZE,
  withParams,
} from "./table-filters";

test("Job filters come from the URL, with unknown values dropped", () => {
  expect(parseJobFilters({ q: " engineer ", source: ["LinkedIn", "LinkedIn", ""], application: "nope" })).toEqual({
    q: "engineer",
    sources: ["LinkedIn"],
    location: "",
    application: "any",
    company: "",
  });
  expect(parseJobFilters({ source: "Glassdoor", application: "none" })).toMatchObject({
    sources: ["Glassdoor"],
    application: "none",
  });
  expect(hasJobFilters(parseJobFilters({}))).toBe(false);
  expect(hasJobFilters(parseJobFilters({ company: "Acme" }))).toBe(true);
});

test("A missing or bad page is page 1", () => {
  expect(parsePage(undefined)).toBe(1);
  expect(parsePage("0")).toBe(1);
  expect(parsePage("2.5")).toBe(1);
  expect(parsePage("abc")).toBe(1);
  expect(parsePage("3")).toBe(3);
});

test("Pagination shows the last page for a page past it", () => {
  const rows = Array.from({ length: PAGE_SIZE + 3 }, (_, index) => index);
  expect(paginate(rows, 1)).toMatchObject({ page: 1, pages: 2 });
  expect(paginate(rows, 9)).toEqual({ rows: [PAGE_SIZE, PAGE_SIZE + 1, PAGE_SIZE + 2], page: 2, pages: 2 });
  expect(paginate([], 4)).toEqual({ rows: [], page: 1, pages: 1 });
});

test("Applications match the search on title or Company, and the location, ignoring case", () => {
  const rows = [
    { jobTitle: "Frontend Engineer", companyName: "Acme", jobLocation: "Berlin, Germany" },
    { jobTitle: "Designer", companyName: "Engine Co", jobLocation: "Remote" },
  ];
  expect(filterApplications(rows, { q: "engine", location: "" })).toHaveLength(2);
  expect(filterApplications(rows, { q: "engine", location: "berlin" })).toEqual([rows[0]]);
  expect(filterApplications(rows, { q: "", location: "" })).toEqual(rows);
});

test("Links leave out empty params and repeat arrays", () => {
  expect(withParams("/jobs", { q: "", source: ["LinkedIn", "Glassdoor"], page: undefined })).toBe(
    "/jobs?source=LinkedIn&source=Glassdoor",
  );
  expect(withParams("/jobs", {})).toBe("/jobs");
});
