#!/usr/bin/env node
// Generates a mobile-friendly HTML build guide from a Maxroll D4Planner export,
// mirroring the look of bloodwave.html but fully data-driven.
// Usage: node build-to-html.js <build.json> [output.html] [gamedata.json] [locale.json] [--title "Custom Title"]

const fs = require("fs");
const path = require("path");

const rawArgs = process.argv.slice(2);
const titleIdx = rawArgs.indexOf("--title");
const titleOverride = titleIdx >= 0 ? rawArgs[titleIdx + 1] : null;
const positional = titleIdx >= 0 ? rawArgs.slice(0, titleIdx) : rawArgs;
const [buildArg, outArg, gameDataArg, localeArg] = positional;

if (!buildArg) {
  console.error("Usage: node build-to-html.js <build.json> [output.html] [gamedata.json] [locale.json]");
  process.exit(1);
}

const buildPath = path.resolve(buildArg);
const outPath = path.resolve(outArg || buildArg.replace(/\.json$/i, ".html"));
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

// Reverse lookup: numeric affix id -> affix code, needed since item explicits/tempers/aspects
// only store the numeric id, but gd.affixes/locale.affixes are keyed by string code.
const affixIdToCode = new Map();
for (const [code, def] of Object.entries(gd.affixes)) {
  if (def && def.id != null) affixIdToCode.set(def.id, code);
}

function localeName(category, code) {
  if (!code) return code;
  const entry = locale[category] && locale[category][code];
  return (entry && entry.name) || code;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Repairs UTF-8 text that was accidentally double-encoded (e.g. "Ã©" instead of "é").
function fixMojibake(str) {
  if (typeof str !== "string" || !/[ÃÂâ€]/.test(str)) return str;
  try {
    const fixed = Buffer.from(str, "latin1").toString("utf8");
    if (!/\uFFFD/.test(fixed) && !/[ÃÂâ€]/.test(fixed)) return fixed;
  } catch {
    // fall through
  }
  return str;
}

const EMBED_CLASS = { "d4-item": "orange", "d4-skill": "blood", "d4-mod": "purple", "d4-affix": "blue" };

// Lexical rich-text tree -> HTML. Embed nodes already carry their resolved display text.
function renderLexical(node) {
  if (!node) return "";
  const kids = () => (node.children || []).map(renderLexical).join("");
  switch (node.type) {
    case "root":
      return kids();
    case "paragraph": {
      const inner = kids();
      return inner.trim() ? `<p>${inner}</p>` : "";
    }
    case "heading":
      return `<${node.tag || "h4"}>${kids()}</${node.tag || "h4"}>`;
    case "list":
      return `<${node.listType === "number" ? "ol" : "ul"}>${kids()}</${node.listType === "number" ? "ol" : "ul"}>`;
    case "listitem":
      return `<li>${kids()}</li>`;
    case "quote":
      return `<blockquote>${kids()}</blockquote>`;
    case "linebreak":
      return "<br>";
    case "collapsible-container":
      return `<details class="collapsible">${kids()}</details>`;
    case "collapsible-title":
      return `<summary>${kids()}</summary>`;
    case "collapsible-content":
      return kids();
    case "text": {
      let text = escapeHtml(fixMojibake(node.text));
      if (node.format & 1) text = `<strong>${text}</strong>`;
      if (node.format & 2) text = `<em>${text}</em>`;
      if (node.style && node.style.includes("#ff0000")) text = `<span class="blood">${text}</span>`;
      return text;
    }
    case "embed": {
      const cls = EMBED_CLASS[node.embedType] || "bold";
      return `<span class="${cls}">${escapeHtml(fixMojibake(node.text))}</span>`;
    }
    default:
      return kids();
  }
}

function renderNotes(lexicalRoot) {
  if (!lexicalRoot || !lexicalRoot.root) return "";
  return renderLexical(lexicalRoot.root);
}

// A reward's `mod` id indexes gd.skills[power].mods, aligned by position with locale.skills[power].mods.
function resolveModName(power, modId) {
  const mods = gd.skills[power] && gd.skills[power].mods;
  if (!mods) return null;
  const idx = mods.findIndex((m) => m.id === modId);
  if (idx < 0) return null;
  const localeMods = locale.skills[power] && locale.skills[power].mods;
  return localeMods && localeMods[idx] && localeMods[idx].name;
}

function normalize(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Board layout constants, reverse-engineered from Maxroll's planner bundle (export-BEKM4hmq.js):
// boards are a plain 21-wide grid with 4-directional adjacency, and glyph radius grows from a
// base of 3 by +1 at level 25 and +1 at level 50 (this.glyphStartingSize=3, glyphSizeIncrements=[25,50]).
const GLYPH_STARTING_SIZE = 3;
const GLYPH_SIZE_INCREMENTS = [25, 50];

function glyphRadius(glyphCode, level) {
  const glyphDef = gd.paragonGlyphs[glyphCode] || {};
  const base = glyphDef.startingSize ?? GLYPH_STARTING_SIZE;
  const increments = glyphDef.sizeIncrements ?? GLYPH_SIZE_INCREMENTS;
  return base + increments.filter((threshold) => level >= threshold).length;
}

// Builds the occupied-cell layout for a board: row/col per index, plus start/socket lookups.
function buildBoardLayout(boardId) {
  const boardDef = gd.paragonBoards[boardId];
  if (!boardDef) return null;
  const width = boardDef.width;
  const cells = new Map();
  let startIdx = -1;
  let socketIdx = -1;
  boardDef.nodes.forEach((nodeKey, idx) => {
    if (!nodeKey) return;
    const nodeDef = gd.paragonNodes[nodeKey] || {};
    cells.set(idx, { idx, row: Math.floor(idx / width), col: idx % width, nodeKey, nodeDef });
    if (nodeDef.start) startIdx = idx;
    if (nodeDef.socket) socketIdx = idx;
  });
  return { width, cells, startIdx, socketIdx };
}

// Shortest-path distance (in points) from the board's entry node to every occupied node,
// following only 4-directional neighbors that are also occupied on the board.
function bfsDistances(layout) {
  const dist = new Map();
  if (layout.startIdx < 0) return dist;
  const { width, cells } = layout;
  dist.set(layout.startIdx, 0);
  const queue = [layout.startIdx];
  while (queue.length) {
    const cur = queue.shift();
    const row = Math.floor(cur / width);
    const col = cur - row * width;
    const neighbors = [];
    if (row > 0) neighbors.push(cur - width);
    if (row < width - 1) neighbors.push(cur + width);
    if (col > 0) neighbors.push(cur - 1);
    if (col < width - 1) neighbors.push(cur + 1);
    for (const n of neighbors) {
      if (cells.has(n) && !dist.has(n)) {
        dist.set(n, dist.get(cur) + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

// Manhattan-distance diamond of cells covered by the glyph, centered on the board's socket node.
function glyphRadiusCells(layout, radius) {
  const covered = new Set();
  if (layout.socketIdx < 0) return covered;
  const { width, cells } = layout;
  const centerRow = Math.floor(layout.socketIdx / width);
  const centerCol = layout.socketIdx % width;
  for (let row = Math.max(centerRow - radius, 0); row <= Math.min(centerRow + radius, width - 1); row++) {
    const spread = radius - Math.abs(row - centerRow);
    for (let col = Math.max(centerCol - spread, 0); col <= Math.min(centerCol + spread, width - 1); col++) {
      const idx = row * width + col;
      if (cells.has(idx)) covered.add(idx);
    }
  }
  return covered;
}

function nodeCategory(nodeDef) {
  if (nodeDef.start) return "start";
  if (nodeDef.gate) return "gate";
  if (nodeDef.socket) return "socket";
  if (nodeDef.rarity === 4) return "legendary";
  if (nodeDef.rarity === 3) return "rare";
  if (nodeDef.rarity === 2) return "magic";
  return "normal";
}

// Rotates a raw board-definition index into "world-facing" space for a board rotated 0/1/2/3
// quarter-turns (reverse-engineered from export-BEKM4hmq.js's paragonRotateIndex).
function rotateIndex(idx, rotation, width) {
  const r = ((rotation % 4) + 4) % 4;
  const row = Math.floor(idx / width);
  const col = idx % width;
  switch (r) {
    case 1:
      return col * width + (width - 1 - row);
    case 2:
      return width * width - 1 - idx;
    case 3:
      return (width - 1 - col) * width + row;
    default:
      return idx;
  }
}

// Given a board instance (with world position + rotation) and a raw gate-node index on it,
// finds the adjacent board's world position and which raw index on that board the gate meets
// (reverse-engineered from export-BEKM4hmq.js's paragonAdjacentPosition).
function adjacentBoardEdge(boardInstance, gateIdx, width) {
  const worldIdx = rotateIndex(gateIdx, boardInstance.rotation, width);
  const row = Math.floor(worldIdx / width);
  const col = worldIdx % width;
  const { x, y } = boardInstance.position;
  if (row === 0) return { x, y: y - 1, worldIndex: (width - 1) * width + col, direction: "North" };
  if (row === width - 1) return { x, y: y + 1, worldIndex: col, direction: "South" };
  if (col === 0) return { x: x - 1, y, worldIndex: row * width + (width - 1), direction: "West" };
  if (col === width - 1) return { x: x + 1, y, worldIndex: row * width, direction: "East" };
  return null;
}

// Maps each gate node on a board to the neighboring board it connects to (by matching world
// position among the boards actually placed in this paragon step).
function findGateConnections(boardInstance, layout, positionMap) {
  const connections = new Map();
  for (const cell of layout.cells.values()) {
    if (!cell.nodeDef.gate) continue;
    const edge = adjacentBoardEdge(boardInstance, cell.idx, layout.width);
    if (!edge) continue;
    const target = positionMap.get(`${edge.x},${edge.y}`);
    if (!target) continue;
    connections.set(cell.idx, { boardName: localeName("paragonBoards", target.instance.id), direction: edge.direction });
  }
  return connections;
}

// Renders a compact CSS-grid visualization of the board, cropped to its occupied bounding box.
// Cells are placed using their world-facing (rotated) position so the picture's North/South/East/West
// actually matches the "Connects to" directions, which are also computed in world-rotated space.
function renderBoardGrid(layout, investedIdx, radiusCells, gateConnections, rotation) {
  const width = layout.width;
  const placed = [...layout.cells.values()].map((c) => {
    const worldIdx = rotateIndex(c.idx, rotation, width);
    return { ...c, worldRow: Math.floor(worldIdx / width), worldCol: worldIdx % width };
  });
  const rows = placed.map((c) => c.worldRow);
  const cols = placed.map((c) => c.worldCol);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const gridCols = maxCol - minCol + 1;
  const cellsHtml = placed
    .map((c) => {
      const classes = ["board-cell", nodeCategory(c.nodeDef)];
      if (investedIdx.has(c.idx)) classes.push("invested");
      if (radiusCells.has(c.idx)) classes.push("in-glyph");
      const gridRow = c.worldRow - minRow + 1;
      const gridCol = c.worldCol - minCol + 1;
      const connection = gateConnections.get(c.idx);
      const title = connection
        ? `Gate -> ${connection.boardName} (${connection.direction})`
        : escapeHtml(localeName("paragonNodes", c.nodeKey) || c.nodeKey);
      return `<div class="${classes.join(" ")}" style="grid-row:${gridRow};grid-column:${gridCol};" title="${title}"></div>`;
    })
    .join("");
  return `<div class="board-grid" style="grid-template-columns: repeat(${gridCols}, 14px); grid-auto-rows: 14px;">${cellsHtml}</div>`;
}

// The `position` field on skillTree/paragon isn't reliable for picking the step that
// matches a given profile variant (e.g. Starter/Midgame/Endgame/Push) - it can point at
// whatever step was last open in the editor. Prefer matching by name, then by the
// profile's own index (steps are typically defined in the same order as the profiles).
function pickStep(steps, profileName, profileIndex, fallbackPosition) {
  const target = normalize(profileName);
  const byName = steps.find((s) => {
    const n = normalize(s.name);
    return n.includes(target) || target.includes(n);
  });
  if (byName) return byName;
  if (steps[profileIndex]) return steps[profileIndex];
  return steps[fallbackPosition] ?? steps[steps.length - 1];
}

// Shared by class skill trees and mercenary skill trees - both use the same
// {id, rewardId} node schema and gd.skillTreeRewards lookup table.
function resolveSkillPoints(treeName, pointsData) {
  const tree = gd.skillTrees[treeName];
  if (!tree) return [];
  const nodesById = new Map(tree.nodes.map((n) => [n.id, n]));
  const skillsByCode = new Map();
  const pendingMods = [];
  for (const [idStr, value] of Object.entries(pointsData)) {
    if (!value) continue; // skip unallocated
    const id = Number(idStr);
    const node = nodesById.get(id);
    const reward = node && node.rewardId && gd.skillTreeRewards[node.rewardId];
    if (!reward) continue;
    const skillName = localeName("skills", reward.power);
    if (reward.type === 0) {
      skillsByCode.set(reward.power, { name: skillName, value, maxRanks: reward.ranks, mods: [] });
    } else {
      const modName = resolveModName(reward.power, reward.mod);
      pendingMods.push({ power: reward.power, name: modName || `${skillName} (mod)` });
    }
  }
  for (const { power, name } of pendingMods) {
    const skill = skillsByCode.get(power);
    if (skill) skill.mods.push(name);
    else skillsByCode.set(power, { name: localeName("skills", power), value: 0, maxRanks: null, mods: [name] });
  }
  return [...skillsByCode.values()].sort((a, b) => (b.maxRanks || 0) - (a.maxRanks || 0) || b.value - a.value);
}

function resolveSkillTree(skillTree, className, profileName, profileIndex) {
  const step = pickStep(skillTree.steps, profileName, profileIndex, skillTree.position);
  return resolveSkillPoints(className, step.data);
}

function resolveMercenarySkills(mercenary) {
  if (!mercenary || !mercenary.tree) return [];
  const mercDef = gd.mercenaries[mercenary.id];
  if (!mercDef || !mercDef.tree) return [];
  return resolveSkillPoints(mercDef.tree, mercenary.tree);
}

// Readable stat labels: the affix's own attribute id (gd.attributes[id].name) is a much more
// reliable source than the affix code or locale prefix/suffix (which is just item-naming flavor
// text like "Vigorous"/"of Vigor" and NOT the actual stat granted). Curated for common patterns
// seen on gear; falls back to a generic humanization of the attribute's internal name.
const STAT_NAME_PATTERNS = [
  [/Hitpoints_Max/i, "Maximum Life"],
  [/^Armor/i, "Armor"],
  [/Resistance_All/i, "Resistance (All Elements)"],
  [/^(Intelligence|Strength|Willpower|Dexterity)$/i, (m) => m],
  [/Resource_Regen_Per_Second/i, "Resource Generation"],
  [/Resource_Cost_Reduction/i, "Resource Cost Reduction"],
  [/Movement.*Speed/i, "Movement Speed"],
  [/Crit_Percent_Bonus|Critical_Strike_Chance/i, "Critical Strike Chance"],
  [/Crit.*Damage/i, "Critical Strike Damage"],
  [/Attack_Speed/i, "Attack Speed"],
  [/Weapon_Damage/i, "Weapon Damage"],
  [/Cooldown_Reduction/i, "Cooldown Reduction"],
  [/Proc_Resource_On_Hit|Proc.*Resource|LuckyHit.*Resource/i, "Lucky Hit: Chance to Restore Resource"],
  [/Lucky_Hit/i, "Lucky Hit Chance"],
  [/Damage_Reduction/i, "Damage Reduction"],
  [/Overpower.*Per_Stack|Overpower_Damage_Bonus_Per_Stack/i, "Damage per Overpower Stack"],
  [/Overpower/i, "Overpower Damage"],
  [/Vulnerable/i, "Vulnerable Damage"],
  [/Block_Chance/i, "Block Chance"],
  [/Thorns/i, "Thorns"],
  [/Life_On_Kill|LifeOnKill/i, "Life on Kill"],
];

function humanizeAttributeName(attrName) {
  for (const [pattern, replacement] of STAT_NAME_PATTERNS) {
    const m = attrName.match(pattern);
    if (m) return typeof replacement === "function" ? replacement(m[0]) : replacement;
  }
  return attrName
    .replace(/^Flat_/, "")
    .replace(/_Bonus(_Unscaled_By_Player_Health)?$/i, "")
    .replace(/^Bucketed_Multiplicative_/, "")
    .replace(/_/g, " ")
    .trim();
}

// Extracts the "hint" a template's {valueN} token stands for (a damage type, resource type, or
// skill category) - the game's own tooltip text uses this same token for these, but the actual
// element/resource/category name is only encoded in the affix's own string code, not the template.
function codeHint(code) {
  const damageType = code.match(/(NonPhysical|Poison|Cold|Fire|Lightning|Shadow|Physical)/i);
  if (damageType) return damageType[1].replace(/^Non/i, "Non-");
  const resource = code.match(/_(Essence|Fury|Mana|Wrath|Spirit)\b/i);
  if (resource) return resource[1];
  const category = code.match(/_Category_(\w+)/i);
  if (category) return category[1];
  return "";
}

// Parses a locale description template (affix-level `desc` or attribute-level attributeDescriptions
// entry) into a clean stat label: strips numeric value brackets (e.g. "+[{value}*100|%|]") and
// color/markup tags (e.g. "{c_important}...{/c}"), keeps the surrounding plain-language text intact,
// and fills in "{valueN}" name placeholders using codeHint(). Also drops a leading "Set Name:" line
// some set-bonus descriptions have, keeping only the actual effect text.
function parseDescriptionTemplate(template, code) {
  if (!template) return null;
  const segments = template.split(/\r?\n/).filter(Boolean);
  let text = segments[segments.length - 1];
  const colonIdx = text.lastIndexOf(":");
  if (colonIdx >= 0 && colonIdx < text.length - 1) text = text.slice(colonIdx + 1);
  // strip markup tags first, so a bracket expression hidden behind a leading tag (e.g.
  // "+{c_number}[...]{/c}") is fully removed by the bracket-stripping pass below.
  text = text.replace(/\{\/?c[^}]*\}/g, "");
  text = text.replace(/[+x]?\[[^\]]*\]/gi, "");
  if (/\{value\d*\}/.test(text)) text = text.replace(/\{value\d*\}/g, codeHint(code));
  text = text.replace(/^[+x]\s*/i, "");
  text = text.replace(/\s+/g, " ").trim();
  // "+3 to Blood Skills" reads fine with the number; without it "to Blood Skills" needs the
  // implied word restored for clarity.
  if (/^to \w+ Skills$/i.test(text)) text = `Ranks ${text}`;
  return text || null;
}

function affixDisplayLabel(code) {
  if (AFFIX_CODE_OVERRIDES[code]) return AFFIX_CODE_OVERRIDES[code];

  const def = gd.affixes[code];
  const attr = def && (def.attributes || [])[0];
  const attrName = attr && attr.id != null && gd.attributes[attr.id] && gd.attributes[attr.id].name;

  // Prefer the game's own tooltip text: check the affix's own desc first (covers one-off effects
  // like set bonuses), then the generic per-attribute template, before falling back to guessing
  // a name from the internal attribute/code strings.
  const fromAffixDesc = parseDescriptionTemplate(locale.affixes[code] && locale.affixes[code].desc, code);
  if (fromAffixDesc) return fromAffixDesc;
  const fromAttrTemplate = attrName && parseDescriptionTemplate(locale.attributeDescriptions[attrName], code);
  if (fromAttrTemplate) return fromAttrTemplate;

  let base = attrName ? humanizeAttributeName(attrName) : humanizeAffixCode(code);
  const element = code.match(/(Poison|Cold|Fire|Lightning|Shadow|Physical)/i);
  if (element && /^Resistance/i.test(base)) base = `${element[1]} Resistance`;
  const category = code.match(/_Category_(\w+)/i);
  if (category && /Skill Rank/i.test(base)) base = `Ranks to ${category[1]} Skills`;
  const resourceType = code.match(/_(Essence|Fury|Mana|Wrath|Spirit)\b/i);
  if (resourceType && /^Resource (Generation|Cost Reduction)$/i.test(base)) {
    base = `${resourceType[1]} ${base.replace(/^Resource /i, "")}`;
  }

  return base;
}

// Charm/Seal affix codes with no locale desc/template at all - list known ones directly.
const AFFIX_CODE_OVERRIDES = {
  Talisman_SealAffix_AdditionalCharmSlot: "+1 Charm Slot",
  Talisman_Charm_CoreStats_All: "All Core Stats",
  Talisman_SealAffix_Normal_Damage_All: "Damage",
};

function humanizeAffixCode(code) {
  return code
    .replace(/^S\d+_/, "")
    .replace(/^X\d+_/, "")
    .replace(/^Tempered_/, "")
    .replace(/_Generic\b/gi, "")
    .replace(/_Tier\d+$/i, "")
    .replace(/_(AllClasses|Lesser|Greater)$/gi, "")
    .replace(/CoreStat_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A per-stat `upgrade` value > 0 marks the ONE affix/temper that received Masterworking's
// +50% critical bonus rank (distinct from the item's own overall `upgrade` = masterwork rank).
function resolveStatLine(entry, itemId) {
  const code = affixIdToCode.get(entry.nid);
  // A unique/mythic item's own fixed power is sometimes stored as an "affix" whose code overlaps
  // with the item's own id (not a real stat) - label it distinctly rather than showing raw text.
  const isUniquePower = code && (itemId.includes(code) || code.includes(itemId));
  const label = !code ? `#${entry.nid}` : isUniquePower ? "Unique Power" : affixDisplayLabel(code);
  const tags = [];
  if (entry.greater) tags.push("GA");
  if (entry.upgrade > 0) tags.push("MW");
  return `${label}${tags.length ? ` (${tags.join(", ")})` : ""}`;
}

function resolveEquipment(profile) {
  const slots = [];
  for (const [slotKeyStr, itemPoolIdx] of Object.entries(profile.items || {})) {
    const item = data.items[itemPoolIdx];
    if (!item) continue;
    const itemDef = gd.items[item.id];
    const slotType = (itemDef && itemDef.type) || "Item";
    const aspect = (item.aspects || [])[0];
    const aspectCode = aspect && affixIdToCode.get(aspect.nid);
    const aspectDef = aspectCode && locale.affixes[aspectCode];
    // Maxroll's own convention: generic legendary items are identified by their imprinted
    // aspect (e.g. "Juggernaut's", "Coalesced Blood"), not the random flavor name the item
    // rolled with - item.name/localeName("items", ...) is only meaningful for true uniques/mythics.
    const aspectName = aspectDef && (aspectDef.prefix || (aspectDef.suffix || "").replace(/^of\s+/i, ""));
    const name = aspectName || localeName("items", item.id) || fixMojibake(item.name) || item.id;
    // The item instance itself carries `mythic: true` once upgraded from Unique to Mythic Unique
    // (the item id/definition stays the same across Starter->Push, only this flag changes).
    const rarityLabel = item.mythic ? "Mythic Unique" : /_Unique_/i.test(item.id) ? "Unique" : null;
    slots.push({
      slotKey: Number(slotKeyStr),
      slot: slotType,
      name,
      rarityLabel,
      power: item.power,
      aspect: aspectName ? `Aspect ${aspectName}` : null,
      // Matches Maxroll's own "Stat Priority" ordering (explicits in their rolled order),
      // tempers kept separate so they can be styled distinctly.
      statPriority: (item.explicits || []).map((e) => resolveStatLine(e, item.id)),
      tempers: (item.tempered || []).map((e) => resolveStatLine(e, item.id)),
      sockets: (item.sockets || []).map((s) => localeName("items", s)),
    });
  }
  // Canonical equipment paperdoll order (Helm/Chest/Gloves/Pants/Boots/Amulet/Ring/Ring/Weapon/Offhand),
  // driven by the real body-slot ids from gd.itemTypes[...].bodySlots rather than a hardcoded name list.
  const slotOrder = [4, 5, 13, 14, 15, 18, 17, 16, 7, 6];
  slots.sort((a, b) => {
    const ai = slotOrder.indexOf(a.slotKey);
    const bi = slotOrder.indexOf(b.slotKey);
    if (ai === -1 && bi === -1) return a.slotKey - b.slotKey;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return slots;
}

function resolveParagon(paragon, profileName, profileIndex) {
  const step = pickStep(paragon.steps, profileName, profileIndex, paragon.position);
  const positionMap = new Map(step.data.map((b) => [`${b.position.x},${b.position.y}`, { instance: b }]));

  return step.data.map((board) => {
    const boardDef = gd.paragonBoards[board.id];
    const layout = buildBoardLayout(board.id);
    const investedIdx = new Set(Object.entries(board.nodes).filter(([, v]) => v).map(([k]) => Number(k)));
    const distances = layout ? bfsDistances(layout) : new Map();
    const radius = board.glyph ? glyphRadius(board.glyph, board.glyphLevel || 1) : 0;
    const radiusCells = layout && board.glyph ? glyphRadiusCells(layout, radius) : new Set();
    const gateConnections = layout ? findGateConnections(board, layout, positionMap) : new Map();

    const notable = [];
    for (const [posStr, value] of Object.entries(board.nodes)) {
      if (!value) continue;
      const pos = Number(posStr);
      const nodeKey = boardDef ? boardDef.nodes[pos] : null;
      if (!nodeKey || /^Generic_(Normal|Magic|Gate|Socket)/.test(nodeKey)) continue; // skip generic filler
      notable.push({ name: localeName("paragonNodes", nodeKey), dist: distances.has(pos) ? distances.get(pos) : Infinity });
    }
    notable.sort((a, b) => a.dist - b.dist);

    return {
      boardName: localeName("paragonBoards", board.id),
      glyph: board.glyph ? localeName("paragonGlyphs", board.glyph) : null,
      glyphLevel: board.glyphLevel,
      glyphRadius: radius,
      notable: notable.map((n) => n.name),
      connections: [...gateConnections.values()],
      gridHtml: layout ? renderBoardGrid(layout, investedIdx, radiusCells, gateConnections, board.rotation) : "",
    };
  });
}

function buildProfileView(profile, className, profileIndex) {
  const skillBar = (profile.skillBar || []).map((code) => localeName("skills", code));
  const skillRows = resolveSkillTree(profile.skillTree, className, profile.name, profileIndex);
  const paragonBoards = resolveParagon(profile.paragon, profile.name, profileIndex);
  const equipment = resolveEquipment(profile);
  const mercenarySkillRows = resolveMercenarySkills(profile.mercenary);
  const mercenary = profile.mercenary
    ? {
        hired: localeName("mercenaries", profile.mercenary.id),
        support: profile.mercenary.support ? localeName("mercenaries", profile.mercenary.support) : null,
        // supportSkills is [reinforcementSkill, triggerSkill] - the reinforcement's own ability,
        // and the player skill that triggers it to be cast.
        supportSkill: profile.mercenary.supportSkills && profile.mercenary.supportSkills[0]
          ? localeName("skills", profile.mercenary.supportSkills[0])
          : null,
        supportTrigger: profile.mercenary.supportSkills && profile.mercenary.supportSkills[1]
          ? localeName("skills", profile.mercenary.supportSkills[1])
          : null,
      }
    : null;

  const skillNotesHtml = renderNotes(profile.widgetNotes && profile.widgetNotes.skills);
  const paragonNotesHtml = renderNotes(profile.widgetNotes && profile.widgetNotes.paragon);
  const equipmentNotesHtml = renderNotes(profile.widgetNotes && profile.widgetNotes.equipment);
  const mercenaryNotesHtml = renderNotes(profile.widgetNotes && profile.widgetNotes.mercenary);

  const skillTableHtml = skillRows.length
    ? `<div class="equipment-grid">${skillRows
        .map(
          (r) => `
            <div class="equip-card">
                <div class="item-name">${escapeHtml(r.name)}</div>
                ${r.maxRanks ? `<div class="slot">${r.value} / ${r.maxRanks}</div>` : ""}
                ${r.mods.length ? `<ul>${r.mods.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>` : ""}
            </div>`
        )
        .join("")}</div>`
    : "";

  const paragonTableHtml = paragonBoards.length
    ? `<div class="board-list">${paragonBoards
        .map(
          (b, i) => `
            <div class="equip-card board-card">
                <div class="item-name">${i + 1}. ${escapeHtml(b.boardName)}</div>
                ${b.glyph ? `<div class="slot">Glyph: ${escapeHtml(b.glyph)}${b.glyphLevel ? " (Lv. " + b.glyphLevel + ", Radius " + b.glyphRadius + ")" : ""}</div>` : ""}
                ${b.gridHtml}
                <div class="legend"><span class="legend-swatch legend-glyph"></span>Glyph radius &middot; Nodes ordered by pathing distance from board entry below</div>
                ${
                  b.connections.length
                    ? `<div class="slot">Connects to: ${b.connections.map((c) => `${escapeHtml(c.boardName)} (${c.direction})`).join(", ")}</div>`
                    : ""
                }
                ${
                  b.notable.length
                    ? `<ol>${b.notable.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ol>`
                    : ""
                }
            </div>`
        )
        .join("")}</div>`
    : "";

  const skillBarHtml = skillBar.length
    ? `<div class="req-box"><ul style="list-style:none; padding-left:0;">${skillBar
        .map((s) => `<li><span class="blood bold">${escapeHtml(s)}</span></li>`)
        .join("")}</ul></div>`
    : "";

  const mercenarySkillTableHtml = mercenarySkillRows.length
    ? `<div class="equipment-grid">${mercenarySkillRows
        .map(
          (r) => `
            <div class="equip-card">
                <div class="item-name">${escapeHtml(r.name)}</div>
                ${r.maxRanks ? `<div class="slot">${r.value} / ${r.maxRanks}</div>` : ""}
            </div>`
        )
        .join("")}</div>`
    : "";

  const mercenaryHtml = mercenary
    ? `<p><strong>Hired:</strong> ${escapeHtml(mercenary.hired)}</p>${mercenarySkillTableHtml}${
        mercenary.support
          ? `<p><strong>Reinforcement:</strong> ${escapeHtml(mercenary.support)}${
              mercenary.supportSkill ? ` (${escapeHtml(mercenary.supportSkill)})` : ""
            }${
              mercenary.supportTrigger
                ? ` <span class="slot">- triggered by casting ${escapeHtml(mercenary.supportTrigger)}</span>`
                : ""
            }</p>`
          : ""
      }`
    : "";

  const equipmentTableHtml = equipment.length
    ? `<div class="gear-grid">${equipment
        .map(
          (e) => `
            <div class="gear-card">
                <div class="row-slot">${escapeHtml(e.slot)}${e.rarityLabel ? ` &middot; ${escapeHtml(e.rarityLabel)}` : ""}</div>
                <div class="row-name item-name">${escapeHtml(e.name)}${e.power ? ` (${e.power})` : ""}</div>
                <div class="row-stats">${
                  e.statPriority.length
                    ? `<ol>${e.statPriority.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
                    : ""
                }</div>
                <div class="row-tempers">${
                  e.tempers.length
                    ? `<div class="temper-box"><div class="temper-label">Temper</div><ul>${e.tempers
                        .map((s) => `<li>${escapeHtml(s)}</li>`)
                        .join("")}</ul></div>`
                    : ""
                }</div>
                <div class="row-sockets slot">${e.sockets.length ? `Socketed: ${e.sockets.map(escapeHtml).join(", ")}` : ""}</div>
            </div>`
        )
        .join("")}</div>`
    : "";

  return `
    ${section("Equipment", equipmentTableHtml, profileIndex)}
    ${section("Equipment Notes", equipmentNotesHtml, profileIndex)}
    ${section("Skill Tree", skillTableHtml, profileIndex)}
    ${section("Skill Bar", skillBarHtml, profileIndex)}
    ${section("Skill Rotation", skillNotesHtml, profileIndex)}
    ${section("Paragon Boards", paragonTableHtml, profileIndex)}
    ${section("Glyph Level Order", paragonNotesHtml, profileIndex)}
    ${section("Mercenary", mercenaryHtml + (mercenaryNotesHtml || ""), profileIndex)}`;
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function section(title, innerHtml, idSuffix) {
  if (!innerHtml || !innerHtml.trim()) return "";
  const id = `section-${slugify(title)}${idSuffix != null ? "-" + idSuffix : ""}`;
  return `
    <details class="section" id="${id}" open>
        <summary>${escapeHtml(title)}</summary>
        <div class="section-body">${innerHtml}</div>
    </details>`;
}

const className = (gd.classes[data.profiles[0].class] && gd.classes[data.profiles[0].class].name) || data.profiles[0].class;

const faqsHtml = renderNotes(data.globalNotes.faqs);

const tabButtonsHtml = data.profiles
  .map((p, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" data-tab="tab-${i}">${escapeHtml(p.name)}</button>`)
  .join("");

const tabPanelsHtml = data.profiles
  .map((p, i) => `<div class="tab-panel${i === 0 ? " active" : ""}" id="tab-${i}">${buildProfileView(p, className, i)}</div>`)
  .join("");

const title = titleOverride || `${rawBuild.name || "Diablo 4 Build"}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            --bg-color: #0c0d10;
            --card-bg: #14161d;
            --card-border: #232733;
            --text-main: #e1e3e8;
            --text-muted: #94a3b8;
            --accent-blood: #ef4444;
            --accent-orange: #f97316;
            --accent-blue: #38bdf8;
            --accent-purple: #a855f7;
            --accent-green: #22c55e;
            --accent-gold: #eab308;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
            padding: 16px;
        }
        .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        h1 { color: var(--accent-blood); font-size: 1.8rem; text-align: center; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .subtitle { text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px; }
        h2 { font-size: 1.3rem; color: var(--accent-blood); border-bottom: 1px solid var(--card-border); padding-bottom: 6px; margin-bottom: 12px; }
        h3, h4 { font-size: 1.05rem; color: var(--accent-orange); margin: 10px 0 6px; }
        .section { background-color: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px; }
        .section > summary {
            font-size: 1.3rem;
            color: var(--accent-blood);
            cursor: pointer;
            list-style: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .section > summary::-webkit-details-marker { display: none; }
        .section > summary::after { content: "\u25BE"; font-size: 1rem; color: var(--text-muted); transition: transform 0.2s ease; }
        .section:not([open]) > summary::after { transform: rotate(-90deg); }
        .section:not([open]) > summary { padding-bottom: 0; }
        .section[open] > summary { border-bottom: 1px solid var(--card-border); padding-bottom: 6px; margin-bottom: 12px; }
        .section-body > *:last-child { margin-bottom: 0; }
        .blood { color: var(--accent-blood); font-weight: 600; }
        .orange { color: var(--accent-orange); font-weight: 600; }
        .blue { color: var(--accent-blue); font-weight: 600; }
        .purple { color: var(--accent-purple); font-weight: 600; }
        .green { color: var(--accent-green); font-weight: 600; }
        .gold { color: var(--accent-gold); font-weight: 600; }
        .bold { font-weight: 600; }
        p { margin-bottom: 10px; }
        ul, ol { padding-left: 20px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .req-box { background-color: #101216; border-left: 4px solid var(--accent-blood); padding: 12px 16px; border-radius: 0 6px 6px 0; }
        .equipment-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .equip-card { background: #181b24; border: 1px solid var(--card-border); border-radius: 6px; padding: 12px; }
        .equip-card .item-name { font-size: 1rem; color: var(--accent-orange); font-weight: bold; margin-bottom: 4px; }
        .equip-card .slot { font-size: 0.85rem; color: var(--text-muted); }
        .equip-card ol { font-size: 0.85rem; margin-top: 6px; margin-bottom: 0; }
        .gear-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            align-items: start;
        }
        .gear-card {
            display: grid;
            grid-template-rows: subgrid;
            grid-row: span 5;
            row-gap: 6px;
            background: #181b24;
            border: 1px solid var(--card-border);
            border-radius: 6px;
            padding: 12px;
        }
        .gear-card .row-name { font-size: 1rem; color: var(--accent-orange); font-weight: bold; }
        .gear-card .row-slot,
        .gear-card .row-sockets { font-size: 0.85rem; color: var(--text-muted); }
        .gear-card .row-stats ol { font-size: 0.85rem; margin: 0; }
        .temper-box { border-left: 3px solid var(--accent-purple); background: #14161d; padding: 6px 10px; border-radius: 0 4px 4px 0; }
        .temper-box .temper-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-purple); font-weight: 600; margin-bottom: 4px; }
        .temper-box ul { font-size: 0.85rem; margin: 0; }
        @supports not (grid-template-rows: subgrid) {
            .gear-card { grid-template-rows: auto; grid-row: auto; }
        }
        .board-list { display: flex; flex-direction: column; gap: 16px; }
        .board-card { display: flex; flex-direction: column; gap: 8px; }
        .board-grid {
            display: grid;
            gap: 2px;
            margin: 4px 0;
            max-width: 100%;
            overflow-x: auto;
        }
        .board-cell { border-radius: 2px; background: #23262f; opacity: 0.35; }
        .board-cell.invested { opacity: 1; }
        .board-cell.normal { background: #4b5563; }
        .board-cell.magic { background: var(--accent-blue); }
        .board-cell.rare { background: var(--accent-gold); }
        .board-cell.legendary { background: var(--accent-orange); }
        .board-cell.start { background: var(--accent-green); }
        .board-cell.gate { background: #6b7280; }
        .board-cell.socket { background: var(--accent-purple); }
        .board-cell.in-glyph { box-shadow: 0 0 0 1px var(--accent-purple) inset; }
        .legend { font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
        .legend-glyph { box-shadow: 0 0 0 1px var(--accent-purple) inset; background: #23262f; }
        details.collapsible { background: #181b24; border: 1px solid var(--card-border); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; }
        details.collapsible summary { cursor: pointer; color: var(--accent-orange); font-weight: 600; }
        .toolbar { display: flex; gap: 8px; justify-content: center; }
        .toolbar-btn {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            color: var(--text-muted);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
        }
        .toolbar-btn:hover { color: #fff; border-color: var(--accent-blood); }
        .sticky-header {
            position: sticky;
            top: 0;
            z-index: 10;
            background: var(--bg-color);
            padding: 10px 0;
            margin: -10px 0 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
        .section-jump {
            width: 100%;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            color: var(--text-main);
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 0.9rem;
        }
        .tab-btn {
            flex: 1 1 auto;
            min-width: 80px;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            color: var(--text-muted);
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
        }
        .tab-btn.active { color: #fff; background: var(--accent-blood); border-color: var(--accent-blood); }
        .tab-panel { display: none; flex-direction: column; gap: 20px; }
        .tab-panel.active { display: flex; }
        @media (max-width: 480px) {
            body { padding: 10px; }
            h1 { font-size: 1.4rem; }
            h2 { font-size: 1.1rem; }
        }
    </style>
</head>
<body>
<div class="container">
    <h1>${escapeHtml(title)}</h1>

    <div class="sticky-header">
        <div class="toolbar">
            <button id="expand-all-btn" class="toolbar-btn">Expand All</button>
            <button id="collapse-all-btn" class="toolbar-btn">Collapse All</button>
        </div>
        <div class="tabs">${tabButtonsHtml}</div>
        <select id="section-jump" class="section-jump">
            <option value="">Jump to section...</option>
        </select>
    </div>
    ${tabPanelsHtml}

    ${section("FAQ & Mechanics", faqsHtml)}
</div>
<script>
function populateSectionJump() {
  const select = document.getElementById('section-jump');
  select.innerHTML = '<option value="">Jump to section...</option>';
  const active = document.querySelector('.tab-panel.active');
  const sections = active ? active.querySelectorAll('details.section[id]') : [];
  sections.forEach((d) => {
    const label = d.querySelector('summary').textContent;
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = label;
    select.appendChild(opt);
  });
  const faq = document.getElementById('section-faq-mechanics');
  if (faq) {
    const opt = document.createElement('option');
    opt.value = faq.id;
    opt.textContent = faq.querySelector('summary').textContent;
    select.appendChild(opt);
  }
}
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    populateSectionJump();
  });
});
document.getElementById('section-jump').addEventListener('change', (e) => {
  const id = e.target.value;
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  e.target.value = '';
});
populateSectionJump();
document.getElementById('expand-all-btn').addEventListener('click', () => {
  document.querySelectorAll('details.section').forEach((d) => (d.open = true));
});
document.getElementById('collapse-all-btn').addEventListener('click', () => {
  document.querySelectorAll('details.section').forEach((d) => (d.open = false));
});
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath}`);
