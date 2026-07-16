// api/status.js
// Deploy this on Vercel. It becomes reachable at:
//   https://<your-project>.vercel.app/api/status
//
// On every request it checks whether GitHub user "adijad" has pushed
// any commits recently, then 302-redirects to the matching GIF hosted
// in the adijad/adijad repo's assets/ folder.

const GITHUB_USERNAME = "adijad";
const ACTIVE_WINDOW_HOURS = 24; // "recently committed" = within this many hours

const WORKING_GIF =
  // "https://raw.githubusercontent.com/adijad/adijad/main/assets/working_combo.webp";
  "https://raw.githubusercontent.com/adijad/adijad/main/assets/working_reel_combined.webp";
const RESTING_GIF =
  "https://raw.githubusercontent.com/adijad/adijad/main/assets/resting_combo.webp";

export default async function handler(req, res) {
  try {
    const hasRecentCommit = await checkRecentCommits(
      GITHUB_USERNAME,
      ACTIVE_WINDOW_HOURS
    );

    const target = hasRecentCommit ? WORKING_GIF : RESTING_GIF;

    // Cache for a couple hours at the edge so we don't hammer the GitHub API
    // on every single profile view, while still staying reasonably "live".
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=7200");
    res.writeHead(302, { Location: target });
    res.end();
  } catch (err) {
    // If anything goes wrong (rate limit, network hiccup), fail safe
    // by showing the working GIF rather than a broken image.
    res.writeHead(302, { Location: WORKING_GIF });
    res.end();
  }
}

async function checkRecentCommits(username, windowHours) {
  // Public events endpoint — no auth token needed for public activity.
  const resp = await fetch(
    `https://api.github.com/users/${username}/events/public?per_page=30`,
    {
      headers: {
        "User-Agent": "profile-status-checker",
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!resp.ok) {
    throw new Error(`GitHub API returned ${resp.status}`);
  }

  const events = await resp.json();
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;

  return events.some((event) => {
    if (event.type !== "PushEvent") return false;
    const eventTime = new Date(event.created_at).getTime();
    return eventTime >= cutoff;
  });
}
