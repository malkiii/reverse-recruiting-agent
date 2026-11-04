import { expect, test } from "vitest";
import { ogImageUrl } from "./images";

const page = "https://jobs.example.com/jobs/1";

test("a page's og:image is read whatever the attribute order, and made absolute", () => {
  expect(ogImageUrl(`<meta property="og:image" content="https://cdn.example.com/a.png">`, page)).toBe(
    "https://cdn.example.com/a.png",
  );
  expect(ogImageUrl(`<meta content='/img/b.png?x=1&amp;y=2' name="og:image" />`, page)).toBe(
    "https://jobs.example.com/img/b.png?x=1&y=2",
  );
});

test("a page with no og:image has none", () => {
  expect(ogImageUrl(`<meta property="og:title" content="Engineer"><img src="/c.png">`, page)).toBeNull();
});
