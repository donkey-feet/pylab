#!/usr/bin/env node
// Resolves numeric skill-tree / paragon node IDs in a Maxroll D4 build export into human-readable names.
// Usage: node resolve-build.js <build.json> [output.json] [gamedata.json] [locale.json]

const fs = require("fs");
const path = require("path");

const [, , buildArg, outArg, gameDataArg, localeArg] = process.argv;

if (!buildArg) {
  console.error("Usage: node resolve-build.js <build.json> [output.json] [gamedata.json] [locale.json]");
  process.exit(1);
}

const buildPath = path.resolve(buildArg);
const outPath = path.resolve(outArg || buildArg.replace(/\.json$/i, ".readable.json"));
const gameDataPath = path.resolve(gameDataArg || "maxroll-gamedata.json");
const localePath = path.resolve(localeArg || "maxroll-locale.json");

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

const gd = readJson(gameDataPath);
const locale = readJson(localePath);

const rawBuild = readJson(buildPath);
const data = JSON.parse(rawBuild.data.replace(/^\uFEFF/, ""));

function localeName(category, code) {
  if (!code) return code;
  const entry = locale[category] && locale[category][code];
  return (entry && entry.name) || code;
}

// Generic (unnamed) paragon board tiles follow predictable prefixes.
function prettifyGenericNode(key) {
  if (!key) return null;
  const m = key.match(/^Generic_(Normal|Magic)_(\w+)$/);
  if (m) {
    const tier = m[1] === "Normal" ? "Minor" : "Magic";
    return `${tier} Node (${m[2]})`;
  }
  if (key === "Generic_Socket") return "Socket";
  if (key === "Generic_Gate") return "Board Gate";
  return null;
}

function resolveParagonNode(nodeKey) {
  if (!nodeKey) return null;
  const named = locale.paragonNodes && locale.paragonNodes[nodeKey] && locale.paragonNodes[nodeKey].name;
  if (named) return named;
  const generic = prettifyGenericNode(nodeKey);
  if (generic) return generic;
  return nodeKey; // unresolved fallback, keep raw code for visibility
}

function resolveSkillTree(classData, className) {
  const tree = gd.skillTrees[className];
  if (!tree) return classData;
  const nodesById = new Map(tree.nodes.map((n) => [n.id, n]));

  return classData.map((step) => {
    const resolved = {};
    for (const [idStr, value] of Object.entries(step.data)) {
      const id = Number(idStr);
      const node = nodesById.get(id);
      const rewardId = node && node.rewardId;
      const reward = rewardId && gd.skillTreeRewards[rewardId];
      const skillCode = reward && reward.power;
      let name = skillCode ? localeName("skills", skillCode) : rewardId ? localeName("skills", rewardId) : `#${id} (unresolved)`;
      if (reward && reward.type === 1 && skillCode) {
        const mods = gd.skills[skillCode] && gd.skills[skillCode].mods;
        const idx = mods ? mods.findIndex((m) => m.id === reward.mod) : -1;
        const localeMods = locale.skills[skillCode] && locale.skills[skillCode].mods;
        const modName = idx >= 0 && localeMods ? localeMods[idx] && localeMods[idx].name : null;
        if (modName) name = `${name}: ${modName}`;
      }
      resolved[idStr] = { name, value, rewardId: rewardId || null, skillCode: skillCode || null };
    }
    return { name: step.name, data: resolved };
  });
}

function resolveParagon(paragonSteps) {
  return paragonSteps.map((step) => ({
    name: step.name,
    boards: step.data.map((board) => {
      const boardName = localeName("paragonBoards", board.id);
      const boardDef = gd.paragonBoards[board.id];
      const nodes = {};
      for (const [posStr, value] of Object.entries(board.nodes)) {
        const pos = Number(posStr);
        const nodeKey = boardDef ? boardDef.nodes[pos] : null;
        nodes[posStr] = { name: resolveParagonNode(nodeKey), value, nodeKey: nodeKey || null };
      }
      return {
        boardId: board.id,
        boardName,
        rotation: board.rotation,
        position: board.position,
        glyph: board.glyph ? { code: board.glyph, name: localeName("paragonGlyphs", board.glyph), level: board.glyphLevel } : null,
        nodes,
      };
    }),
  }));
}

const result = {
  id: rawBuild.id,
  name: rawBuild.name,
  date: rawBuild.date,
  class: rawBuild.class,
  profiles: data.profiles.map((profile) => {
    const className = (gd.classes[profile.class] && gd.classes[profile.class].name) || profile.class;
    return {
      name: profile.name,
      class: className,
      level: profile.level,
      worldTier: profile.worldTier,
      skillBar: (profile.skillBar || []).map((code) => ({ code, name: localeName("skills", code) })),
      skillTree: resolveSkillTree(profile.skillTree.steps, className),
      paragon: resolveParagon(profile.paragon.steps),
    };
  }),
};

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
console.log(`Wrote resolved build to ${outPath}`);
