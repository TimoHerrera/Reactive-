import { describe, expect, it } from "vitest";
import { parseYouTubeUrl, youTubeEmbedUrl } from "./youtube";

const ID = "abcDEF12345";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, false],
    [`https://youtube.com/watch?v=${ID}&t=30s`, false],
    [`https://m.youtube.com/watch?v=${ID}`, false],
    [`https://youtu.be/${ID}?si=xyz`, false],
    [`https://www.youtube.com/shorts/${ID}`, true],
    [`https://www.youtube.com/embed/${ID}`, false],
    [`youtube.com/watch?v=${ID}`, false],
  ])("acepta %s", (url, isShort) => {
    expect(parseYouTubeUrl(url)).toEqual({ id: ID, isShort });
  });

  it.each([
    "",
    "hola",
    "https://www.instagram.com/reel/abc",
    "https://vimeo.com/123456",
    "https://www.youtube.com/watch?v=corto",
    "https://www.youtube.com/@reactive",
  ])("rechaza %s", (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });

  it("arma el embed nocookie", () => {
    expect(youTubeEmbedUrl({ id: ID, isShort: false })).toContain(`youtube-nocookie.com/embed/${ID}`);
  });
});
