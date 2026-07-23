#!/usr/bin/env node
/**
 * Parse PLAN.md / PLAN.json → structured plan object.
 * Requires: besoin, research subjects, features, user tests (or exercices),
 * quality goals, complete goal.
 * Exit 0 with JSON on stdout. Exit 2 if plan incomplete.
 */
import fs from "node:fs";
import {
    bulletsFrom,
    extractField,
    extractSection,
    paths,
    readJson,
} from "./paths.mjs";

const planJson = readJson(paths.planJson, null);
let plan;

if (planJson && Array.isArray(planJson.features) && Array.isArray(planJson.userTests)) {
  plan = normalizeJsonPlan(planJson);
} else if (fs.existsSync(paths.planMd)) {
  plan = parsePlanMd(fs.readFileSync(paths.planMd, "utf8"));
} else {
  console.error(
    JSON.stringify({
      ok: false,
      needPlan: true,
      error: "Missing PLAN.md / PLAN.json",
      expected: [paths.planMd, paths.planJson],
    })
  );
  process.exit(2);
}

const errors = [];
if (!plan.besoin) errors.push("besoin");
if (!plan.researchSubjects?.length) errors.push("researchSubjects");
if (!plan.features?.length) errors.push("features");
if (!plan.userTests?.length) errors.push("userTests|exercices");
if (!plan.qualityGoals?.length) errors.push("qualityGoals");
if (!plan.completeGoal) errors.push("completeGoal");

if (errors.length) {
  console.error(
    JSON.stringify({
      ok: false,
      needPlan: true,
      error: "Incomplete plan",
      missing: errors,
      hint: "PLAN must include Recherche (sujets), Plan (Doc/Faire), Validation avant livraison (exercices), Fonctionnalites, Quality, But complet",
      plan,
    })
  );
  process.exit(2);
}

console.log(JSON.stringify({ ok: true, plan }));

function parsePlanMd(md) {
  const besoin =
    extractSection(md, ["Besoin", "Need", "Demande"]) ||
    extractSection(md, ["Comprehension", "Compréhension"]) ||
    "";
  const comprehension = extractSection(md, [
    "Comprehension",
    "Compréhension",
    "Understanding",
  ]);
  const researchSubjects = extractResearchSubjects(md);
  const planSteps = extractPlanSteps(md);
  const features = bulletsFrom(
    extractSection(md, [
      "Fonctionnalites",
      "Fonctionnalités",
      "Features",
      "Fonctionnalites a livrer",
    ])
  );
  let userTests = bulletsFrom(
    extractSection(md, [
      "Tests utilisateur",
      "User tests",
      "Liste test",
      "Tests",
    ])
  );
  const exercices = bulletsFrom(
    extractSection(md, [
      "Validation avant livraison",
      "Exercices",
      "Exercices avant livraison",
      "Validation livraison",
    ])
  );
  if (!userTests.length && exercices.length) userTests = exercices;
  else if (exercices.length) {
    for (const e of exercices) {
      if (!userTests.includes(e)) userTests.push(e);
    }
  }
  const qualityGoals = bulletsFrom(
    extractSection(md, [
      "Quality goals",
      "QualityGoals",
      "Objectifs qualite",
      "Objectifs qualité",
      "Qualite",
      "Qualité",
    ])
  );
  const completeGoal =
    extractSection(md, [
      "But complet",
      "Complete goal",
      "Goal",
      "But",
    ]) || extractField(md, ["But complet", "CompleteGoal", "GOAL"]);

  return {
    besoin: besoin.replace(/\r/g, "").trim(),
    comprehension: (comprehension || "").replace(/\r/g, "").trim(),
    researchSubjects,
    planSteps,
    features,
    userTests,
    qualityGoals,
    completeGoal: String(completeGoal || "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)[0] || String(completeGoal || "").trim(),
  };
}

function extractResearchSubjects(md) {
  const section = extractSection(md, [
    "Recherche / comprehension a faire",
    "Recherche / compréhension a faire",
    "Recherche / comprehension à faire",
    "Recherche / compréhension à faire",
    "Recherche",
    "Research",
    "Comprehension a faire",
  ]);
  if (!section) return [];
  const subjects = [];
  const re = /^###\s*(Sujet\s*\d+\s*:?\s*.+)$/gim;
  let m;
  const titles = [];
  while ((m = re.exec(section))) {
    titles.push(m[1].trim());
  }
  if (titles.length) {
    return titles.map((t, i) => ({
      id: `R${i + 1}`,
      title: t.replace(/^Sujet\s*\d+\s*:?\s*/i, "").trim() || t,
    }));
  }
  // fallback bullets
  return bulletsFrom(section).map((t, i) => ({
    id: `R${i + 1}`,
    title: t,
  }));
}

function extractPlanSteps(md) {
  const section = extractSection(md, ["Plan", "Etapes", "Étapes", "Steps"]);
  if (!section) return [];
  const steps = [];
  const parts = section.split(/^###\s+/m).filter(Boolean);
  if (parts.length > 1 || /^###\s+/m.test(section)) {
    for (const part of parts) {
      const lines = part.split(/\r?\n/);
      const title = lines[0]?.trim();
      if (!title || /^(Fonctionnalites|Tests|Quality|But|Validation)/i.test(title))
        continue;
      const body = lines.slice(1).join("\n");
      const doc =
        extractField(body, ["Doc", "URL", "Documentation"]) ||
        (body.match(/https?:\/\/\S+/i) || [])[0] ||
        "";
      const faire = extractField(body, ["Faire", "Do", "Action"]) || "";
      const validePar =
        extractField(body, ["Validé par", "Valide par", "Validated by", "Agent"]) ||
        "";
      steps.push({
        title: title.replace(/^Etape\s*\d+\s*:?\s*/i, "").trim() || title,
        doc,
        faire,
        validePar,
        text: part.trim(),
      });
    }
  }
  if (!steps.length) {
    return bulletsFrom(section).map((t) => ({
      title: t,
      doc: "",
      faire: t,
      validePar: "",
      text: t,
    }));
  }
  return steps;
}

function normalizeJsonPlan(j) {
  const researchSubjects = (j.researchSubjects || j.research || []).map(
    (s, i) =>
      typeof s === "string"
        ? { id: `R${i + 1}`, title: s }
        : { id: s.id || `R${i + 1}`, title: s.title || String(s) }
  );
  return {
    besoin: String(j.besoin || j.need || "").trim(),
    comprehension: String(j.comprehension || "").trim(),
    researchSubjects,
    planSteps: (j.planSteps || j.plan || []).map((s) =>
      typeof s === "string"
        ? { title: s, doc: "", faire: s, validePar: "", text: s }
        : s
    ),
    features: (j.features || []).map(String),
    userTests: (j.userTests || j.tests || j.exercices || []).map(String),
    qualityGoals: (j.qualityGoals || j.quality || []).map(String),
    completeGoal: String(j.completeGoal || j.goal || "").trim(),
  };
}
