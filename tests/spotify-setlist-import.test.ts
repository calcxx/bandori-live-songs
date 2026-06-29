import { describe, expect, it } from "vitest";
import { parseSpotifyEmbedPage, parseSpotifyResource } from "@/lib/spotify/setlist-import";

function buildSpotifyEmbedFixture(entity: unknown) {
  return `
    <html>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
          ${JSON.stringify({
            props: {
              pageProps: {
                state: {
                  data: {
                    entity,
                  },
                },
              },
            },
          })}
        </script>
      </body>
    </html>
  `;
}

describe("parseSpotifyResource", () => {
  it("accepts playlist, album, track and embed URLs", () => {
    expect(parseSpotifyResource("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=test")).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
    expect(parseSpotifyResource("https://open.spotify.com/intl-ja/playlist/37i9dQZF1DXcBWIGoYBM5M")).toEqual({
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    });
    expect(parseSpotifyResource("https://open.spotify.com/embed/album/4aawyAB9vmqN3uQ7FjRGTy")).toEqual({
      type: "album",
      id: "4aawyAB9vmqN3uQ7FjRGTy",
    });
    expect(parseSpotifyResource("spotify:track:4EoJ151oQ5jY48z4RhSE96")).toEqual({
      type: "track",
      id: "4EoJ151oQ5jY48z4RhSE96",
    });
  });

  it("rejects unsupported Spotify resources", () => {
    expect(parseSpotifyResource("https://open.spotify.com/artist/1234567890")).toBeNull();
    expect(parseSpotifyResource("https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBeNull();
  });
});

describe("parseSpotifyEmbedPage", () => {
  it("extracts playlist track titles in order", () => {
    const html = buildSpotifyEmbedFixture({
      type: "playlist",
      title: "BanG Dream! setlist",
      trackList: [
        { title: "迷星叫" },
        { title: "影色舞" },
        { title: "" },
      ],
    });

    expect(parseSpotifyEmbedPage(html, "playlist")).toEqual({
      sourceTitle: "BanG Dream! setlist",
      resourceType: "playlist",
      tracks: ["迷星叫", "影色舞"],
    });
  });

  it("uses the track title for single track links", () => {
    const html = buildSpotifyEmbedFixture({
      type: "track",
      title: "Takin' my Heart",
    });

    expect(parseSpotifyEmbedPage(html, "track")).toEqual({
      sourceTitle: "Takin' my Heart",
      resourceType: "track",
      tracks: ["Takin' my Heart"],
    });
  });

  it("fails when Spotify changes the embedded data shape", () => {
    expect(() => parseSpotifyEmbedPage("<html></html>", "playlist")).toThrow("未找到曲目数据");
  });
});
