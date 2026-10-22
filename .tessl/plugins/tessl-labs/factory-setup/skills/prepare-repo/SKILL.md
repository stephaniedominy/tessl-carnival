---
name: prepare-repo
description: >-
  Prepare an existing repository so Tessl agents and Tessl Code Review work
  well in it: better agent context, verifiers, Code Review lenses, and lint
  rules drawn from how the team already works. Use when someone wants agents
  to make fewer mistakes in their repo, wants to prepare or improve their repo
  for agents, or wants to turn recurring review feedback into checks.
---

# Prepare a repository

This skill looks at how a repository is built, reviewed, and fixed, and
proposes changes that help agents get work right the first time. Each
proposal is a rule the team already follows, placed where it is enforced
best: a lint rule or test, a verifier, a Code Review lens, or agent context.

It works on its own, or as a next step after `factory-setup` once the first
automation is live.

Rules for the whole session:

- Message the user only at the [decision points](#decision-points), and
  wait for a reply to each message. A preflight check that stops the run is
  the only other time you stop for the user.
- Decide every judgement call yourself: which side of a contradiction to
  keep, where agent context goes, whether a revert or a comment is a rule or a
  one-off. Make each call from the evidence, then show the result at the next
  decision point for the user to confirm. Never ask the user to judge
  something that needs them to know the history of a pull request.
- Write decision-point messages in the [message shape](#message-shape).
- Use plain words. See [Plain words](../factory-setup/SKILL.md#plain-words).
- Change nothing in the repository, the Tessl workspace, or GitHub until the
  user has confirmed the last group of proposals in step 5.

## Decision points

1. **The plan**, at the end of step 1: the score, and what you will do before
   gathering evidence, such as the plugins you will install and the verifier
   judge model you will use.
2. **The proposals**, in step 5: one message per group (verifiers, Code
   Review lenses, agent context, then lint), each confirmed before the next,
   with the calls you made folded in and room to add or drop items. Apply
   nothing until the last group is confirmed.
3. **The paid testing plan**, in step 7.
4. **Push and open the pull request**, in step 8.

## Message shape

Every decision-point message has this shape and nothing else:

1. One status line: "Preparing your repository: step <n> of 6, <stage>."
   Number and name it from the six stages of the
   [progress timeline](#progress-timeline), not from this skill's step
   numbers: the plan is step 1, the proposals step 4, the paid testing plan
   step 5, and the push step 6. In the plan, the score goes on the same
   line.
2. One sentence saying what you are doing, in your own voice: "I'm ..." or
   "Before I gather evidence, I'll:".
3. The numbered items, one line each, saying what you will do, with a short
   reason only when it is not obvious. Always say the option you will take,
   then the alternative in a few words. Never lay out options for the user to
   choose between, and never add a default to an item: what you say you will
   do is the default.
4. A call you made that changes nothing gets one plain line after the items,
   such as "I left CONTRIBUTING.md's rule as upstream policy."
5. One reply line, such as "Reply go, or tell me what to change."

Do not describe the user's repository or the evidence back to them; they know
it. Evidence appears only as a short "Seen on" note on the proposal it
supports.

## Preflight

Run the checks in [factory-setup step 2](../factory-setup/SKILL.md#2-preflight)
that apply here: the Git repository and GitHub remote, `tessl.json`,
`git status` for uncommitted changes, `tessl whoami`, and the GitHub repo and
its default branch. Stop where those checks stop.

Then fetch the default branch and compare `HEAD` with
`origin/<default branch>`. Steps 1 to 5 read the checked-out files, and step 6
branches from `origin/<default branch>`. When they differ, tell the user and
ask them to switch to an up-to-date default branch before you go on.

## 1. Baseline

Read before you ask:

1. Score the repository following [scoring](references/scoring.md). If you
   cannot start a subagent, skip the score, tell the user in one line, and go
   on to the next item.
2. List the agent context files: `AGENTS.md`, `CLAUDE.md`, rules, skills, and
   anything `tessl.json` installs.
3. Find the linters, CI workflows, dev container, and the install, build,
   test, and lint commands.
4. Check Code Review with `tessl code repo view <owner/repo> --json`. Note
   whether `repository.review.enabled` is true. If the command fails, for
   example because the user is in several organizations without `TESSL_ORG`
   set, Code Review is not available for the organization, or the repository
   is not selected for the GitHub App, treat Code Review as off and continue
   without the lens tier.

Then check the skills this needs: `tessl-verify`, and
`create-code-review-lens` only when item 4 found Code Review on. In Claude
Code and Cursor they install as `tessl__<name>`, so match either name.

Send [decision point 1](#decision-points), the plan:

- For each missing skill, one item saying you will install it for their
  account, without changing the repository: `tessl/tessl-verify` for
  `tessl-verify`, which writes the checks, and `tessl/code-review` for
  `create-code-review-lens`, which writes review rules, with
  `tessl install -g <plugin>`.
- When `tessl-verify` is needed, one item saying you will judge the checks
  with `openai/gpt-6-luna`, or `jev` if they want cheaper and faster but
  still in testing. `tessl-verify` asks its user to choose; answer it from
  this reply and never pass the question on.
- When Code Review is off, one plain line that you will skip review rules.

For example:

```
Preparing your repository: step 1 of 6, baseline. Readiness: Level 3/5, 61%.

Before I gather evidence, I'll:
1. Install tessl-verify for your account, to write the checks. The repo is unchanged.
2. Judge checks with openai/gpt-6-luna. Say "jev" for cheaper and faster, still in testing.

Code Review is off, so I'll skip review rules.
Reply go, or tell me what to change.
```

After the reply, install what the user agreed to and confirm each skill is
visible; if an install fails or a skill is still not visible, say so in one
line. A skill that is still missing, because the user declined, the install
failed, or it is not visible after the install, makes its tier's items "needs
<plugin>" items, shown but not applied, as
[the proposal list](references/routing.md#the-proposal-list) says.

## 2. Gather evidence

Collect where agents and reviewers keep tripping, from the sources in
[evidence](references/evidence.md). Each source is optional; skip one that is
missing and say so in the closing message. Do not message the user here; go
on to step 3.

## 3. Build candidate rules

Turn the evidence into candidate rules, each one a thing the team already
expects and can name. Follow [routing](references/routing.md). Resolve each
contradiction and each context layout choice yourself, as
[routing](references/routing.md#contradictions) and
[context](references/context.md#read-what-is-there) say.

## 4. Route each candidate

Give each candidate one tier, following [routing](references/routing.md):

- lint or test: [lint](references/lint.md)
- verifier: [verifiers](references/verifiers.md)
- Code Review lens, only when Code Review is enabled for the repository:
  [lenses](references/lenses.md)
- agent context: [context](references/context.md)

## 5. Confirm the proposals

Send [decision point 2](#decision-points), the proposals, one group per
message, following [the proposal list](references/routing.md#the-proposal-list).
Send the next group only after the user replies to the one before. Each
message says these are the changes you will make; every numbered item is
made unless the user leaves it out, and the user can add anything the history
did not show. Change nothing until the last group is confirmed;
then apply every kept item in step 6, in one pass. When nothing is left to
apply, stop.

## 6. Apply

Make the confirmed changes on one new branch, following
[apply](references/apply.md#start-the-branch-step-6). Write each tier's files
from its step 6 sections:

- agent context: [context](references/context.md#edit-an-existing-file),
  the step 6 sections its opening list names, ending with "Before you finish"
- verifiers: [verifiers](references/verifiers.md#1-write-one-file-per-rule),
  sections 1 and 2
- Code Review lenses: [lenses](references/lenses.md#write-each-lens), "Write
  each lens" and "The profile"

## 7. Backtest

Run each new verifier and lens on a few historical pull requests, following
the step 7 sections:

- verifiers: [verifiers](references/verifiers.md#3-count-existing-violations),
  sections 3 to 5
- Code Review lenses: [lenses](references/lenses.md#backtest), "Backtest"

Each count, sample, and backtest run spends credits; lint and dry-run
commands are free. Decide `warn` or an exclude list per verifier before
counting, skip a full count that cannot change a level, and ask once for one
plan with a firm total, as
[apply](references/apply.md#paid-runs-and-backtests-step-7) says: that plan is
[decision point 3](#decision-points). Tell the
user each one's catches, false alarms, and the replays that did not exercise
it, which replays used the merged result, and whether its backtest was weak.
Drop or fix the ones the user
rejects; a dropped verifier or lens is deleted. Then check the configuration
and commit, one commit per category, as
[apply](references/apply.md#check-the-configuration-end-of-step-7) says.

## 8. Open the pull request

Follow the step 8 sections of [apply](references/apply.md#re-score-step-8):

1. Re-score, when step 1 scored the repository: re-judge only the criteria
   the branch changed.
2. Send [decision point 4](#decision-points): the score before and after, and
   that you will push and open a pull request. If the user agrees, push,
   open it with each change and its evidence and the lint proposals for the
   team to decide, and give the user its link.
3. Send the [completion message](references/apply.md#closing-message-step-8),
   on either answer.
4. Offer the "Improve development" starter from
   [starters](../factory-setup/references/starters.md#improve-development),
   so recurring mistakes keep being recorded as findings the user can act on.

## Progress timeline

Decision-point messages carry the one-line status from the
[message shape](#message-shape). Show the full timeline only in the closing
message, or when you stop before the end, using the marks and format from
[the factory-setup timeline](../factory-setup/references/progress.md), under
the heading "Preparing your repository", with these stages:

- Baseline (step 1): score the repo and find its tools
- Gather evidence (step 2): read where agents and reviewers trip
- Propose rules (steps 3, 4): build candidate rules and pick a home for each
- Confirm (step 5): you approve the changes I plan to make, or leave some out
- Apply and test (steps 6, 7): make the changes, try them on past pull
  requests, and check the setup
- Open the pull request (step 8): re-score, push, and wrap up
