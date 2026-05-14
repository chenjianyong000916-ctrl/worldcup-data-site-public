/* 世界杯数据分析助手 - 统一数据联动稳定版 */

const EMPTY = "暂无可靠数据";

document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();

  const teams = await loadCsv("data/teams.csv");
  const matches = await loadCsv("data/matches.csv");

  console.log("✅ 数据已接入：", {
    teams: teams.length,
    matches: matches.length,
  });

  if (page === "index") renderProductHomeV2(teams, matches);
  if (page === "team") renderTeam(teams, matches);
  if (page === "match") renderMatch(teams, matches);
  if (page === "vip") renderVip(teams, matches);
  if (page === "group") renderGroupPageV1(teams, matches);
});

/* ---------- 基础工具 ---------- */

function getPageName() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  if (file.includes("group")) return "group";
  if (file.includes("team")) return "team";
  if (file.includes("match")) return "match";
  if (file.includes("vip")) return "vip";
  return "index";
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function safe(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return EMPTY;
  }
  return String(value).trim();
}

async function loadCsv(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const text = await res.text();
    return parseCsv(text);
  } catch (err) {
    console.warn("读取失败：", path, err);
    return [];
  }
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(v => clean(v));

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line).map(v => clean(v));
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function clean(value) {
  return String(value || "").replace(/^"|"$/g, "").trim();
}

function first(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && String(obj[key]).trim() !== "") {
      return String(obj[key]).trim();
    }
  }
  return "";
}

function teamId(team) {
  return first(team, ["team_id", "id", "code"]);
}

function teamName(team) {
  return first(team, ["name_zh", "team_name_zh", "name_en", "name", "team_name"]) || EMPTY;
}

function teamElo(team) {
  return first(team, ["elo", "elo_rating", "ELO"]);
}

function findTeam(teams, idOrName) {
  if (!idOrName) return null;
  const target = String(idOrName).trim();

  return teams.find(t => {
    return (
      teamId(t) === target ||
      teamName(t) === target ||
      first(t, ["name_en", "name"]) === target
    );
  }) || null;
}

/* ---------- 首页 ---------- */



function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }

  return fallback;
}
function buildTeamMap(teams) {
  const map = {};

  (teams || []).forEach(t => {
    const code =
      String(
        t.code ||
        t.team_id ||
        t.id ||
        ""
      ).toUpperCase();

    if (!code) return;

    map[code] = {
      code,
      name:
        t.name_zh ||
        t.name ||
        t.name_en ||
        code,
      flag: `https://flagcdn.com/w80/${getFlagCode(code)}.png`
    };
  });

  return map;
}
function renderProductHomeV2(teams, matches) {
  window.allTeams = teams;

  const teamMap = buildTeamMap(teams);
  renderHomeScheduleV2(matches, teamMap);
  renderHomeGroupsV2(teams);
  renderHomeTeamsV2(teams);
  renderHomeCitiesV2(matches);
}

function renderHomeScheduleV2(matches, teamMap = {}) {
  const list = document.querySelector("#home-schedule-list");
  if (!list) return;

  function getStagePlaceholder(currentStage, currentGroup = "") {
    const s = String(currentStage || "").toLowerCase();

    if (s.includes("round of 32") || s.includes("round of 16")) {
      return "小组排名待定";
    }

    if (
      s.includes("quarter") ||
      s.includes("semi") ||
      s.includes("final") ||
      s.includes("third")
    ) {
      return "胜者待定";
    }

          const g = String(currentGroup || "").replace("Group ", "").trim();
      return g ? g + "组球队待定" : "小组球队待定";
  }

  function resolveScheduleSide(rawCode, mappedTeam, fallbackLabel, stage, group) {
    const code = String(rawCode || "").trim().toUpperCase();
    const hasCode = code && code !== "TBD";
    const placeholder = getStagePlaceholder(stage, group || "");

    if (mappedTeam && mappedTeam.name) {
      return {
        name: mappedTeam.name,
        flag: mappedTeam.flag || "",
        flagLabel: mappedTeam.name,
        status: "球队代码已映射"
      };
    }

    if (hasCode) {
      return {
        name: code,
        flag: "",
        flagLabel: code,
        status: "部分球队代码待映射"
      };
    }

    return {
      name: placeholder,
      flag: "",
      flagLabel: "待定",
      status: placeholder
    };
  }

  function mergeStatus(aStatus, bStatus, stage) {
    if (aStatus === "球队代码已映射" && bStatus === "球队代码已映射") {
      return "球队代码已映射";
    }

    if (aStatus === "部分球队代码待映射" || bStatus === "部分球队代码待映射") {
      return "部分球队代码待映射";
    }

        const s = String(stage || "").toLowerCase();
    if (s.includes("matchday")) return "小组参赛队待确认";
    return getStagePlaceholder(stage, "");
  }

  const upcoming = (matches || [])
    .filter(m => m.match_date || m.matchDate)
    .sort((a, b) => ((a.match_date || a.matchDate || "") + (a.kickoff || "")).localeCompare((b.match_date || b.matchDate || "") + (b.kickoff || "")))
    .slice(0, 12);

  list.innerHTML = upcoming.map(m => {
    const date = m.match_date || m.matchDate || EMPTY;
    const kickoff = m.kickoff || EMPTY;
    const stage = m.stage || EMPTY;
    const group = m.group || EMPTY;
    const city = m.city || EMPTY;
    const country = m.country || EMPTY;
    const stadium = m.stadium || EMPTY;
    const rawCodeA = String(pick(m, ["team_a_code", "teamACode", "team_a_id", "teamAId"], "")).toUpperCase();
    const rawCodeB = String(pick(m, ["team_b_code", "teamBCode", "team_b_id", "teamBId"], "")).toUpperCase();

    const mappedA = teamMap[rawCodeA];
    const mappedB = teamMap[rawCodeB];

    const sideA = resolveScheduleSide(rawCodeA, mappedA, "一方", stage, group);
    const sideB = resolveScheduleSide(rawCodeB, mappedB, "另一方", stage, group);

    const teamA = sideA.name;
    const teamB = sideB.name;

    const flagA = sideA.flag;
    const flagB = sideB.flag;

    const statusBadge = mergeStatus(sideA.status, sideB.status, stage);

    return `
      <article class="home-card schedule-poster-card">
        <div class="schedule-meta">
          <span>${stage}${group ? " · " + group : ""}</span>
          <strong>${date}</strong>
        </div>

        <div class="match-vs-row">
          <div class="match-side">
            ${flagA ? `<img class="match-flag-img" src="${flagA}" alt="${teamA} flag">` : `<div class="match-flag-placeholder">${sideA.flagLabel}</div>`}
            <h3>${teamA}</h3>
          </div>

          <div class="vs-badge">VS</div>

          <div class="match-side">
            ${flagB ? `<img class="match-flag-img" src="${flagB}" alt="${teamB} flag">` : `<div class="match-flag-placeholder">${sideB.flagLabel}</div>`}
            <h3>${teamB}</h3>
          </div>
        </div>

        <div class="schedule-status-badge">${statusBadge}</div>
        <div class="schedule-info">
          <p>开球：${kickoff}</p>
          <p>${city}${country ? ", " + country : ""}</p>
          <p>${stadium}</p>
        </div>
      </article>
    `;
  }).join("");
}

function getFlagCode(code) {
  const map = {
    MEX:"mx", RSA:"za", KOR:"kr", CZE:"cz", CAN:"ca", BIH:"ba", QAT:"qa", SUI:"ch",
    HAI:"ht", SCO:"gb-sct", PAR:"py", TUR:"tr",
    ARG:"ar", BRA:"br", FRA:"fr", GER:"de", ESP:"es", POR:"pt", ENG:"gb-eng",
    JPN:"jp", SEN:"sn", URU:"uy", CRO:"hr", COL:"co", MAR:"ma",
    USA:"us", JPN:"jp", AUS:"au", NZL:"nz", ITA:"it", NED:"nl", BEL:"be",
    CRO:"hr", DEN:"dk", POL:"pl", URU:"uy", COL:"co", ECU:"ec", SEN:"sn",
    GHA:"gh", MAR:"ma", TUN:"tn", IRN:"ir", KSA:"sa", NOR:"no", SWE:"se",
    AUT:"at", TUR:"tr", UKR:"ua", CMR:"cm", NGA:"ng", CIV:"ci", EGY:"eg"
  };
  return map[String(code).toUpperCase()] || "un";
}



async function renderHomeGroupsV2(teams) {
  const grid = document.querySelector("#home-groups-grid");
  if (!grid) return;

  window.allTeams = teams;

  const teamMap = buildTeamMap(teams);

  try {
    const response = await fetch("./data/groups.csv?v=" + Date.now());

    if (!response.ok) {
      throw new Error("groups.csv load failed");
    }

    const text = await response.text();

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);

    const headers = lines.shift().split(",");

    const rows = lines.map(line => {
      const cols = line.split(",");
      const obj = {};

      headers.forEach((h, i) => {
        obj[h.trim()] = (cols[i] || "").trim();
      });

      return obj;
    });

    const grouped = {};

    rows.forEach(row => {
      const g = row.group || "X";

      if (!grouped[g]) grouped[g] = [];

      grouped[g].push(row);
    });

    grid.innerHTML = Object.keys(grouped)
      .sort()
      .map(groupName => {

        const teamsHtml = grouped[groupName]
          .sort((a, b) => Number(a.slot) - Number(b.slot))
          .map(row => {

            const code = String(row.team_id || "").toUpperCase();

            const team = teamMap[code];

            const name =
              team?.name ||
              row.team_name ||
              code ||
              "TBD";

            const flag =
              team?.flag ||
              "";

            const status =
              row.status === "confirmed"
                ? "已确认"
                : "待确认";

            return `
              <div class="group-team-row">
                ${
                  flag
                    ? `<img class="group-flag" src="${flag}" alt="${name}">`
                    : `<div class="group-flag-placeholder">?</div>`
                }

                <div class="group-team-info">
                  <strong>${name}</strong>
                  <span>${code}</span>
                </div>

                <em class="${
                  row.status === "confirmed"
                    ? "ok"
                    : "pending"
                }">
                  ${status}
                </em>
              </div>
            `;
          })
          .join("");

        return `
          <article class="group-card-v2">
            <div class="group-card-head">
              <span class="mini-label">
                GROUP ${groupName}
              </span>

              <strong>${groupName} 组</strong>
            </div>

            <div class="group-team-list">
              ${teamsHtml}
            </div>

            <a class="group-detail-link" href="group.html?group=${encodeURIComponent(groupName)}">
              查看 ${groupName} 组详情 →
            </a>
          </article>
        `;
      })
      .join("");

  } catch (err) {

    console.error(err);

    grid.innerHTML = `
      <div class="home-card">
        小组数据读取失败：
        ${err.message}
      </div>
    `;
  }
}

function renderHomeTeamsV2(teams) {
  const grid = document.querySelector("#home-teams-grid");
  if (!grid) return;

  const flagMap = {
    ARG:"🇦🇷", AUS:"🇦🇺", BEL:"🇧🇪", BRA:"🇧🇷", CAN:"🇨🇦", CHI:"🇨🇱", COL:"🇨🇴", CRC:"🇨🇷",
    CRO:"🇭🇷", DEN:"🇩🇰", ECU:"🇪🇨", ENG:"🏴", FRA:"🇫🇷", GER:"🇩🇪", GHA:"🇬🇭", IRN:"🇮🇷",
    ITA:"🇮🇹", JPN:"🇯🇵", KOR:"🇰🇷", MEX:"🇲🇽", MAR:"🇲🇦", NED:"🇳🇱", NZL:"🇳🇿", PAR:"🇵🇾",
    POL:"🇵🇱", POR:"🇵🇹", QAT:"🇶🇦", KSA:"🇸🇦", SCO:"🏴", SEN:"🇸🇳", SRB:"🇷🇸", ESP:"🇪🇸",
    SUI:"🇨🇭", TUN:"🇹🇳", URU:"🇺🇾", USA:"🇺🇸", WAL:"🏴", CMR:"🇨🇲", EGY:"🇪🇬", NGA:"🇳🇬",
    CIV:"🇨🇮", RSA:"🇿🇦", TUR:"🇹🇷", UKR:"🇺🇦", NOR:"🇳🇴", SWE:"🇸🇪", AUT:"🇦🇹", CZE:"🇨🇿"
  };

  const rows = (teams || []).slice(0, 48);

  grid.innerHTML = rows.map(t => {
    const code = t.code || t.team_id || t.id || "";
    const name = t.name_zh || t.name || t.name_en || code || EMPTY;
    const confed = t.confederation || t.confed || EMPTY;
    const href = code ? `team.html?code=${encodeURIComponent(code)}` : "team.html";
    const flag = flagMap[String(code).toUpperCase()] || "🏳️";

    return `
      <a class="home-card home-link-card team-flag-card" href="${href}">
        <div class="team-flag-row">
          <img class="team-flag-img" src="https://flagcdn.com/w80/${getFlagCode(code)}.png" alt="${name} flag" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"> <span class="team-flag-fallback">${flag}</span>
          <span class="mini-label">${code}</span>
        </div>
        <h3>${name}</h3>
        <p>${confed}</p>
      </a>
    `;
  }).join("");
}

function renderHomeCitiesV2(matches) {
  const grid = document.querySelector("#home-cities-grid");
  if (!grid) return;

  const map = new Map();

  (matches || []).forEach(m => {
    const city = m.city || "";
    const stadium = m.stadium || "";
    if (!city && !stadium) return;

    const key = `${city}|${stadium}`;
    if (!map.has(key)) {
      map.set(key, {
        city,
        country: m.country || "",
        stadium,
        count: 0
      });
    }

    map.get(key).count += 1;
  });

  const venues = Array.from(map.values()).slice(0, 16);

  grid.innerHTML = venues.map(v => `
    <article class="home-card city-venue-card">
      <div class="city-card-top">
        <span class="city-icon">🏟️</span>
        <span class="mini-label">${v.country || "HOST CITY"}</span>
      </div>
      <h3>${v.city || EMPTY}</h3>
      <p class="venue-name">${v.stadium || EMPTY}</p>
      <div class="venue-count">已接入 ${v.count} 场比赛</div>
    </article>
  `).join("");
}

async function renderGroupPageV1(teams, matches) {
  const groupCode = (getParam("group") || "A").toUpperCase();
  const title = document.querySelector("#group-page-title");
  const heroCode = document.querySelector("#group-hero-code");
  const teamsPanel = document.querySelector("#group-teams-panel");
  const matchesPanel = document.querySelector("#group-matches-panel");
  const standingsPanel = document.querySelector("#group-standings-panel");

  if (title) title.textContent = `${groupCode} 组详情`;
  if (heroCode) heroCode.textContent = groupCode;

  window.allTeams = teams;

  const teamMap = buildTeamMap(teams);

  try {
    const res = await fetch("./data/groups.csv?v=" + Date.now());

    if (!res.ok) {
      throw new Error("groups.csv load failed");
    }

    const text = await res.text();

    const clean = text.replace(/\r/g, "");

    const lines = clean
      .split("\n")
      .filter(Boolean);

    const headers = lines
      .shift()
      .split(",")
      .map(x => x.trim());

    const groupRows = lines.map(line => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cols[i] || "").trim());
      return obj;
    }).filter(row => String(row.group || "").toUpperCase() === groupCode);

    if (teamsPanel) {
      teamsPanel.innerHTML = groupRows.map(row => {
        const code = String(row.team_id || "").toUpperCase();
        const team = teamMap[code];
        const name = team?.name || row.team_name || code || "TBD";
        const flag = team?.flag || "";
        const status = row.status === "confirmed" ? "已确认" : "待确认";

        return `
          <article class="group-card-v2">
            <div class="group-team-row">
              ${flag ? `<img class="group-flag" src="${flag}" alt="${name}">` : `<div class="group-flag-placeholder">?</div>`}
              <div class="group-team-info">
                <strong>${name}</strong>
                <span>${code}</span>
              </div>
              <em class="${row.status === "confirmed" ? "ok" : "pending"}">${status}</em>
            </div>
          </article>
        `;
      }).join("");
    }

    const groupMatches = (matches || []).filter(m => {
      const g = String(pick(m, ["group"], "")).toUpperCase();
      return g === groupCode || g === ("GROUP " + groupCode);
    });

    if (standingsPanel) {
      const standingsTeams = groupRows
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
        .map((row, index) => {
          const code = String(row.team_id || "").toUpperCase();
          const team = teamMap[code];

          return {
            rank: index + 1,
            code,
            name: team?.name || row.team_name || code || "TBD",
            flag: team?.flag || "",
            played: 0,
            win: 0,
            draw: 0,
            loss: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0
          };
        });

      const standingsMap = {};
      standingsTeams.forEach(team => {
        standingsMap[team.code] = team;
      });

      groupMatches.forEach(match => {
        const status = String(pick(match, ["status"], "")).toLowerCase();
        if (status !== "finished") return;

        const codeA = String(pick(match, ["team_a_code", "teamACode"], "")).toUpperCase();
        const codeB = String(pick(match, ["team_b_code", "teamBCode"], "")).toUpperCase();

        const scoreA = Number(pick(match, ["score_a", "scoreA", "goals_a", "goalsA"], ""));
        const scoreB = Number(pick(match, ["score_b", "scoreB", "goals_b", "goalsB"], ""));

        const teamA = standingsMap[codeA];
        const teamB = standingsMap[codeB];

        if (!teamA || !teamB) return;
        if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) return;

        teamA.played += 1;
        teamB.played += 1;

        teamA.goalsFor += scoreA;
        teamA.goalsAgainst += scoreB;

        teamB.goalsFor += scoreB;
        teamB.goalsAgainst += scoreA;

        if (scoreA > scoreB) {
          teamA.win += 1;
          teamB.loss += 1;
          teamA.points += 3;
        } else if (scoreA < scoreB) {
          teamB.win += 1;
          teamA.loss += 1;
          teamB.points += 3;
        } else {
          teamA.draw += 1;
          teamB.draw += 1;
          teamA.points += 1;
          teamB.points += 1;
        }
      });

      standingsTeams.forEach(team => {
        team.goalDiff = team.goalsFor - team.goalsAgainst;
      });

      standingsTeams.sort((a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name)
      );

      standingsTeams.forEach((team, index) => {
        team.rank = index + 1;
      });

      standingsPanel.innerHTML = `
        <div class="standings-table">
          <div class="standings-row standings-head">
            <span>#</span>
            <span>球队</span>
            <span>赛</span>
            <span>胜</span>
            <span>平</span>
            <span>负</span>
            <span>进</span>
            <span>失</span>
            <span>净</span>
            <span>分</span>
          </div>

          ${standingsTeams.map(team => `
            <div class="standings-row">
              <span>${team.rank}</span>
              <span class="standing-team">
                ${team.flag ? `<img src="${team.flag}" alt="${team.name} flag">` : ""}
                <strong>${team.name}</strong>
              </span>
              <span>${team.played}</span>
              <span>${team.win}</span>
              <span>${team.draw}</span>
              <span>${team.loss}</span>
              <span>${team.goalsFor}</span>
              <span>${team.goalsAgainst}</span>
              <span>${team.goalDiff}</span>
              <span><b>${team.points}</b></span>
            </div>
          `).join("")}
        </div>
      `;
    }

    if (matchesPanel) {
      const groupTeams = groupRows
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
        .map(row => {
          const code = String(row.team_id || "").toUpperCase();
          const team = teamMap[code];

          return {
            code,
            name: team?.name || row.team_name || code || "TBD",
            flag: team?.flag || ""
          };
        });

      const pairings = [
        [0, 1],
        [2, 3],
        [0, 2],
        [1, 3],
        [0, 3],
        [1, 2]
      ];

      matchesPanel.innerHTML = groupMatches.map((m, index) => {
        const pair = pairings[index] || [];
        const left = groupTeams[pair[0]] || { name: "TBD", flag: "" };
        const right = groupTeams[pair[1]] || { name: "TBD", flag: "" };

        return `
          <article class="home-card schedule-poster-card">
            <div class="schedule-meta">
              <span>${pick(m, ["stage"], "")}</span>
              <strong>${pick(m, ["match_date"], "")}</strong>
            </div>

            <div class="match-vs-row">
              <div class="match-side">
                ${left.flag ? `<img class="match-flag-img" src="${left.flag}" alt="${left.name} flag">` : `<div class="match-flag-placeholder">待定</div>`}
                <h3>${left.name}</h3>
              </div>

              <div class="vs-badge">VS</div>

              <div class="match-side">
                ${right.flag ? `<img class="match-flag-img" src="${right.flag}" alt="${right.name} flag">` : `<div class="match-flag-placeholder">待定</div>`}
                <h3>${right.name}</h3>
              </div>
            </div>

            <div class="schedule-info">
              <p>开球：${pick(m, ["kickoff"], "")}</p>
              <p>${pick(m, ["city"], "")}, ${pick(m, ["country"], "")}</p>
              <p>${pick(m, ["stadium"], "")}</p>
            </div>
          </article>
        `;
      }).join("");
    }
  } catch (err) {
    if (teamsPanel) teamsPanel.innerHTML = `<div class="home-card">小组详情读取失败：${err.message}</div>`;
  }
}

function renderIndex_DISABLED(teams, matches) {
  const statCards = document.querySelectorAll(".stat-card strong");
  if (statCards[0]) statCards[0].textContent = teams.length || 48;

  // PRODUCT HOME V2: old homepage hero disabled
}

function renderTodayMatches(teams, matches) {
  const list = document.querySelector("#todayMatchesList");
  if (!list) return;

  if (!matches.length) {
    list.innerHTML = `
      <article class="match-card evidence-card">
        <div class="match-topline">
          <span class="badge green">比赛事实</span>
          <span class="match-stage">赛程待接入</span>
        </div>

        <div class="match-teams">
          <div class="team-side">
            <div class="flag-placeholder">A</div>
            <strong>一方</strong>
          </div>
          <div class="versus">VS</div>
          <div class="team-side">
            <div class="flag-placeholder">B</div>
            <strong>另一方</strong>
          </div>
        </div>

        <div class="fact-grid">
          <div><span>比赛时间</span><strong>${EMPTY}</strong></div>
          <div><span>比赛城市</span><strong>${EMPTY}</strong></div>
          <div><span>比赛球场</span><strong>${EMPTY}</strong></div>
          <div><span>天气 / 海拔</span><strong>${EMPTY}</strong></div>
        </div>

        <div class="card-actions">
          <a href="match.html" class="btn btn-primary small">查看比赛详情</a>
          <a href="match.html#compareSection" class="btn btn-secondary small">查看数据依据 Evidence</a>
        </div>
      </article>
    `;
    return;
  }

  list.innerHTML = matches.slice(0, 6).map((m, index) => {
    const id = first(m, ["match_id", "id"]) || `match-${index + 1}`;
    const a = findTeam(teams, first(m, ["team_a_id", "teamA", "team_a"])) || {};
    const b = findTeam(teams, first(m, ["team_b_id", "teamB", "team_b"])) || {};

    return `
      <article class="match-card evidence-card">
        <div class="match-topline">
          <span class="badge green">比赛事实</span>
          <span class="match-stage">${safe(first(m, ["group", "stage", "round"]))}</span>
        </div>

        <div class="match-teams">
          <div class="team-side">
            <div class="flag-placeholder">A</div>
            <strong>${teamName(a)}</strong>
          </div>
          <div class="versus">VS</div>
          <div class="team-side">
            <div class="flag-placeholder">B</div>
            <strong>${teamName(b)}</strong>
          </div>
        </div>

        <div class="fact-grid">
          <div><span>比赛时间</span><strong>${safe(first(m, ["match_date", "matchDate", "date"]))}</strong></div>
          <div><span>比赛城市</span><strong>${safe(first(m, ["city"]))}</strong></div>
          <div><span>比赛球场</span><strong>${safe(first(m, ["stadium", "venue"]))}</strong></div>
          <div><span>天气 / 海拔</span><strong>${safe(first(m, ["weather", "altitude"]))}</strong></div>
        </div>

        <div class="card-actions">
          <a href="match.html?id=${encodeURIComponent(id)}" class="btn btn-primary small">查看比赛详情</a>
          <a href="match.html?id=${encodeURIComponent(id)}#compareSection" class="btn btn-secondary small">查看数据依据 Evidence</a>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- 球队页 ---------- */

function renderTeam(teams, matches) {
  if (!teams.length) return;

  const id = getParam("code") || getParam("id");
  const team = findTeam(teams, id) || teams[0];

  const name = teamName(team);
  const idText = teamId(team);
  const continent = safe(first(team, ["continent"]));
  const confed = safe(first(team, ["confed"]));

  const title = document.querySelector(".team-profile-card h3");
  if (title) title.textContent = name;

  const desc = document.querySelector(".team-profile-card p");
  if (desc) {
    desc.textContent = `${name} · ${continent} · ${confed}。当前展示已导入的球队基础数据，缺失字段继续显示“暂无可靠数据”。`;
  }

  const status = document.querySelector(".team-status-pill");
  if (status) status.textContent = "球队数据已接入";

  const avatar = document.querySelector(".team-avatar-large");
  if (avatar) avatar.textContent = idText || "T";

  const metrics = document.querySelectorAll(".metric-card strong");
  if (metrics[0]) metrics[0].textContent = safe(teamElo(team));
  if (metrics[1]) metrics[1].textContent = safe(first(team, ["fifa_rank", "rank"]));
  if (metrics[2]) metrics[2].textContent = safe(first(team, ["goals_for"]));
  if (metrics[3]) metrics[3].textContent = safe(first(team, ["goals_against"]));

  const formItems = document.querySelectorAll(".form-item strong");
  const last5 = first(team, ["last5"]);
  if (last5 && formItems.length) {
    last5.split("").slice(0, 5).forEach((v, i) => {
      if (formItems[i]) formItems[i].textContent = v;
    });
  }

  renderTeamList(teams);
}

function renderTeamList(teams) {
  const old = document.querySelector("#allTeamsPanel");
  if (old) old.remove();

  const grid = document.querySelector(".team-grid");
  if (!grid) return;

  const panel = document.createElement("section");
  panel.className = "team-panel";
  panel.id = "allTeamsPanel";

  const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <h3>已接入球队列表</h3>
        <p>当前从 data/teams.csv 读取到 ${teams.length} 支球队。</p>
      </div>
      <span class="mini-label">48 TEAMS DATA</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
      ${teams.map(t => `
        <a href="team.html?id=${encodeURIComponent(teamId(t))}" style="display:block;background:#f8fcfb;border:1px solid var(--border);border-radius:18px;padding:16px;text-decoration:none;color:inherit;">
          <strong>${safe(teamId(t))} ${safe(teamName(t))}</strong>
          <p style="margin:6px 0 0;color:var(--muted);font-weight:700;">ELO：${safe(teamElo(t))}</p>
          <p style="margin:4px 0 0;color:var(--muted);font-weight:700;">近5场：${safe(first(t, ["last5"]))}</p>
        </a>
      `).join("")}
    </div>
  `;

  grid.insertBefore(panel, grid.children[1] || null);
}

/* ---------- 比赛页 ---------- */

function renderMatch(teams, matches) {
  const id = getParam("id") || getParam("match_id");
  const match = matches.find(m => first(m, ["match_id", "id"]) === id) || matches[0];
  if (!match) return;

  window.allTeams = teams;

  const teamMap = buildTeamMap(teams);

  const codeA = String(first(match, ["team_a_code", "team_a_id", "teamA", "team_a"], "")).toUpperCase();
  const codeB = String(first(match, ["team_b_code", "team_b_id", "teamB", "team_b"], "")).toUpperCase();

  const a = teamMap[codeA] || findTeam(teams, codeA) || {};
  const b = teamMap[codeB] || findTeam(teams, codeB) || {};

  const rawAName = first(match, ["team_a", "teamA"], "");
  const rawBName = first(match, ["team_b", "teamB"], "");
  const placeholderA = first(match, ["team_a_placeholder", "teamAPlaceholder", "home_placeholder"], "");
  const placeholderB = first(match, ["team_b_placeholder", "teamBPlaceholder", "away_placeholder"], "");

  const aName =
    a.name ||
    (rawAName && rawAName !== "TBD" && rawAName !== "待定" ? rawAName : "") ||
    placeholderA ||
    "一方";

  const bName =
    b.name ||
    (rawBName && rawBName !== "TBD" && rawBName !== "待定" ? rawBName : "") ||
    placeholderB ||
    "另一方";

  renderSimpleAIProbability(match, a, b);

  const title = document.querySelector(".match-title-row h2");
  if (title) title.textContent = `${aName} vs ${bName}`;

  const names = document.querySelectorAll(".versus-team strong");
  if (names[0]) names[0].textContent = aName;
  if (names[1]) names[1].textContent = bName;

  const subtitles = document.querySelectorAll(".versus-team span");
  if (subtitles[0]) subtitles[0].textContent = codeA || "Team A";
  if (subtitles[1]) subtitles[1].textContent = codeB || "Team B";

  const avatars = document.querySelectorAll(".team-avatar");
  if (avatars[0]) avatars[0].innerHTML = a.flag ? `<img src="${a.flag}" alt="${aName} flag" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">` : "A";
  if (avatars[1]) avatars[1].innerHTML = b.flag ? `<img src="${b.flag}" alt="${bName} flag" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">` : "B";

  const status = document.querySelector(".match-status-pill");
  if (status) status.textContent = `${safe(first(match, ["group", "stage", "round"]))} · 数据已接入`;

  const facts = document.querySelectorAll(".fact-item strong");
  if (facts[0]) facts[0].textContent = `${safe(first(match, ["match_date", "matchDate", "date"]))} ${safe(first(match, ["kickoff"]))}`;
  if (facts[1]) facts[1].textContent = safe(first(match, ["group", "stage", "round"]));
  if (facts[2]) facts[2].textContent = safe(first(match, ["city"]));
  if (facts[3]) facts[3].textContent = safe(first(match, ["stadium", "venue"]));
  if (facts[4]) facts[4].textContent = safe(first(match, ["weather", "altitude"]));

  const rows = document.querySelectorAll(".compare-table tbody tr");
  const fields = [
    ["elo", "elo_rating"],
    ["fifa_rank"],
    ["last5"],
    ["goals_for"],
    ["goals_against"],
    ["attack_rating"]
  ];

  rows.forEach((row, i) => {
    const cells = row.querySelectorAll("td");
    if (cells[1]) cells[1].textContent = safe(first(a, fields[i] || []));
    if (cells[2]) cells[2].textContent = safe(first(b, fields[i] || []));
  });

  const aiBox = document.querySelector(".ai-box p");
  if (aiBox) {
    aiBox.textContent = `${aName} 与 ${bName} 的比赛已接入基础数据。本页当前基于 ELO、FIFA排名、近期状态、进失球和能力评分做赛前辅助阅读，后续可继续接入赔率、伤停、天气与新闻信号。`;
  }
}

/* ---------- VIP页 ---------- */

function renderVip(teams, matches) {
  const cards = document.querySelectorAll(".vip-summary-card strong");
  if (cards[0]) cards[0].textContent = matches.length ? "待计算" : EMPTY;
  if (cards[1]) cards[1].textContent = matches.length ? "待计算" : EMPTY;
  if (cards[2]) cards[2].textContent = teams.length ? `${teams.length} 支球队已接入` : EMPTY;
  if (cards[3]) cards[3].textContent = teams.length ? "待生成" : "待接入";
}
// ===== groups.csv 小组数据接入：自动追加，不需要手动找位置 =====
document.addEventListener("DOMContentLoaded", async function () {
  const pageFile = window.location.pathname.split("/").pop() || "index.html";
  if (!pageFile.includes("index") && pageFile !== "") return;

  try {
    const res = await fetch("data/groups.csv");
    if (!res.ok) return;

    const text = await res.text();
    const groups = parseSimpleGroupsCsv(text);

    console.log("✅ 小组数据已接入：", groups);

    // PRODUCT HOME V2: disabled old groups overview
  } catch (error) {
    console.warn("小组数据读取失败：", error);
  }
});

function parseSimpleGroupsCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const rows = lines.slice(1);

  const map = {};

  rows.forEach(function (line) {
    const cols = line.split(",");
    const group = cols[0] || "";
    const slot = cols[1] || "";
    const teamId = cols[2] || "";
    const teamName = cols[3] || "";
    const status = cols[4] || "";

    if (!group) return;
    if (!map[group]) map[group] = [];

    map[group].push({
      slot: slot,
      team_id: teamId,
      team_name: teamName,
      status: status
    });
  });

  return map;
}

function renderGroupsOnIndex(groups) {
  let container = document.querySelector("#groupsOverview");

  if (!container) {
    const title = Array.from(document.querySelectorAll("h2, h3")).find(function (el) {
      return el.textContent.includes("48支球队") || el.textContent.includes("小组总览");
    });

    container = document.createElement("div");
    container.id = "groupsOverview";
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(4, 1fr)";
    container.style.gap = "16px";
    container.style.marginTop = "24px";

    if (title && title.parentElement) {
      title.parentElement.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
  }

  function parseRecentCsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(function (h) {
      return h.trim().replace(/^"|"$/g, "");
    });

    return lines.filter(Boolean).map(function (line) {
      const cols = line.split(",").map(function (v) {
        return v.trim().replace(/^"|"$/g, "");
      });

      const row = {};
      headers.forEach(function (h, i) {
        row[h] = cols[i] || "";
      });
      return row;
    });
  }

  function render(recentRows) {
    const groupKeys = Object.keys(groups).sort();

    if (!groupKeys.length) {
      container.innerHTML = "<p>暂无可靠小组数据</p>";
      return;
    }

    container.innerHTML = groupKeys.map(function (group) {
      const teams = groups[group] || [];

      return `
        <div style="background:#ffffff;border:1px solid var(--border);border-radius:22px;padding:20px;box-shadow:var(--shadow);">
          <div style="font-size:13px;font-weight:900;color:#07845f;margin-bottom:10px;">GROUP ${group}</div>
          <h3 style="margin:0 0 14px;font-size:24px;">${group} 组</h3>
          <div style="display:grid;gap:10px;">
            ${teams.map(function (team) {
              const statusText = team.status === "confirmed" ? "已确认" : "待确认";
              const rawCode = team.team_id || "";
              const teamCode = encodeURIComponent(rawCode);

              const recent = (recentRows || [])
                .filter(function (m) {
                  return String(m.team_code || "").trim().toUpperCase() === String(rawCode).trim().toUpperCase();
                })
                .slice(0, 5);

              const formText = recent.length
                ? recent.map(function (m) { return m.result || "D"; }).join(" ")
                : "暂无近5场";

              const scoreText = recent.length
                ? recent.map(function (m) {
                    if (m.team_score === "" || m.opponent_score === "") return "";
                    return m.team_score + "-" + m.opponent_score;
                  }).filter(Boolean).join(" / ")
                : "";

              return `
                <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--border);padding-top:10px;">
                  <a href="team.html?code=${teamCode}" style="font-weight:900;color:inherit;text-decoration:none;display:block;">
                    <div>${team.team_id} ${team.team_name}</div>
                    <div style="font-size:12px;margin-top:4px;color:#0f766e;font-weight:900;">${formText}</div>
                    <div style="font-size:11px;margin-top:3px;color:#6b7280;font-weight:700;">${scoreText}</div>
                  </a>
                  <span style="color:var(--muted);font-weight:800;">${statusText}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  render([]);

  fetch("./data/team_recent_matches.csv?v=" + Date.now())
    .then(function (res) {
      if (!res.ok) throw new Error("team_recent_matches.csv 加载失败");
      return res.text();
    })
    .then(function (text) {
      render(parseRecentCsv(text));
    })
    .catch(function (err) {
      console.warn("首页近5场数据加载失败：", err);
    });
}

/* === WORLD_CUP_TODAY_MATCHES_MODULE_V1 === */
(function () {
  async function loadText(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return await res.text();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = cols[i] || "");
      return row;
    });
  }

  function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function createPanel() {
    let panel = document.getElementById("today-real-matches-panel");
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "today-real-matches-panel";
    panel.style.cssText = `
      margin: 28px auto;
      max-width: 1180px;
      padding: 22px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(20,30,54,.92));
      color: #fff;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;

    const main = document.querySelector("main") || document.body;
    main.prepend(panel);
    return panel;
  }

  function renderMatches(matches, title, subtitle) {
    const panel = createPanel();

    const cards = matches.map(m => `
      <div style="
        padding:16px;
        border-radius:16px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
      ">
        <div style="font-size:13px;color:#93c5fd;margin-bottom:8px;">
          ${m.stage} · ${m.group ? "Group " + m.group : ""} · ${(m.match_date || m.matchDate)} ${m.kickoff || ""}
        </div>
        <div style="font-size:22px;font-weight:800;margin-bottom:8px;">
          ${m.team_a} <span style="color:#94a3b8;font-size:16px;">vs</span> ${m.team_b}
        </div>
        <div style="font-size:14px;color:#cbd5e1;">
          ${m.city || ""} · ${m.stadium || ""}
        </div>
      </div>
    `).join("");

    const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;">
        <div>
          <div style="font-size:14px;color:#38bdf8;font-weight:700;">WORLD CUP DATA ASSISTANT</div>
          <h2 style="margin:4px 0 0;font-size:28px;">${title}</h2>
          <p style="margin:8px 0 0;color:#cbd5e1;">${subtitle}</p>
        </div>
        <div style="font-size:13px;color:#94a3b8;">数据源：matches.csv</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
        ${cards || `<div style="color:#cbd5e1;">暂无可展示比赛</div>`}
      </div>
    `;
  }

  async function initTodayMatches_DISABLED() {
    try {
      const today = getTodayISO();
      const matches = parseCSV(await loadText("data/matches.csv"))
        .filter(m => m.status !== "finished" && (m.match_date || m.matchDate) && (m.team_a || m.teamA) && (m.team_b || m.teamB))
        .sort((a, b) => ((a.match_date || a.matchDate) + (a.kickoff || "")).localeCompare((b.match_date || b.matchDate) + (b.kickoff || "")));

      const todayMatches = matches.filter(m => (m.match_date || m.matchDate) === today);

      if (todayMatches.length > 0) {
        renderMatches(todayMatches, "今日比赛", `今天 ${today} 共有 ${todayMatches.length} 场世界杯比赛。`);
        return;
      }

      const nextDate = matches.find(m => (m.match_date || m.matchDate) && (m.match_date || m.matchDate) >= today)?.match_date;
      const nextMatches = matches.filter(m => (m.match_date || m.matchDate) === nextDate);

      renderMatches(
        nextMatches,
        "今日暂无比赛，展示下一批比赛",
        `当前日期 ${today} 暂无世界杯比赛。下一批比赛日期：${nextDate || "暂无"}。`
      );
    } catch (err) {
      console.error(err);
    }
  }

  if (typeof initTodayMatches === "function") {
  document.addEventListener("DOMContentLoaded", initTodayMatches);
} else {
  console.warn("initTodayMatches 未定义，跳过旧首页比赛初始化");
}
})();

/* === MATCH_TEAMS_LINK_V1 === */
async function loadTeamsMap() {
  const res = await fetch("data/teams.csv?v=" + Date.now());
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");

  const map = {};

  lines.forEach(line => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => row[h.trim()] = (cols[i] || "").trim());
    map[row.name] = row;
  });

  return map;
}

function enrichMatchWithTeams(match, teamsMap) {
  const a = teamsMap[match.team_a] || {};
  const b = teamsMap[match.team_b] || {};

  return {
    ...match,
    teamAData: a,
    teamBData: b
  };
}

function getStrengthText(a, b) {
  const eloA = parseInt(a.elo || 0);
  const eloB = parseInt(b.elo || 0);

  if (!eloA || !eloB) return "数据不足";

  if (eloA > eloB + 50) return "A 明显更强";
  if (eloB > eloA + 50) return "B 明显更强";
  return "双方接近";
}


/* === TODAY_MATCHES_ENRICHED_UI_V2 === */
(function () {
  async function loadText(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return await res.text();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = cols[i] || "");
      return row;
    });
  }

  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function buildTeamsMap(teams) {
    const map = {};
    teams.forEach(t => {
      const name = pick(t, ["name", "team", "team_name", "Team", "Name"], "");
      if (name) map[name] = t;
    });
    return map;
  }

  function strengthText(a, b) {
    const eloA = Number(pick(a, ["elo", "ELO", "rating"], 0));
    const eloB = Number(pick(b, ["elo", "ELO", "rating"], 0));
    if (!eloA || !eloB) return "AI判断：球队数据不足，暂不判断";
    if (eloA >= eloB + 80) return "AI判断：一方实力优势明显";
    if (eloB >= eloA + 80) return "AI判断：另一方实力优势明显";
    if (eloA >= eloB + 30) return "AI判断：一方略占优势";
    if (eloB >= eloA + 30) return "AI判断：另一方略占优势";
    return "AI判断：双方实力接近，比赛不确定性较高";
  }

  function render_DISABLED() {
    Promise.all([
      loadText("data/matches.csv"),
      loadText("data/teams.csv")
    ]).then(([matchesText, teamsText]) => {
      const matches = parseCSV(matchesText)
        .filter(m => m.status !== "finished" && (m.match_date || m.matchDate) && (m.team_a || m.teamA) && (m.team_b || m.teamB))
        .sort((a, b) => ((a.match_date || a.matchDate) + (a.kickoff || "")).localeCompare((b.match_date || b.matchDate) + (b.kickoff || "")));

      return; // old homepage AI enhancement disabled during schedule-first rebuild
      const today = todayISO();

      let show = matches.filter(m => (m.match_date || m.matchDate) === today);
      let title = "今日比赛";
      let sub = `今天 ${today} 的世界杯比赛。`;

      if (!show.length) {
        const nextDate = matches.find(m => (m.match_date || m.matchDate) && (m.match_date || m.matchDate) >= today)?.match_date;
        show = matches.filter(m => (m.match_date || m.matchDate) === nextDate);
        title = "今日暂无比赛，展示下一批比赛";
        sub = `当前日期 ${today} 暂无世界杯比赛。下一批比赛日期：${nextDate || "暂无"}。`;
      }

      const panel = document.getElementById("today-real-matches-panel");
      if (!panel) return;

      const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;">
          <div>
            <div style="font-size:14px;color:#38bdf8;font-weight:700;">WORLD CUP DATA ASSISTANT</div>
            <h2 style="margin:4px 0 0;font-size:28px;">${title}</h2>
            <p style="margin:8px 0 0;color:#cbd5e1;">${sub}</p>
          </div>
          <div style="font-size:13px;color:#94a3b8;">数据源：matches.csv + teams.csv</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
          ${show.map(m => {
            const a = teamsMap[m.team_a] || {};
            const b = teamsMap[m.team_b] || {};

            const eloA = pick(a, ["elo", "ELO", "rating"]);
            const eloB = pick(b, ["elo", "ELO", "rating"]);

            const formA = pick(a, ["last5", "recent5", "form", "last_5", "recent_form"]);
            const formB = pick(b, ["last5", "recent5", "form", "last_5", "recent_form"]);

            const gfA = pick(a, ["goals_for", "gf", "进球", "goals"]);
            const gfB = pick(b, ["goals_for", "gf", "进球", "goals"]);

            const gaA = pick(a, ["goals_against", "ga", "失球", "conceded"]);
            const gaB = pick(b, ["goals_against", "ga", "失球", "conceded"]);

            return `
              <div style="
                padding:16px;
                border-radius:16px;
                background:rgba(255,255,255,.06);
                border:1px solid rgba(255,255,255,.10);
              ">
                <div style="font-size:13px;color:#93c5fd;margin-bottom:8px;">
                  ${m.stage} · ${m.group ? "Group " + m.group : ""} · ${(m.match_date || m.matchDate)} ${m.kickoff || ""}
                </div>

                <div style="font-size:22px;font-weight:800;margin-bottom:12px;">
                  ${m.team_a} <span style="color:#94a3b8;font-size:16px;">vs</span> ${m.team_b}
                </div>

                <div style="display:grid;gap:8px;font-size:14px;color:#dbeafe;margin-bottom:12px;">
                  <div>ELO：<b>${eloA}</b> vs <b>${eloB}</b></div>
                  <div>近5场：<b>${formA}</b> vs <b>${formB}</b></div>
                  <div>进球：<b>${gfA}</b> vs <b>${gfB}</b></div>
                  <div>失球：<b>${gaA}</b> vs <b>${gaB}</b></div>
                </div>

                <div style="
                  margin-top:10px;
                  padding:10px 12px;
                  border-radius:12px;
                  background:rgba(56,189,248,.12);
                  color:#e0f2fe;
                  font-weight:700;
                ">
                  ${strengthText(a, b)}
                </div>

                <div style="font-size:13px;color:#cbd5e1;margin-top:12px;">
                  ${m.city || ""} · ${m.stadium || ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }).catch(console.error);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(render, 300);
  });
})();

/* === TEAM_NAME_ALIAS_MATCH_V3 === */
(function () {
  const TEAM_ALIASES = {
    "United States": ["USA", "United States", "USMNT"],
    "South Korea": ["Korea Republic", "South Korea", "Korea"],
    "Czechia": ["Czech Republic", "Czechia"],
    "DR Congo": ["Congo DR", "DR Congo", "Democratic Republic of the Congo"],
    "Turkiye": ["Turkey", "Türkiye", "Turkiye"],
    "Iran": ["IR Iran", "Iran"],
    "New Zealand": ["New Zealand"],
    "South Africa": ["South Africa"],
    "Mexico": ["Mexico"],
    "Australia": ["Australia"],
    "Paraguay": ["Paraguay"],
    "France": ["France"],
    "Senegal": ["Senegal"],
    "Iraq": ["Iraq"],
    "Norway": ["Norway"],
    "Argentina": ["Argentina"],
    "Algeria": ["Algeria"],
    "Austria": ["Austria"],
    "Jordan": ["Jordan"],
    "Portugal": ["Portugal"],
    "Uzbekistan": ["Uzbekistan"],
    "Colombia": ["Colombia"]
  };

  function normalizeTeamName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  window.findTeamSmart = function (teamsMap, teamName) {
    if (!teamName) return {};

    if (teamsMap[teamName]) return teamsMap[teamName];

    const wanted = normalizeTeamName(teamName);

    for (const key in teamsMap) {
      if (normalizeTeamName(key) === wanted) return teamsMap[key];
    }

    for (const official in TEAM_ALIASES) {
      const aliases = TEAM_ALIASES[official] || [];
      const hit = aliases.some(a => normalizeTeamName(a) === wanted);
      if (hit) {
        for (const key in teamsMap) {
          if (normalizeTeamName(key) === normalizeTeamName(official)) return teamsMap[key];
          if (aliases.some(a => normalizeTeamName(a) === normalizeTeamName(key))) return teamsMap[key];
        }
      }
    }

    return {};
  };

  console.log("TEAM_NAME_ALIAS_MATCH_V3 loaded");
})();

/* === MATCH_AI_SCORE_V4 === */
(function () {
  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function num(v) {
    const n = Number(String(v || "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function formScore(form) {
    const text = String(form || "").toUpperCase();
    let score = 0;
    for (const ch of text) {
      if (ch === "W") score += 3;
      if (ch === "D") score += 1;
      if (ch === "L") score -= 1;
    }
    return score;
  }

  window.calculateMatchAIScore = function (teamA, teamB) {
    const eloA = num(pick(teamA, ["elo", "ELO", "rating"], 0));
    const eloB = num(pick(teamB, ["elo", "ELO", "rating"], 0));

    const formA = pick(teamA, ["last5", "recent5", "form", "last_5", "recent_form"], "");
    const formB = pick(teamB, ["last5", "recent5", "form", "last_5", "recent_form"], "");

    const gfA = num(pick(teamA, ["goals_for", "gf", "进球", "goals"], 0));
    const gfB = num(pick(teamB, ["goals_for", "gf", "进球", "goals"], 0));

    const gaA = num(pick(teamA, ["goals_against", "ga", "失球", "conceded"], 0));
    const gaB = num(pick(teamB, ["goals_against", "ga", "失球", "conceded"], 0));

    let scoreA = 50;
    let scoreB = 50;

    scoreA += (eloA - eloB) / 25;
    scoreB += (eloB - eloA) / 25;

    scoreA += formScore(formA);
    scoreB += formScore(formB);

    scoreA += (gfA - gaA) * 1.5;
    scoreB += (gfB - gaB) * 1.5;

    scoreA = Math.max(5, Math.min(95, Math.round(scoreA)));
    scoreB = Math.max(5, Math.min(95, Math.round(scoreB)));

    const draw = Math.max(12, Math.min(32, 28 - Math.abs(scoreA - scoreB) / 4));

    const total = scoreA + scoreB + draw;

    const winA = Math.round(scoreA / total * 100);
    const winB = Math.round(scoreB / total * 100);
    const drawP = 100 - winA - winB;

    let text = "AI判断：双方接近，建议重点看临场阵容与盘口变化";
    if (winA >= winB + 12) text = "AI判断：一方优势更明显";
    if (winB >= winA + 12) text = "AI判断：另一方优势更明显";
    if (Math.abs(winA - winB) <= 6) text = "AI判断：胜负差距很小，有爆冷或平局空间";

    return {
      winA,
      draw: drawP,
      winB,
      text
    };
  };

  console.log("MATCH_AI_SCORE_V4 loaded");
})();

/* === MATCH_PROBABILITY_CARD_V5 === */
(function () {
  async function loadText(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return await res.text();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = cols[i] || "");
      return row;
    });
  }

  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function buildTeamsMap(teams) {
    const map = {};
    teams.forEach(t => {
      const name = pick(t, ["name", "team", "team_name", "Team", "Name"], "");
      if (name) map[name] = t;
    });
    return map;
  }

  function getTeam(teamsMap, name) {
    if (window.findTeamSmart) return window.findTeamSmart(teamsMap, name);
    return teamsMap[name] || {};
  }

  function renderBar(label, value) {
    return `
      <div style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#dbeafe;">
          <span>${label}</span><b>${value}%</b>
        </div>
        <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px;">
          <div style="height:100%;width:${value}%;border-radius:999px;background:rgba(56,189,248,.85);"></div>
        </div>
      </div>
    `;
  }

  async function renderProbabilityCards() { return; // disabled on homepage: teams are TBD, show schedule facts first
    const panel = document.getElementById("today-real-matches-panel");
    if (!panel) return;

    const [matchesText, teamsText] = await Promise.all([
      loadText("data/matches.csv"),
      loadText("data/teams.csv")
    ]);

    const matches = parseCSV(matchesText)
      .filter(m => m.status !== "finished" && (m.match_date || m.matchDate) && (m.team_a || m.teamA) && (m.team_b || m.teamB))
      .sort((a, b) => ((a.match_date || a.matchDate) + (a.kickoff || "")).localeCompare((b.match_date || b.matchDate) + (b.kickoff || "")));

    const teamsMap = buildTeamsMap(parseCSV(teamsText));
    const today = todayISO();

    let show = matches.filter(m => (m.match_date || m.matchDate) === today);
    let title = "今日比赛";
    let sub = `今天 ${today} 的世界杯比赛。`;

    if (!show.length) {
      const nextDate = matches.find(m => (m.match_date || m.matchDate) && (m.match_date || m.matchDate) >= today)?.match_date;
      show = matches.filter(m => (m.match_date || m.matchDate) === nextDate);
      title = "今日暂无比赛，展示下一批比赛";
      sub = `当前日期 ${today} 暂无世界杯比赛。下一批比赛日期：${nextDate || "暂无"}。`;
    }

    const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;">
        <div>
          <div style="font-size:14px;color:#38bdf8;font-weight:700;">WORLD CUP DATA ASSISTANT</div>
          <h2 style="margin:4px 0 0;font-size:28px;">${title}</h2>
          <p style="margin:8px 0 0;color:#cbd5e1;">${sub}</p>
        </div>
        <div style="font-size:13px;color:#94a3b8;">数据源：matches.csv + teams.csv</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
        ${show.map(m => {
          const a = getTeam(teamsMap, m.team_a);
          const b = getTeam(teamsMap, m.team_b);

          const eloA = pick(a, ["elo", "ELO", "rating"]);
          const eloB = pick(b, ["elo", "ELO", "rating"]);
          const formA = pick(a, ["last5", "recent5", "form", "last_5", "recent_form"]);
          const formB = pick(b, ["last5", "recent5", "form", "last_5", "recent_form"]);
          const gfA = pick(a, ["goals_for", "gf", "进球", "goals"]);
          const gfB = pick(b, ["goals_for", "gf", "进球", "goals"]);
          const gaA = pick(a, ["goals_against", "ga", "失球", "conceded"]);
          const gaB = pick(b, ["goals_against", "ga", "失球", "conceded"]);

          const ai = window.calculateMatchAIScore
            ? window.calculateMatchAIScore(a, b)
            : { winA: 33, draw: 34, winB: 33, text: "AI判断：等待数据" };

          return `
            <div style="
              padding:16px;
              border-radius:16px;
              background:rgba(255,255,255,.06);
              border:1px solid rgba(255,255,255,.10);
            ">
              <div style="font-size:13px;color:#93c5fd;margin-bottom:8px;">
                ${m.stage} · ${m.group ? "Group " + m.group : ""} · ${(m.match_date || m.matchDate)} ${m.kickoff || ""}
              </div>

              <div style="font-size:22px;font-weight:800;margin-bottom:12px;">
                ${m.team_a} <span style="color:#94a3b8;font-size:16px;">vs</span> ${m.team_b}
              </div>

              <div style="display:grid;gap:7px;font-size:14px;color:#dbeafe;margin-bottom:12px;">
                <div>ELO：<b>${eloA}</b> vs <b>${eloB}</b></div>
                <div>近5场：<b>${formA}</b> vs <b>${formB}</b></div>
                <div>进球：<b>${gfA}</b> vs <b>${gfB}</b></div>
                <div>失球：<b>${gaA}</b> vs <b>${gaB}</b></div>
              </div>

              ${renderBar(`${m.team_a} 胜`, ai.winA)}
              ${renderBar("平局", ai.draw)}
              ${renderBar(`${m.team_b} 胜`, ai.winB)}

              <div style="
                margin-top:14px;
                padding:10px 12px;
                border-radius:12px;
                background:rgba(56,189,248,.12);
                color:#e0f2fe;
                font-weight:700;
              ">
                ${ai.text}
              </div>

              <div style="font-size:13px;color:#cbd5e1;margin-top:12px;">
                ${m.city || ""} · ${m.stadium || ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", function () {
    // setTimeout(renderProbabilityCards, 700); // disabled on homepage: teams are TBD, show schedule facts first
  });
})();

/* === MATCH_REASON_TEXT_V6 === */
(function () {
  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function num(v) {
    const n = Number(String(v || "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function formScore(form) {
    const text = String(form || "").toUpperCase();
    let score = 0;
    for (const ch of text) {
      if (ch === "W") score += 3;
      if (ch === "D") score += 1;
      if (ch === "L") score -= 1;
    }
    return score;
  }

  window.explainMatchAIReason = function (teamAName, teamBName, teamA, teamB) {
    const eloA = num(pick(teamA, ["elo", "ELO", "rating"], 0));
    const eloB = num(pick(teamB, ["elo", "ELO", "rating"], 0));

    const formA = pick(teamA, ["last5", "recent5", "form", "last_5", "recent_form"], "");
    const formB = pick(teamB, ["last5", "recent5", "form", "last_5", "recent_form"], "");

    const gfA = num(pick(teamA, ["goals_for", "gf", "进球", "goals"], 0));
    const gfB = num(pick(teamB, ["goals_for", "gf", "进球", "goals"], 0));

    const gaA = num(pick(teamA, ["goals_against", "ga", "失球", "conceded"], 0));
    const gaB = num(pick(teamB, ["goals_against", "ga", "失球", "conceded"], 0));

    const parts = [];

    if (eloA && eloB) {
      const diff = eloA - eloB;
      if (Math.abs(diff) >= 80) {
        parts.push(`ELO差距较大，${diff > 0 ? teamAName : teamBName} 实力面更占优`);
      } else if (Math.abs(diff) >= 30) {
        parts.push(`ELO略有差距，${diff > 0 ? teamAName : teamBName} 稍占优势`);
      } else {
        parts.push("ELO接近，基础实力差距不大");
      }
    }

    const fsA = formScore(formA);
    const fsB = formScore(formB);
    if (formA && formB) {
      if (Math.abs(fsA - fsB) >= 5) {
        parts.push(`近5场状态显示，${fsA > fsB ? teamAName : teamBName} 近期表现更稳定`);
      } else {
        parts.push("近5场状态差距不明显");
      }
    }

    const netA = gfA - gaA;
    const netB = gfB - gaB;
    if ((gfA || gaA) && (gfB || gaB)) {
      if (Math.abs(netA - netB) >= 3) {
        parts.push(`进失球效率上，${netA > netB ? teamAName : teamBName} 更有优势`);
      } else {
        parts.push("双方进失球效率接近");
      }
    }

    if (!parts.length) {
      return "解释：当前球队数据不足，先展示基础概率，后续可接入阵容、伤停、赔率与市场热度进一步修正。";
    }

    return "解释：" + parts.join("；") + "。";
  };

  console.log("MATCH_REASON_TEXT_V6 loaded");
})();

/* === MATCH_REASON_RENDER_V7 === */
(function () {
  function waitAndPatchReason() {
    const cards = document.querySelectorAll("#today-real-matches-panel [style*='border-radius:16px']");
    if (!cards.length) return;

    cards.forEach(card => {
      if (card.innerHTML.includes("解释：")) return;

      const titleEl = card.querySelector("div[style*='font-size:22px']");
      if (!titleEl) return;

      const text = titleEl.textContent.replace(/\s+/g, " ").trim();
      const parts = text.split(" vs ");
      if (parts.length !== 2) return;

      const teamAName = parts[0].trim();
      const teamBName = parts[1].trim();

      const reason = window.explainMatchAIReason
        ? window.explainMatchAIReason(teamAName, teamBName, {}, {})
        : "解释：当前数据解释模块等待加载。";

      const box = document.createElement("div");
      box.style.cssText = `
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255,255,255,.06);
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.6;
      `;
      box.textContent = reason;

      card.appendChild(box);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // setTimeout(waitAndPatchReason, 1200); // disabled on homepage: schedule facts first
    // setTimeout(waitAndPatchReason, 2000); // disabled on homepage: schedule facts first
  });
})();

/* === MATCH_UPSET_RENDER_V9 === */
(function () {
  function waitAndPatchUpset() {
    const cards = document.querySelectorAll("#today-real-matches-panel [style*='border-radius:16px']");
    if (!cards.length) return;

    cards.forEach(card => {
      if (card.innerHTML.includes("爆冷风险")) return;

      const percentTexts = Array.from(card.querySelectorAll("b"))
        .map(el => el.textContent.trim())
        .filter(t => t.includes("%"))
        .map(t => Number(t.replace("%", "")));

      if (percentTexts.length < 2) return;

      const ai = {
        winA: percentTexts[0] || 33,
        draw: percentTexts[1] || 34,
        winB: percentTexts[2] || 33
      };

      if (!window.renderUpsetTag) return;

      const wrap = document.createElement("div");
      wrap.innerHTML = window.renderUpsetTag(ai);
      card.appendChild(wrap.firstElementChild);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // setTimeout(waitAndPatchUpset, 1500); // disabled on homepage: schedule facts first
    // setTimeout(waitAndPatchUpset, 2500); // disabled on homepage: schedule facts first
  });
})();

/* === MATCH_DETAIL_LINK_V10 === */
(function () {
  function waitAndPatchDetailLink() {
    const cards = document.querySelectorAll("#today-real-matches-panel [style*='border-radius:16px']");
    if (!cards.length) return;

    cards.forEach(card => {
      if (card.innerHTML.includes("查看分析详情")) return;

      const titleEl = card.querySelector("div[style*='font-size:22px']");
      if (!titleEl) return;

      const text = titleEl.textContent.replace(/\s+/g, " ").trim();
      const teams = text.split(" vs ");
      if (teams.length !== 2) return;

      const teamA = encodeURIComponent(teams[0].trim());
      const teamB = encodeURIComponent(teams[1].trim());

      const link = document.createElement("a");
      link.href = `match.html?team_a=${teamA}&team_b=${teamB}`;
      link.textContent = "查看分析详情 →";
      link.style.cssText = `
        display:inline-block;
        margin-top:12px;
        padding:10px 14px;
        border-radius:999px;
        background:rgba(16,185,129,.18);
        color:#bbf7d0;
        font-size:14px;
        font-weight:800;
        text-decoration:none;
      `;

      card.appendChild(link);
    });
  }

  // document.addEventListener("DOMContentLoaded", function () {
  // setTimeout(waitAndPatchDetailLink, 1700);
  // setTimeout(waitAndPatchDetailLink, 2800);
  // });
})();

/* === MATCH_PAGE_QUERY_RENDER_V11 === */
(function () {
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function renderMatchPageQuery() {
    const pageFile = window.location.pathname.split("/").pop() || "";
    if (!pageFile.includes("match")) return;

    const teamA = getParam("team_a");
    const teamB = getParam("team_b");

    if (!teamA || !teamB) return;

    const panel = document.createElement("section");
    panel.style.cssText = `
      margin: 28px auto;
      max-width: 1180px;
      padding: 24px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(20,30,54,.92));
      color: #fff;
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 20px 60px rgba(0,0,0,.24);
    `;

    const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
      <div style="font-size:14px;color:#38bdf8;font-weight:800;">MATCH ANALYSIS DETAIL</div>
      <h1 style="margin:8px 0 10px;font-size:34px;">
        ${teamA} <span style="color:#94a3b8;font-size:22px;">vs</span> ${teamB}
      </h1>
      <p style="margin:0;color:#cbd5e1;font-size:16px;">
        当前详情页已接收首页比赛参数，下一步将接入 ELO、近5场、进失球、三向概率与爆冷风险。
      </p>
    `;

    const main = document.querySelector("main") || document.body;
    main.prepend(panel);
  }

  // document.addEventListener("DOMContentLoaded", renderMatchPageQuery);
})();

/* === MATCH_PAGE_FULL_ANALYSIS_V12 === */
(function () {
  async function loadText(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return await res.text();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = cols[i] || "");
      return row;
    });
  }

  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function buildTeamsMap(teams) {
    const map = {};
    teams.forEach(t => {
      const name = pick(t, ["name", "team", "team_name", "Team", "Name"], "");
      if (name) map[name] = t;
    });
    return map;
  }

  function getTeam(teamsMap, name) {
    if (window.findTeamSmart) return window.findTeamSmart(teamsMap, name);
    return teamsMap[name] || {};
  }

  function bar(label, value) {
    return `
      <div style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;color:#dbeafe;font-size:14px;">
          <span>${label}</span><b>${value}%</b>
        </div>
        <div style="height:10px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin-top:5px;">
          <div style="height:100%;width:${value}%;background:rgba(56,189,248,.9);border-radius:999px;"></div>
        </div>
      </div>
    `;
  }

  async function renderFullAnalysis() {
    const pageFile = window.location.pathname.split("/").pop() || "";
    if (!pageFile.includes("match")) return;

    const params = new URLSearchParams(window.location.search);
    const teamAName = params.get("team_a") || "";
    const teamBName = params.get("team_b") || "";
    if (!teamAName || !teamBName) return;

    const teamsText = await loadText("data/teams.csv");
    const teamsMap = buildTeamsMap(parseCSV(teamsText));
    const a = getTeam(teamsMap, teamAName);
    const b = getTeam(teamsMap, teamBName);

    const ai = window.calculateMatchAIScore
      ? window.calculateMatchAIScore(a, b)
      : { winA: 33, draw: 34, winB: 33, text: "AI判断：等待数据" };

    const reason = window.explainMatchAIReason
      ? window.explainMatchAIReason(teamAName, teamBName, a, b)
      : "解释：等待数据解释模块。";

    const upset = window.renderUpsetTag
      ? window.renderUpsetTag(ai)
      : "";

    const panel = document.createElement("section");
    panel.style.cssText = `
      margin: 18px auto 34px;
      max-width: 1180px;
      padding: 24px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(20,30,54,.92));
      color: #fff;
      border: 1px solid rgba(255,255,255,.12);
    `;

    const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
      <h2 style="margin:0 0 16px;font-size:26px;">核心数据分析</h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:18px;">
        <div style="padding:16px;border-radius:16px;background:rgba(255,255,255,.06);">
          <h3 style="margin:0 0 10px;">${teamAName}</h3>
          <p>ELO：<b>${pick(a, ["elo", "ELO", "rating"])}</b></p>
          <p>近5场：<b>${pick(a, ["last5", "recent5", "form", "last_5", "recent_form"])}</b></p>
          <p>进球：<b>${pick(a, ["goals_for", "gf", "进球", "goals"])}</b></p>
          <p>失球：<b>${pick(a, ["goals_against", "ga", "失球", "conceded"])}</b></p>
        </div>

        <div style="padding:16px;border-radius:16px;background:rgba(255,255,255,.06);">
          <h3 style="margin:0 0 10px;">${teamBName}</h3>
          <p>ELO：<b>${pick(b, ["elo", "ELO", "rating"])}</b></p>
          <p>近5场：<b>${pick(b, ["last5", "recent5", "form", "last_5", "recent_form"])}</b></p>
          <p>进球：<b>${pick(b, ["goals_for", "gf", "进球", "goals"])}</b></p>
          <p>失球：<b>${pick(b, ["goals_against", "ga", "失球", "conceded"])}</b></p>
        </div>
      </div>

      ${bar(`${teamAName} 胜`, ai.winA)}
      ${bar("平局", ai.draw)}
      ${bar(`${teamBName} 胜`, ai.winB)}

      <div style="margin-top:16px;padding:12px;border-radius:14px;background:rgba(56,189,248,.12);color:#e0f2fe;font-weight:800;">
        ${ai.text}
      </div>

      <div style="margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);color:#cbd5e1;line-height:1.7;">
        ${reason}
      </div>

      ${upset}
    `;

    const main = document.querySelector("main") || document.body;
    main.prepend(panel);
  }

  // document.addEventListener("DOMContentLoaded", function () {
  // setTimeout(renderFullAnalysis, 1000);
  // });
})();

/* === DATA_HEALTH_CHECK_V13 === */
(function () {
  async function loadText(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return await res.text();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = cols[i] || "");
      return row;
    });
  }

  function pick(row, keys, fallback = "") {
    for (const k of keys) {
      if (row && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function buildTeamsMap(teams) {
    const map = {};
    teams.forEach(t => {
      const name = pick(t, ["name", "team", "team_name", "Team", "Name"], "");
      if (name) map[name] = t;
    });
    return map;
  }

  async function runDataHealthCheck() {
    const pageFile = window.location.pathname.split("/").pop() || "";
    if (!pageFile.includes("data-check")) return;

    const [matchesText, teamsText] = await Promise.all([
      loadText("data/matches.csv"),
      loadText("data/teams.csv")
    ]);

    const matches = parseCSV(matchesText);
    const teamsMap = buildTeamsMap(parseCSV(teamsText));

    const missing = [];

    matches.forEach(m => {
      const a = window.findTeamSmart ? window.findTeamSmart(teamsMap, m.team_a) : teamsMap[m.team_a];
      const b = window.findTeamSmart ? window.findTeamSmart(teamsMap, m.team_b) : teamsMap[m.team_b];

      if (!a || !Object.keys(a).length) missing.push(m.team_a);
      if (!b || !Object.keys(b).length) missing.push(m.team_b);
    });

    const uniqueMissing = [...new Set(missing)].filter(Boolean);

    const panel = document.createElement("section");
    panel.style.cssText = `
      margin: 28px auto;
      max-width: 1180px;
      padding: 24px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(20,30,54,.92));
      color: #fff;
      border: 1px solid rgba(255,255,255,.12);
    `;

    const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
      <div style="font-size:14px;color:#38bdf8;font-weight:800;">DATA HEALTH CHECK</div>
      <h1 style="margin:8px 0 12px;font-size:30px;">比赛数据关联检查</h1>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:18px 0;">
        <div style="padding:16px;border-radius:16px;background:rgba(255,255,255,.06);">
          <div style="color:#94a3b8;">比赛数量</div>
          <strong style="font-size:28px;">${matches.length}</strong>
        </div>
        <div style="padding:16px;border-radius:16px;background:rgba(255,255,255,.06);">
          <div style="color:#94a3b8;">未匹配球队</div>
          <strong style="font-size:28px;color:${uniqueMissing.length ? "#f87171" : "#86efac"};">${uniqueMissing.length}</strong>
        </div>
      </div>

      <div style="padding:16px;border-radius:16px;background:rgba(255,255,255,.06);line-height:1.8;">
        ${
          uniqueMissing.length
            ? `<b style="color:#f87171;">需要修正：</b><br>${uniqueMissing.map(x => `• ${x}`).join("<br>")}`
            : `<b style="color:#86efac;">通过：</b> matches.csv 中的球队都能匹配 teams.csv。`
        }
      </div>
    `;

    const main = document.querySelector("main") || document.body;
    main.prepend(panel);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(runDataHealthCheck, 500);
  });
})();

/* === FORCE_DATA_CHECK_PAGE_V14 === */
(function () {
  const pageFile = window.location.pathname.split("/").pop() || "";

  if (!pageFile.includes("data-check")) return;

  console.log("进入数据检测页面，清理旧渲染逻辑");

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(() => {
      const main = document.querySelector("main") || document.body;
      // main.innerHTML = ""; // disabled: 防止清空比赛页已渲染内容 // 🔥 清空旧UI
    }, 100);
  });
})();

/* === DISABLE_OLD_SYSTEM_V15 === */
(function () {
  const pageFile = window.location.pathname.split("/").pop() || "";

  if (false && pageFile.includes("data-check")) { // disabled V15 legacy system guard
    console.log("禁用旧系统渲染");

    // 🚫 阻断旧系统定时器
    const oldSetTimeout = window.setTimeout;
    window.setTimeout = function (fn, t) {
      const fnText = fn.toString();
      if (
        fnText.includes("model_vs_market") ||
        fnText.includes("render") ||
        fnText.includes("upset")
      ) {
        return;
      }
      return oldSetTimeout(fn, t);
    };

    // 🚫 清空页面
    document.addEventListener("DOMContentLoaded", function () {
      const main = document.querySelector("main") || document.body;
      // main.innerHTML = ""; // disabled: 防止清空比赛页已渲染内容
    });
  }
})();














/* === HOME_TEAMS_ENTRY_V1 === */
(function () {
  function teamHref(team) {
    const code = team.code || team.name || team.name_en || "";
    return `team.html?code=${encodeURIComponent(code)}`;
  }

  function safeText(v, fallback = "-") {
    return v && String(v).trim() ? String(v).trim() : fallback;
  }

  async function renderHomeTeamsEntry() {
    if (!location.pathname.endsWith("/") && !location.pathname.includes("index")) return;
    if (document.getElementById("home-teams-entry")) return;

    const teams = parseCSV(await loadText("data/teams.csv"))
      .filter(t => t.code && (t.name_en || t.name))
      .slice(0, 48);

    const groups = {};
    teams.forEach(t => {
      const key = t.confederation || t.continent || "Teams";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const section = document.createElement("section");
    section.id = "home-teams-entry";
    section.style.cssText = "max-width:1180px;margin:32px auto;padding:0 18px;";

    section.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px;">
        <div>
          <div style="color:#38bdf8;font-size:13px;font-weight:800;letter-spacing:.08em;">TEAM ENTRANCE</div>
          <h2 style="margin:6px 0 6px;font-size:28px;color:#e5f3ff;">48 支球队入口</h2>
          <p style="margin:0;color:#94a3b8;">先按洲际足联展示球队入口；真实分组确定后再切换为小组入口。</p>
        </div>
        <div style="color:#94a3b8;font-size:13px;">数据源：data/teams.csv</div>
      </div>

      ${Object.keys(groups).map(group => `
        <div style="margin:18px 0 22px;">
          <h3 style="color:#bfdbfe;margin:0 0 10px;font-size:18px;">${group}</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
            ${groups[group].map(t => `
              <a href="${teamHref(t)}" style="display:block;text-decoration:none;color:inherit;background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.22);border-radius:16px;padding:14px;">
                <div style="font-size:13px;color:#38bdf8;font-weight:800;">${safeText(t.code)}</div>
                <div style="font-size:18px;font-weight:900;color:#f8fafc;margin-top:4px;">${safeText(t.name_en || t.name)}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:6px;">ELO ${safeText(t.elo || t.elo_rating)} · ${safeText(t.last5)}</div>
              </a>
            `).join("")}
          </div>
        </div>
      `).join("")}
    `;

    const after = document.getElementById("today-real-matches-panel");
    if (after && after.parentNode) {
      after.parentNode.insertBefore(section, after.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // PRODUCT HOME V2: disabled old home teams entry
  });
})();
/* === HOME_VENUES_ENTRY_V1 === */
(function () {
  function safeText(v, fallback = "-") {
    return v && String(v).trim() ? String(v).trim() : fallback;
  }

  async function renderHomeVenuesEntry() {
    if (!location.pathname.endsWith("/") && !location.pathname.includes("index")) return;
    if (document.getElementById("home-venues-entry")) return;

    const matches = parseCSV(await loadText("data/matches.csv"))
      .filter(m => m.stadium_id && m.city && m.stadium);

    const venueMap = {};
    matches.forEach(m => {
      const key = m.stadium_id;
      if (!venueMap[key]) {
        venueMap[key] = {
          stadium_id: m.stadium_id,
          city: m.city,
          country: m.country,
          stadium: m.stadium,
          count: 0
        };
      }
      venueMap[key].count += 1;
    });

    const venues = Object.values(venueMap).sort((a, b) => a.city.localeCompare(b.city));

    const section = document.createElement("section");
    section.id = "home-venues-entry";
    section.style.cssText = "max-width:1180px;margin:36px auto;padding:0 18px;";

    section.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px;">
        <div>
          <div style="color:#22c55e;font-size:13px;font-weight:800;letter-spacing:.08em;">HOST CITIES</div>
          <h2 style="margin:6px 0 6px;font-size:28px;color:#e5f3ff;">16 城市 / 球场入口</h2>
          <p style="margin:0;color:#94a3b8;">按城市和球场查看赛程分布，后续可扩展天气、交通、旅行提醒。</p>
        </div>
        <div style="color:#94a3b8;font-size:13px;">数据源：data/matches.csv</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
        ${venues.map(v => `
          <a href="index.html?venue=${encodeURIComponent(v.stadium_id)}" style="display:block;text-decoration:none;color:inherit;background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.22);border-radius:18px;padding:16px;">
            <div style="font-size:13px;color:#22c55e;font-weight:900;">${safeText(v.stadium_id)}</div>
            <div style="font-size:20px;font-weight:900;color:#f8fafc;margin-top:5px;">${safeText(v.city)}</div>
            <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">${safeText(v.stadium)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:8px;">${safeText(v.country)} · ${v.count} 场比赛</div>
          </a>
        `).join("")}
      </div>
    `;

    const teams = document.getElementById("home-teams-entry");
    if (teams && teams.parentNode) {
      teams.parentNode.insertBefore(section, teams.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(renderHomeVenuesEntry, 800);
  });
})();
/* === HOME_DATA_NOTE_V1 === */
(function () {
  async function renderHomeDataNote() {
    if (!location.pathname.endsWith("/") && !location.pathname.includes("index")) return;
    if (document.getElementById("home-data-note")) return;

    const section = document.createElement("section");
    section.id = "home-data-note";
    section.style.cssText = "max-width:1180px;margin:40px auto 60px;padding:0 18px;";

    section.innerHTML = `
      <div style="background:rgba(15,23,42,.92);border:1px solid rgba(148,163,184,.24);border-radius:20px;padding:22px;">
        <div style="color:#facc15;font-size:13px;font-weight:900;letter-spacing:.08em;">DATA STATUS</div>
        <h2 style="margin:8px 0 10px;font-size:26px;color:#e5f3ff;">当前首页数据说明</h2>
        <p style="margin:0 0 12px;color:#cbd5e1;line-height:1.8;">
          当前首页优先展示世界杯赛程事实数据：比赛日期、开球时间、阶段、城市、国家和球场。
          由于部分真实对阵球队尚未完全确定，球队字段出现 TBD 属于正常状态。
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px;">
          <div style="background:rgba(2,6,23,.5);border-radius:14px;padding:14px;color:#bfdbfe;">
            <b>赛程数据</b><br>
            <span style="color:#94a3b8;font-size:13px;">data/matches.csv</span>
          </div>
          <div style="background:rgba(2,6,23,.5);border-radius:14px;padding:14px;color:#bfdbfe;">
            <b>球队数据</b><br>
            <span style="color:#94a3b8;font-size:13px;">data/teams.csv</span>
          </div>
          <div style="background:rgba(2,6,23,.5);border-radius:14px;padding:14px;color:#bfdbfe;">
            <b>近期状态</b><br>
            <span style="color:#94a3b8;font-size:13px;">data/team_recent_matches.csv</span>
          </div>
        </div>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;line-height:1.7;">
          AI 胜率、爆冷提示、ELO 对比、近 5 场状态等预测模块将在球队和比赛结构稳定后再逐步打开。
        </p>
      </div>
    `;

    const venues = document.getElementById("home-venues-entry");
    if (venues && venues.parentNode) {
      venues.parentNode.insertBefore(section, venues.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(renderHomeDataNote, 1000);
  });
})();

/* === TEAM_PROFILE_PRODUCT_V1 === */
(function () {
  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return fallback;
  }

  function getTeamCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("code") || params.get("id") || "";
  }

  function teamNameOf(t) {
    return pick(t, ["name_en", "name", "name_cn"], "Unknown Team");
  }

  async function renderTeamProductProfile() {
    if (!location.pathname.includes("team")) return;
    if (document.getElementById("team-product-profile")) return;

    const code = getTeamCode();
    const teams = parseCSV(await loadText("data/teams.csv"));
    const matches = parseCSV(await loadText("data/matches.csv"));

    const team = teams.find(t => pick(t, ["code", "team_id", "id"], "") === code) || teams[0];
    const teamCode = pick(team, ["code", "team_id", "id"], code);

    const related = matches
      .filter(m => [m.team_a, m.team_b, m.teamA, m.teamB].includes(teamCode) || [m.team_a, m.team_b, m.teamA, m.teamB].includes(teamNameOf(team)))
      .sort((a, b) => ((a.match_date || a.matchDate || "") + (a.kickoff || "")).localeCompare((b.match_date || b.matchDate || "") + (b.kickoff || "")));

    const section = document.createElement("section");
    section.id = "team-product-profile";
    section.style.cssText = "max-width:1180px;margin:28px auto 60px;padding:0 18px;";

    section.innerHTML = `
      <div style="background:rgba(15,23,42,.92);border:1px solid rgba(148,163,184,.22);border-radius:24px;padding:26px;margin-bottom:22px;">
        <div style="color:#38bdf8;font-size:13px;font-weight:900;letter-spacing:.08em;">TEAM PROFILE</div>
        <h1 style="margin:8px 0 8px;color:#f8fafc;font-size:38px;">${teamNameOf(team)}</h1>
        <p style="margin:0;color:#94a3b8;">${teamCode} · ${pick(team, ["continent"])} · ${pick(team, ["confederation", "confed"])}</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:20px;">
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>ELO</b><br><span>${pick(team, ["elo", "elo_rating"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>近5场</b><br><span>${pick(team, ["last5"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>进球</b><br><span>${pick(team, ["goals_for"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>失球</b><br><span>${pick(team, ["goals_against"])}</span></div>
        </div>
      </div>

      <div style="background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:22px;">
        <div style="color:#22c55e;font-size:13px;font-weight:900;letter-spacing:.08em;">MATCH SCHEDULE</div>
        <h2 style="margin:8px 0 14px;color:#e5f3ff;font-size:26px;">相关赛程</h2>

        ${
          related.length
            ? `<div style="display:grid;gap:12px;">
                ${related.map(m => `
                  <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:14px;background:rgba(2,6,23,.45);">
                    <div style="color:#93c5fd;font-size:13px;font-weight:800;">${pick(m, ["match_date", "matchDate"])} ${pick(m, ["kickoff"], "")} · ${pick(m, ["stage"])} ${pick(m, ["group"], "")}</div>
                    <div style="color:#f8fafc;font-size:20px;font-weight:900;margin-top:5px;">${pick(m, ["team_a", "teamA"], "TBD")} <span style="color:#94a3b8;font-size:14px;">vs</span> ${pick(m, ["team_b", "teamB"], "TBD")}</div>
                    <div style="color:#94a3b8;font-size:13px;margin-top:6px;">${pick(m, ["city"])} · ${pick(m, ["stadium"])}</div>
                  </div>
                `).join("")}
              </div>`
            : `<p style="color:#94a3b8;line-height:1.8;margin:0;">当前赛程中尚未明确关联 ${teamNameOf(team)}。这通常是因为世界杯部分对阵仍为 TBD，待真实分组/晋级路径明确后会自动显示。</p>`
        }
      </div>
    `;

    document.body.appendChild(section);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(renderTeamProductProfile, 700);
  });
})();


/* === MATCH_PRODUCT_FACT_V1 === */
(function () {
  function pick(row, keys, fallback = "-") {
    for (const k of keys) {
      if (row && row[k] !== undefined && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return fallback;
  }

  function getMatchId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("match_id") || "";
  }

  function teamLink(nameOrCode) {
    const v = nameOrCode && nameOrCode !== "TBD" ? nameOrCode : "";
    return v ? `team.html?code=${encodeURIComponent(v)}` : "#";
  }

  async function renderMatchFactV1() {
    if (!location.pathname.includes("match")) return;
    if (document.getElementById("match-product-fact-v1")) return;

    const matchId = getMatchId();
    const matches = parseCSV(await loadText("data/matches.csv"));
    const match = matches.find(m => pick(m, ["match_id", "id"], "") === matchId) || matches[0];
    if (!match) return;

    const teamA = pick(match, ["team_a", "teamA"], "TBD");
    const teamB = pick(match, ["team_b", "teamB"], "TBD");

    const section = document.createElement("section");
    section.id = "match-product-fact-v1";
    section.style.cssText = "max-width:1180px;margin:28px auto 60px;padding:0 18px;";

    section.innerHTML = `
      <div style="background:rgba(15,23,42,.94);border:1px solid rgba(148,163,184,.24);border-radius:26px;padding:26px;margin-bottom:22px;">
        <div style="color:#38bdf8;font-size:13px;font-weight:900;letter-spacing:.08em;">MATCH FACT SHEET</div>
        <h1 style="margin:8px 0 10px;color:#f8fafc;font-size:38px;">
          ${teamA} <span style="color:#94a3b8;font-size:24px;">vs</span> ${teamB}
        </h1>
        <p style="margin:0;color:#94a3b8;line-height:1.7;">
          当前比赛页优先展示赛程事实，不展示 AI 胜率、爆冷或盘口判断。
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:20px;">
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>比赛日期</b><br><span>${pick(match, ["match_date", "matchDate", "date"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>开球时间</b><br><span>${pick(match, ["kickoff"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>阶段</b><br><span>${pick(match, ["stage"])}</span></div>
          <div style="background:rgba(2,6,23,.55);border-radius:16px;padding:15px;color:#bfdbfe;"><b>小组/路径</b><br><span>${pick(match, ["group"])}</span></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:22px;">
        <a href="${teamLink(teamA)}" style="text-decoration:none;color:inherit;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:20px;">
          <div style="color:#38bdf8;font-size:13px;font-weight:900;">一方</div>
          <div style="color:#f8fafc;font-size:28px;font-weight:900;margin-top:8px;">${teamA}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:8px;">${teamA === "TBD" ? "等待真实对阵确认" : "查看球队档案 →"}</div>
        </a>

        <a href="${teamLink(teamB)}" style="text-decoration:none;color:inherit;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:20px;">
          <div style="color:#22c55e;font-size:13px;font-weight:900;">另一方</div>
          <div style="color:#f8fafc;font-size:28px;font-weight:900;margin-top:8px;">${teamB}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:8px;">${teamB === "TBD" ? "等待真实对阵确认" : "查看球队档案 →"}</div>
        </a>
      </div>

      <div style="background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:22px;">
        <div style="color:#facc15;font-size:13px;font-weight:900;letter-spacing:.08em;">VENUE & CITY</div>
        <h2 style="margin:8px 0 14px;color:#e5f3ff;font-size:26px;">比赛地点</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
          <div style="background:rgba(2,6,23,.5);border-radius:15px;padding:15px;color:#bfdbfe;"><b>城市</b><br><span>${pick(match, ["city"])}</span></div>
          <div style="background:rgba(2,6,23,.5);border-radius:15px;padding:15px;color:#bfdbfe;"><b>国家</b><br><span>${pick(match, ["country"])}</span></div>
          <div style="background:rgba(2,6,23,.5);border-radius:15px;padding:15px;color:#bfdbfe;"><b>球场</b><br><span>${pick(match, ["stadium", "venue"])}</span></div>
          <div style="background:rgba(2,6,23,.5);border-radius:15px;padding:15px;color:#bfdbfe;"><b>球场编号</b><br><span>${pick(match, ["stadium_id"])}</span></div>
        </div>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;line-height:1.7;">
          后续可扩展：天气、交通、入场提醒、城市旅行提示。当前版本只展示赛程事实。
        </p>
      </div>
    `;

    document.body.appendChild(section);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(renderMatchFactV1, 700);
  });
})();



































/* =========================
   SIMPLE AI PROBABILITY V1
========================= */

function formScore(last5 = "") {
  let score = 0;

  for (const c of String(last5).toUpperCase()) {
    if (c === "W") score += 3;
    if (c === "D") score += 1;
  }

  return score;
}

function renderSimpleAIProbability(match, a, b) {
  const panel = document.getElementById("simple-ai-probability");

  if (!panel) return;

  const realA = window.allTeams?.find(
    t => t.code === a.code || t.code === match.team_a_code
  ) || a;

  const realB = window.allTeams?.find(
    t => t.code === b.code || t.code === match.team_b_code
  ) || b;

  a = realA;
  b = realB;

  const eloA = Number(a.elo || 1500);
  const eloB = Number(b.elo || 1500);

  const attackA = Number(a.attack_rating || 70);
  const attackB = Number(b.attack_rating || 70);

  const defenseA = Number(a.defense_rating || 70);
  const defenseB = Number(b.defense_rating || 70);

  const formA = formScore(a.last5 || "");
  const formB = formScore(b.last5 || "");

  const totalA =
    eloA * 0.72 +
    attackA * 5 +
    defenseA * 5 +
    formA * 10;

  const totalB =
    eloB * 0.72 +
    attackB * 5 +
    defenseB * 5 +
    formB * 10;

  const diff = totalA - totalB;

  let aWin = 50 + diff / 18;
  let draw = 22 - Math.abs(diff) / 90;
  let bWin = 100 - aWin - draw;

  aWin = Math.max(10, Math.min(80, aWin));
  draw = Math.max(10, Math.min(30, draw));
  bWin = Math.max(10, Math.min(80, bWin));

  const aHighlight = aWin >= bWin && aWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(59,130,246,.28),0 25px 55px rgba(59,130,246,.25);"
    : "";

  const drawHighlight = draw >= aWin && draw >= bWin
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(34,197,94,.28),0 25px 55px rgba(34,197,94,.25);"
    : "";

  const bHighlight = bWin >= aWin && bWin >= draw
    ? "transform:scale(1.04);box-shadow:0 0 0 3px rgba(245,158,11,.28),0 25px 55px rgba(245,158,11,.25);"
    : "";

  const dataScore = [
    a.elo, b.elo,
    a.attack_rating, b.attack_rating,
    a.defense_rating, b.defense_rating,
    a.last5, b.last5,
    a.fifa_rank, b.fifa_rank
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "待补充").length;

  const dataConfidence =
    dataScore >= 9 ? "高" :
    dataScore >= 6 ? "中" :
    "低";

  const aiSummaryText =
    `${a.name} vs ${b.name}：${a.name} 胜率 ${Math.round(aWin)}%，平局 ${Math.round(draw)}%，${b.name} 胜率 ${Math.round(bWin)}%。模型倾向：${aWin > bWin ? a.name : b.name} 略占优势。爆冷风险：${Math.abs(aWin - bWin) < 12 ? "较高" : Math.abs(aWin - bWin) < 22 ? "中等" : "较低"}。`;

  panel.innerHTML = `
    <div style="margin-bottom:18px;padding:16px 18px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
      <div style="margin-bottom:10px;">
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:900;font-size:13px;">
          数据可信度：${dataConfidence}
        </span>

        <span style="display:inline-block;margin-left:8px;padding:5px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:900;font-size:13px;">
          市场数据：待接入
        </span>
      </div>

      <button id="copy-ai-summary-btn" style="float:right;padding:8px 12px;border:0;border-radius:999px;background:#0f172a;color:#fff;font-weight:800;cursor:pointer;">
        复制分析摘要
      </button>

      <strong>AI 一句话结论：</strong>
      ${
        Math.abs(aWin - bWin) < 10
          ? "双方数据接近，本场不确定性较高。"
          : aWin > bWin
          ? `${a.name} 当前模型优势更明显，但仍需关注临场状态。`
          : `${b.name} 当前模型优势更明显，但仍需关注临场状态。`
      }
    </div>

    <div class="signal-grid">

      <div class="signal-card blue" style="box-shadow:0 0 0 2px rgba(59,130,246,.18),0 18px 38px rgba(15,23,42,.12);${aHighlight}">
        <span>${a.name || "一方"} 胜率</span>
        <strong style="font-size:34px;line-height:1.1;">${Math.round(aWin)}%</strong>
        <p>${a.name || "一方"} 当前模型概率</p>
      </div>

      <div class="signal-card green" style="box-shadow:0 0 0 2px rgba(34,197,94,.16),0 18px 38px rgba(15,23,42,.10);${drawHighlight}">
        <span>平局概率</span>
        <strong style="font-size:34px;line-height:1.1;">${Math.round(draw)}%</strong>
        <p>双方接近时平局概率会上升</p>
      </div>

      <div class="signal-card orange" style="box-shadow:0 0 0 2px rgba(245,158,11,.18),0 18px 38px rgba(15,23,42,.12);${bHighlight}">
        <span>${b.name || "另一方"} 胜率</span>
        <strong style="font-size:34px;line-height:1.1;">${Math.round(bWin)}%</strong>
        <p>${b.name || "另一方"} 当前模型概率</p>
      </div>

    </div>

    <div class="ai-box" style="margin-top:20px;">

      <p>
        AI 模型当前综合参考：
        ELO、攻防评分、近期状态（last5）。
      </p>

      <div style="margin-top:18px;">

        <div style="margin-bottom:12px;">
          <strong>${a.name}</strong>
          <div style="height:10px;background:#dbeafe;border-radius:999px;margin-top:6px;overflow:hidden;">
            <div style="width:${Math.round(aWin)}%;height:100%;background:#3b82f6;"></div>
          </div>
          <div style="margin-top:4px;">胜率 ${Math.round(aWin)}%</div>
        </div>

        <div style="margin-bottom:12px;">
          <strong>平局概率</strong>
          <div style="height:10px;background:#dcfce7;border-radius:999px;margin-top:6px;overflow:hidden;">
            <div style="width:${Math.round(draw)}%;height:100%;background:#22c55e;"></div>
          </div>
          <div style="margin-top:4px;">平局 ${Math.round(draw)}%</div>
        </div>

        <div style="margin-bottom:18px;">
          <strong>${b.name}</strong>
          <div style="height:10px;background:#fef3c7;border-radius:999px;margin-top:6px;overflow:hidden;">
            <div style="width:${Math.round(bWin)}%;height:100%;background:#f59e0b;"></div>
          </div>
          <div style="margin-top:4px;">胜率 ${Math.round(bWin)}%</div>
        </div>

      </div>

      <div class="signal-grid" style="margin-top:20px;">

        <div class="signal-card blue">
          <span>ELO 对比</span>
          <strong>${a.elo || 1500} vs ${b.elo || 1500}</strong>
          <p>基础实力评分</p>
        </div>

        <div class="signal-card green">
          <span>攻击评分</span>
          <strong>${a.attack_rating || 70} vs ${b.attack_rating || 70}</strong>
          <p>前场进攻能力</p>
        </div>

        <div class="signal-card orange">
          <span>防守评分</span>
          <strong>${a.defense_rating || 70} vs ${b.defense_rating || 70}</strong>
          <p>后场稳定能力</p>
        </div>

      </div>

      <div style="margin-top:22px;">

        <div style="margin-bottom:18px;">
          <strong>近期状态：</strong>

          <div style="margin-top:8px;font-size:13px;color:#64748b;">
            🟢 胜　🟡 平　🔴 负
          </div>

          <div style="margin-top:10px;">
            ${a.name}：
            ${renderLast5Dots(a.last5)}
          </div>

          <div style="margin-top:10px;">
            ${b.name}：
            ${renderLast5Dots(b.last5)}
          </div>
        </div>

        <div style="margin-bottom:18px;padding:16px 18px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
      <div style="margin-bottom:10px;">
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:900;font-size:13px;">
          数据可信度：${dataConfidence}
        </span>

        <span style="display:inline-block;margin-left:8px;padding:5px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:900;font-size:13px;">
          市场数据：待接入
        </span>
      </div>

      <button id="copy-ai-summary-btn" style="float:right;padding:8px 12px;border:0;border-radius:999px;background:#0f172a;color:#fff;font-weight:800;cursor:pointer;">
        复制分析摘要
      </button>

      <strong>AI 一句话结论：</strong>
      ${
        Math.abs(aWin - bWin) < 10
          ? "双方数据接近，本场不确定性较高。"
          : aWin > bWin
          ? `${a.name} 当前模型优势更明显，但仍需关注临场状态。`
          : `${b.name} 当前模型优势更明显，但仍需关注临场状态。`
      }
    </div>

    <div class="signal-grid">

          <div class="signal-card blue">
            <span>FIFA Rank</span>
            <strong>${a.fifa_rank || "N/A"} vs ${b.fifa_rank || "N/A"}</strong>
            <p>国际足联排名</p>
          </div>

          <div class="signal-card green">
            <span>关键球员</span>
            <strong>${a.star_player || "待补充"}</strong>
            <p>${b.star_player || "待补充"}</p>
          </div>

          <div class="signal-card orange">
            <span>世界杯冠军数</span>
            <strong>${a.world_cup_titles || 0} vs ${b.world_cup_titles || 0}</strong>
            <p>世界杯历史底蕴</p>
          </div>

        </div>

      </div>

      <div style="margin-top:16px;">
        <strong>模型倾向：</strong>
        ${
          aWin > bWin
            ? `${a.name} 略占优势`
            : `${b.name} 略占优势`
        }
      </div>

      <div style="margin-top:10px;">
        <strong>爆冷风险：</strong> <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:800;">
        ${
          Math.abs(aWin - bWin) < 12
            ? "较高"
            : Math.abs(aWin - bWin) < 22
            ? "中等"
            : "较低"
        }</span>
      </div>

      <div style="margin-top:22px;padding:16px 18px;border:1px dashed #cbd5e1;border-radius:18px;background:#f8fafc;">
        <strong>模型说明：</strong>
        <p style="margin:8px 0 0;">
          当前模型参考 ELO、攻防评分、FIFA Rank、近期状态 last5。
          市场赔率、首发阵容、伤停名单、天气与比赛地因素接入后，可信度会继续提升。
        </p>
      </div>

      <p style="margin-top:18px;">
        本功能仅用于世界杯赛事数据分析与观赛参考，
        不构成任何下注或投资建议。
      </p>

    </div>
  `;

  const copyBtn = document.getElementById("copy-ai-summary-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(aiSummaryText);
        copyBtn.textContent = "已复制";
        setTimeout(() => copyBtn.textContent = "复制分析摘要", 1400);
      } catch (e) {
        window.prompt("请手动复制分析摘要：", aiSummaryText);
        copyBtn.textContent = "已打开复制框";
        setTimeout(() => copyBtn.textContent = "复制分析摘要", 1400);
      }
    });
  }
}









function renderLast5Dots(last5 = "") {
  return String(last5)
    .toUpperCase()
    .split("")
    .map(c => {
      if (c === "W") {
        return `<span style="display:inline-block;width:12px;height:12px;background:#22c55e;border-radius:999px;margin-right:6px;" title="Win"></span>`;
      }

      if (c === "D") {
        return `<span style="display:inline-block;width:12px;height:12px;background:#facc15;border-radius:999px;margin-right:6px;" title="Draw"></span>`;
      }

      return `<span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:999px;margin-right:6px;" title="Loss"></span>`;
    })
    .join("");
}














/* =========================
   DATA SOURCES STATUS PANEL
========================= */

async function renderDataSourcesPanel() {
  const box = document.getElementById("data-sources-table");
  if (!box) return;

  box.innerHTML = `
    <div class="muted">正在读取 API 数据源状态...</div>
  `;

  try {
    const text = await loadText("data/data_sources.csv");
    const rows = parseCSV(text);

    box.innerHTML = `
      <div style="overflow:auto;background:#fff;border:1px solid #dbeafe;border-radius:18px;padding:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;">数据类型</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;">来源</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;">状态</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;">更新频率</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;">说明</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="padding:12px;border-bottom:1px solid #eef2f7;font-weight:900;">${r.data_type || ""}</td>
                <td style="padding:12px;border-bottom:1px solid #eef2f7;">${r.api_name || ""}</td>
                <td style="padding:12px;border-bottom:1px solid #eef2f7;">
                  <span style="padding:4px 10px;border-radius:999px;font-weight:900;background:${r.status === "active" ? "#dcfce7" : "#fef3c7"};color:${r.status === "active" ? "#166534" : "#92400e"};">
                    ${r.status || "pending"}
                  </span>
                </td>
                <td style="padding:12px;border-bottom:1px solid #eef2f7;">${r.update_frequency || ""}</td>
                <td style="padding:12px;border-bottom:1px solid #eef2f7;color:#64748b;">${r.notes || ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    box.innerHTML = `
      <div style="padding:18px;border-radius:18px;background:#fee2e2;color:#991b1b;font-weight:800;">
        data_sources.csv 读取失败，请检查文件路径：data/data_sources.csv
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", renderDataSourcesPanel);




/* === FORCE_RENDER_DATA_SOURCES_V1 === */
(function () {

  async function forceRenderDataSourcesPanel() {

    const page =
      window.location.pathname.split("/").pop() || "index.html";

    if (!page.includes("vip")) return;

    const box = document.getElementById("data-sources-table");

    if (!box) return;

    // 防止重复渲染
    if (box.dataset.loaded === "1") return;

    box.innerHTML = `
      <div style="padding:12px;color:#666;">
        正在加载 API 数据接入状态...
      </div>
    `;

    try {

      const text = await loadText("data/data_sources.csv");

      const rows = parseCSV(text);

      if (!rows || rows.length === 0) {
        box.innerHTML = `
          <div style="padding:12px;color:#c00;">
            data_sources.csv 无数据
          </div>
        `;
        return;
      }

      const dataRows = rows.slice(1);

      const html = dataRows.map(r => {

        const statusColor =
          r.status === "active"
            ? "#16a34a"
            : "#2563eb";

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;">${r.data_type}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${r.provider}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${r.api_name}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">
              <span style="
                padding:4px 10px;
                border-radius:999px;
                background:${statusColor}15;
                color:${statusColor};
                font-weight:700;
                font-size:12px;
              ">
                ${r.status}
              </span>
            </td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${r.update_frequency}</td>
          </tr>
        `;

      }).join("");

      box.innerHTML = `
        <div style="overflow:auto;">
          <table style="
            width:100%;
            border-collapse:collapse;
            background:#fff;
            border-radius:16px;
            overflow:hidden;
          ">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:12px;text-align:left;">数据类型</th>
                <th style="padding:12px;text-align:left;">Provider</th>
                <th style="padding:12px;text-align:left;">API</th>
                <th style="padding:12px;text-align:left;">状态</th>
                <th style="padding:12px;text-align:left;">更新频率</th>
              </tr>
            </thead>
            <tbody>
              ${html}
            </tbody>
          </table>
        </div>
      `;

      box.dataset.loaded = "1";

    } catch (err) {

      box.innerHTML = `
        <div style="padding:12px;color:#c00;">
          API 数据状态加载失败
        </div>
      `;

    }
  }

  setTimeout(forceRenderDataSourcesPanel, 1200);

})();

/* === MATCH_WEATHER_CARD_V1 === */
(function () {
  function parseSimpleCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(",");
    return lines.map(line => {
      const cells = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      headers.forEach((h, i) => {
        row[h] = (cells[i] || "").replace(/^"|"$/g, "");
      });
      return row;
    });
  }

  function getWeatherText(condition) {
    const map = {
      clear: "晴朗",
      sunny: "晴天",
      partly_cloudy: "局部多云",
      cloudy: "多云",
      light_rain: "小雨",
      humid: "湿热",
      hot: "炎热"
    };
    return map[condition] || condition || "天气已接入";
  }

  async function renderMatchWeatherCard() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    if (!page.includes("match")) return;

    const box = document.getElementById("match-weather-fact");
    if (!box) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const matchId = params.get("id") || "M001";

      const res = await fetch("data/venues_weather.csv");
      const text = await res.text();
      const rows = parseSimpleCSV(text);

      const item = rows.find(r => r.match_id === matchId) || rows[0];

      if (!item) {
        box.innerHTML = '<span>天气 / 海拔</span><strong>暂无可靠数据</strong>';
        return;
      }

      box.innerHTML = `
        <span>天气 / 海拔</span>
        <strong>${getWeatherText(item.weather_condition)} · ${item.temperature}°C · 海拔 ${item.altitude}m</strong>
        <small style="display:block;margin-top:6px;color:#64748b;line-height:1.5;">
          ${item.city} · ${item.stadium}<br>
          湿度 ${item.humidity}% · 风速 ${item.wind_speed} km/h · 降雨概率 ${item.rain_probability}%<br>
          数据源：${item.source} · 更新时间：${item.last_updated}
        </small>
      `;
    } catch (err) {
      box.innerHTML = '<span>天气 / 海拔</span><strong>天气数据加载失败</strong>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMatchWeatherCard);
  } else {
    renderMatchWeatherCard();
  }
})();






/* === HOME_2022_INTERESTING_SAMPLES_V1 === */
(function () {
  function parseCsvLocal(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (cell !== "" || row.length) {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        }
        if (ch === "\r" && next === "\n") i++;
      } else {
        cell += ch;
      }
    }

    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map(x => String(x || "").trim());
    return rows
      .filter(r => r.some(x => String(x || "").trim() !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = String(r[idx] || "").trim());
        return obj;
      });
  }

  function pick(row, keys, fallback) {
    for (const key of keys) {
      if (row && row[key] !== undefined && String(row[key]).trim() !== "") {
        return String(row[key]).trim();
      }
    }
    return fallback || "";
  }

  function labelType(type) {
    const t = String(type || "").toLowerCase();
    if (t.includes("high_possession")) return "控球陷阱";
    if (t.includes("low_shots")) return "低射门赢球";
    if (t.includes("big_score")) return "大比分样本";
    return "历史样本";
  }

  function renderSampleCard(row) {
    const type = labelType(pick(row, ["sample_type", "type", "category"], "历史样本"));
    const team = pick(row, ["team", "team_name", "side", "winner"], "相关球队");
    const opponent = pick(row, ["opponent", "against", "other_team"], "");
    const match = team.includes(" vs ") ? team : (opponent.includes(" vs ") ? opponent : (opponent ? `${team} vs ${opponent}` : team));
    const stage = pick(row, ["stage", "round", "fixture_round"], "2022 World Cup");
    const score = pick(row, ["score", "result", "full_time_score"], "");
    const note = pick(row, ["note", "summary", "reason", "description"], "该样本来自 2022 世界杯真实历史数据整理，用于提示比赛结果与单一指标之间可能存在偏差。");

    return `
      <article class="card" style="min-height:180px;padding:22px;border-radius:22px;background:rgba(255,255,255,.88);border:1px solid rgba(12,80,70,.12);box-shadow:0 16px 38px rgba(15,23,42,.06);">
        <div class="tag" style="display:inline-flex;width:max-content;padding:6px 12px;border-radius:999px;background:#e8fff6;color:#047857;font-weight:900;font-size:13px;letter-spacing:.04em;">${type}</div>
        <h3 style="margin:14px 0 8px;font-size:22px;color:#0f2f2b;">${match}</h3>
        <p class="muted" style="margin:0 0 10px;color:#64748b;font-weight:700;">${stage}${score ? " · " + score : ""}</p>
        <p style="margin:0;color:#334155;line-height:1.75;font-size:15px;">${note}</p>
      </article>
    `;
  }

  async function renderHomeInterestingSamples() {
    const box = document.getElementById("homeInterestingSamplesList");
    if (!box) return;

    try {
      const res = await fetch("./data/worldcup_2022_interesting_samples.csv?v=" + Date.now());
      if (!res.ok) throw new Error("worldcup_2022_interesting_samples.csv 加载失败 " + res.status);

      const rows = parseCsvLocal(await res.text());
      if (!rows.length) {
        box.innerHTML = `<div class="muted">暂无可展示的 2022 世界杯历史样本。</div>`;
        return;
      }

      const preferred = [];
      const usedTypes = new Set();

      for (const row of rows) {
        const rawType = pick(row, ["sample_type", "type", "category"], "sample");
        if (!usedTypes.has(rawType)) {
          preferred.push(row);
          usedTypes.add(rawType);
        }
        if (preferred.length >= 3) break;
      }

      const list = preferred.length >= 3 ? preferred : rows.slice(0, 3);
      box.innerHTML = list.map(renderSampleCard).join("") + `
        <div class="muted" style="grid-column:1/-1;margin-top:4px;">
          数据源：API-Football 2022 World Cup 历史样本库整理结果。该模块展示历史样本，不代表 2026 实时状态，不构成比赛结论。
        </div>
      `;
    } catch (err) {
      console.warn(err);
      box.innerHTML = `<div class="muted">2022 世界杯历史样本暂未加载成功，请检查 data/worldcup_2022_interesting_samples.csv。</div>`;
    }
  }

    if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHomeInterestingSamples);
  } else {
    renderHomeInterestingSamples();
  }
})();







/* === MATCH_HISTORY_SAMPLES_V1 === */
(function () {
  function parseCSVLocal(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (cell !== "" || row.length) {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        }
        if (ch === "\r" && next === "\n") i++;
      } else {
        cell += ch;
      }
    }

    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map(x => String(x || "").trim());
    return rows
      .filter(r => r.some(x => String(x || "").trim() !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = String(r[idx] || "").trim());
        return obj;
      });
  }

  async function loadCSVLocal(path) {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("无法读取 " + path);
    return parseCSVLocal(await res.text());
  }

  function getMatchId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("match_id") || "1";
  }

  function pick(row, keys, fallback) {
    for (const key of keys) {
      const value = row && row[key];
      if (value !== undefined && String(value).trim() !== "") return String(value).trim();
    }
    return fallback || "";
  }

  function sampleLabel(type) {
    const t = String(type || "").toLowerCase();
    if (t.includes("high_possession")) return "控球陷阱";
    if (t.includes("low_shots")) return "低射门赢球";
    if (t.includes("big_score")) return "大比分样本";
    return "历史样本";
  }

  function sampleNote(row) {
    const type = String(row.sample_type || "").toLowerCase();
    const team = pick(row, ["team"], "相关球队");
    const result = pick(row, ["result"], "");
    const possession = pick(row, ["ball_possession"], "");
    const shots = pick(row, ["total_shots"], "");
    const score = pick(row, ["score"], "");

    if (type.includes("high_possession")) {
      return `${team} 控球率 ${possession || "-"}%，但结果为 ${result || "未胜"}。提醒：控球高不等于一定赢球。`;
    }

    if (type.includes("low_shots")) {
      return `${team} 全场射门 ${shots || "-"} 次，但最终赢下比赛。提醒：射门数量之外，还要看效率、反击和机会质量。`;
    }

    if (type.includes("big_score")) {
      return `${team} 参与的大比分样本，比分 ${score || "-"}。提醒：世界杯存在情绪、节奏和临场崩盘风险。`;
    }

    return "该样本来自 2022 世界杯真实历史数据整理，用于辅助理解比赛指标，不代表当前比赛结论。";
  }

  function buildCard(row) {
    const type = sampleLabel(row.sample_type);
    const team = pick(row, ["team"], "相关球队");
    const opponent = pick(row, ["opponent"], "");
    const match = opponent ? `${team} vs ${opponent}` : team;
    const round = pick(row, ["round"], "2022 World Cup");
    const score = pick(row, ["score"], "");

    return `
      <article style="
        padding:18px;
        border-radius:20px;
        border:1px solid rgba(12,80,70,.14);
        background:rgba(255,255,255,.94);
        box-shadow:0 12px 28px rgba(15,23,42,.05);
      ">
        <div style="display:inline-flex;padding:5px 10px;border-radius:999px;background:#e8fff6;color:#047857;font-weight:900;font-size:12px;">${type}</div>
        <h3 style="margin:12px 0 8px;color:#0f2f2b;font-size:20px;">${match}</h3>
        <p style="margin:0 0 8px;color:#64748b;font-weight:700;">${round}${score ? " · " + score : ""}</p>
        <p style="margin:0;color:#334155;line-height:1.7;font-size:14px;">${sampleNote(row)}</p>
      </article>
    `;
  }

  function chooseSamples(rows, teamA, teamB) {
    const names = [teamA, teamB].map(x => String(x || "").toLowerCase()).filter(Boolean);

    const related = rows.filter(row => {
      const team = String(row.team || "").toLowerCase();
      const opponent = String(row.opponent || "").toLowerCase();
      return names.some(name => team === name || opponent === name);
    });

    const source = related.length ? related : rows;
    const selected = [];
    const usedTypes = new Set();

    for (const row of source) {
      const type = String(row.sample_type || "sample");
      if (!usedTypes.has(type)) {
        selected.push(row);
        usedTypes.add(type);
      }
      if (selected.length >= 3) break;
    }

    return selected.length ? selected : source.slice(0, 3);
  }

  async function renderMatchHistorySamplesV1() {
    if (!location.pathname.includes("match")) return;
    if (document.getElementById("match-history-samples-v1")) return;

    try {
      const matchId = getMatchId();
      const matches = await loadCSVLocal("data/matches.csv");
      const samples = await loadCSVLocal("data/worldcup_2022_interesting_samples.csv");

      const match =
        matches.find(row => String(row.match_id || row.id || "").trim() === String(matchId).trim()) ||
        matches[0];

      if (!match || !samples.length) return;

      const teamA = pick(match, ["team_a", "teamA", "home"], "对阵一方");
      const teamB = pick(match, ["team_b", "teamB", "away"], "对阵另一方");
      const selected = chooseSamples(samples, teamA, teamB);

      const section = document.createElement("section");
      section.id = "match-history-samples-v1";
      section.className = "analysis-card";
      section.style.cssText = "margin-top:22px;";

      section.innerHTML = `
        <p class="eyebrow">WORLD CUP HISTORY SIGNALS</p>
        <h2>世界杯历史样本提醒</h2>
        <p class="muted" style="margin-bottom:16px;">
          当前比赛为 ${teamA} vs ${teamB}。以下样本来自 2022 世界杯真实历史数据，用于提醒用户不要只看单一指标；不代表 2026 实时状态，也不构成比赛结论。
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;">
          ${selected.map(buildCard).join("")}
        </div>
        <p class="muted" style="margin-top:14px;">
          数据源：2022 World Cup 历史样本库整理结果。后续可升级为按赔率结构、控球结构、射门结构、球队风格自动匹配的历史相似样本引擎。
        </p>
      `;

      const target =
        document.getElementById("bookmaker-market-summary") ||
        document.getElementById("match-data-summary-v1") ||
        document.getElementById("match-product-fact-v1") ||
        document.querySelector("main") ||
        document.body;

      if (target.parentNode && target !== document.body) {
        target.parentNode.insertBefore(section, target.nextSibling);
      } else {
        target.appendChild(section);
      }
    } catch (err) {
      console.warn("世界杯历史样本提醒渲染失败：", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(renderMatchHistorySamplesV1, 900);
    });
  } else {
    setTimeout(renderMatchHistorySamplesV1, 900);
  }
})();


/* === CITY_CARD_SAFE_CLICK_V1 ===
   Safe patch: do not replace renderHomeCitiesV2.
   It only makes existing homepage city cards clickable after they are rendered.
*/
(function () {
  const venueMap = {
    "Mexico City": "MEX",
    "Guadalajara": "GDL",
    "Atlanta": "ATL",
    "Monterrey": "MTY",
    "Toronto": "TOR",
    "San Francisco Bay Area": "SF",
    "Los Angeles": "LA",
    "Vancouver": "VAN",
    "Boston": "BOS",
    "Dallas": "DAL",
    "Houston": "HOU",
    "Kansas City": "KC",
    "Miami": "MIA",
    "New York/New Jersey": "NYNJ",
    "Philadelphia": "PHI",
    "Seattle": "SEA"
  };

  function activateCityCards() {
    const grid = document.querySelector("#home-cities-grid");
    if (!grid) return;

    const cards = grid.querySelectorAll(".city-venue-card");
    cards.forEach(card => {
      if (card.dataset.cityClickReady === "1") return;

      const title = card.querySelector("h3");
      const city = title ? title.textContent.trim() : "";
      const venueId = venueMap[city];

      if (!venueId) return;

      card.dataset.cityClickReady = "1";
      card.style.cursor = "pointer";
      card.setAttribute("tabindex", "0");
      card.setAttribute("title", "查看 " + city + " 承办比赛与球场环境数据");

      card.addEventListener("click", function () {
        window.location.href = "city.html?venue_id=" + encodeURIComponent(venueId);
      });

      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          window.location.href = "city.html?venue_id=" + encodeURIComponent(venueId);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(activateCityCards, 300);
    setTimeout(activateCityCards, 900);
    setTimeout(activateCityCards, 1800);
  });
})();


