# Tessl features worth offering

A factory that ships tickets is the start. These features make it better at
the work, and catch more before a person has to. For each: what to tell the
person, how to tell whether it is already on, how to set it up, and what it
costs. Offer only what is off, and say in one sentence what this repository
would get from it.

Every "is it on" check reads the default branch on GitHub, not the local
checkout, which can have uncommitted or out-of-date changes:
`gh api repos/<owner>/<repo>/contents/<path> --jq .content | base64 -d`
reads a file, and a 404 means it is not there.

Which skill a schedule runs. A `schedules` entry names it in one of four
ways:

- `action` is an object with its own `skill`;
- `action` is the name of an entry under `actions`, and runs that entry's
  `skill`;
- `action` is an object whose `use` names an entry under `actions`: its own
  fields override that entry's, so it runs the object's `skill` when it sets
  one, and the entry's `skill` otherwise;
- the older flat form: `skill` sits on the schedule itself, beside `cron` or
  `schedule`, with no `action`.

Resolve every entry before deciding a job is off, or the person is offered a
job they already have.

A repository's history is its own pull requests and reviews. A fork carries
none of its upstream's, so on a fork or a new repository the features that
learn from history (Improve development, lenses, verifiers, prepare-repo) have
only the factory's own few pull requests to read; say so.

## Improve development

**Tell them:** each week, agents read how the work went and record each
mistake that keeps recurring as a finding on the project, with the cheapest
fix. They never change the repository; the person picks which findings to act
on. Two automations:

- **Review development patterns** (Mondays) reads the review feedback on pull
  requests merged in the last week, people's as well as Tessl's, and records
  at most three findings, each saying whether the fix is agent context, a
  verifier, or both. Ready once the repository has a week with several
  merged pull requests that got review comments, from people or Code Review.
- **Agent retro** (Wednesdays) reads the transcripts of the factory's own runs
  that opened pull requests, and their review feedback, and records the
  themes that recur across two or more pull requests. It needs "ship
  tickets" on, and is ready once that has opened three or more pull
  requests.

When only one is ready, say so, and that the other can be added later.

**Is it on:** a schedule in `tessl.json` runs
`tessl-labs/improve-development#review-development-patterns` or
`#agent-retro`, as "Which skill a schedule runs" at the top of this page
describes.

**Set up:** follow "Improve development" in
[starters](../../factory-setup/references/starters.md) and its entries in
[triggers](../../factory-setup/references/triggers.md). It needs its own read-only environment, `<repo>-improve`,
created with `--github-access read --read-other-run-logs`; only an
organization admin can create it.

**Try it:** only once its Loop has appeared after the merge, and only with
`tessl schedule trigger <loop id>`, the id from `tessl schedule list`. A run
started any other way, such as `tessl launch skill`, belongs to no Loop, and
Tessl refuses its findings: `tessl finding create` fails with "Not Found",
and the run's work is lost.

**Costs:** one scheduled run a week for each automation, each using credits
like any other run. Say the organization-admin step up front.

## Findings

**Tell them:** findings are the concrete problems Improve development records
on the project: each has the evidence, what to change, and what it should
improve. They are on the project's Findings page in the web app. Acting on
them is how the factory stops repeating a mistake.

**Is there anything:** `tessl finding list --project <project id> --state open --json`.
States are `open`, `in-progress`, `resolved`, and `ignored`.

**Act on one:** `tessl finding view <id> --json` for the recommendation. Make
the fix it names: an `instructions` line on an action, agent context, a
verifier, or a review lens below. Then link the pull request with
`tessl finding link add <id> --type pull_request --url <url>`, which moves it
to `in-progress`. Mark it resolved only once the fix is merged and the mistake
has stopped, with `tessl finding update <id> --file <file>` and
`{"state": "resolved"}` in the file. Leave ignoring a finding to the person.

**Costs:** nothing; the commands only read and update the record. Updating
needs edit access to the workspace.

## Code Review lenses

**Tell them:** Code Review reviews with four standard lenses (correctness,
security, scale, maintainability). A lens of their own teaches it the
repository's rules, such as "every migration has a rollback", and a
`.tessl-code-review.yml` at the repository root says which lenses review which
paths. Findings the team keeps leaving by hand become ones the review leaves
for them.

**Is Code Review on:** `tessl code repo view <owner/repo> --org <org> --json`:
`repository.review.enabled` is true and `repository.attentionReason` is null.
Lenses need it on.

**Are there lenses of their own:** `repository.review.reviewProfileStatus` is
`present` when a `.tessl-code-review.yml` is on the default branch. When it is
`unknown`, read the file from the default branch on GitHub, as above.

**Set up:** `prepare-repo` proposes lenses from the repository's own review
history and backtests them. To write one directly, use the
`create-code-review-lens` skill (listed as `tessl__create-code-review-lens`
in some agents). If it is missing, ask before you install its plugin for the
person's account only, with `tessl install -g tessl/code-review`, which
leaves the repository unchanged; a plain `tessl install` would add it to
`tessl.json`, and every cloud run would install it too. Each
lens is `review-lenses/<name>/SKILL.md`, listed under `lenses:` with its
globs. Keep to eight lenses or fewer that apply to any one change. It takes
effect once merged to the default branch. The profile and lenses are read from
each pull request, so suggest protecting them with `CODEOWNERS`.

**Costs:** each review round uses credits whatever lenses it runs; each
backtest run uses credits too. Docs:
https://docs.tessl.io/tutorials/setting-up-agentic-code-review

## Verifiers

**Tell them:** a verifier is a rule a linter cannot express, such as "every
error message says what to do next", checked by a model against the files it
covers. On pull requests it reports as a Tessl Verify check, which can block
the merge once it is reliable. The factory's agents can run it before they
push.

**Is it on:** `tessl.json` has a `verify.groups` entry; the verifier files are
usually under `verifiers/`. Whether pull requests are checked is a web-app
setting (Reviewer, Verify PRs): look for a Tessl Verify check on recent pull
requests.

**Set up:** `prepare-repo` proposes verifiers from the repository's review
history and CI failures. To write one directly, use the `tessl-verify` skill
(or `tessl__tessl-verify`). If it is missing, ask before you install it for
the person's account only, with `tessl install -g tessl/tessl-verify`. Start each at `level: "warn"` and raise it to
`error` once it is reliable. `tessl change verify --dry-run --all --show-files`
shows what it would check and costs nothing. Turning on Verify PRs needs an
organization admin, in the web app.

**Costs:** each check run uses credits; lint and dry runs are free. Docs:
https://docs.tessl.io/codifying-and-enforcing/verifiers-overview

## Prepare the repository

**Tell them:** one skill that does the three above from the repository's own
history: it reads review feedback, CI failures and fix commits, and proposes
agent context, verifiers, and review lenses, each with its evidence, then
backtests them. It changes nothing until the person picks what to keep, and
opens one pull request.

**Is it on:** no `verify.groups` in `tessl.json` and no `.tessl-code-review.yml`
means it has most likely not run; it may have run with the person keeping
only agent context, or nothing.

**Set up:** the [prepare-repo](../../prepare-repo/SKILL.md) skill, in this plugin.

**Costs:** backtests use credits; it asks once for a plan with a total first.

## Scheduled jobs

**Tell them:** the factory can also do recurring work on a timer. Ready-made
ones:

- **Changelog** (`tessl/changelog-writer`): drafts the next changelog entry
  from merged pull requests and opens a pull request. Weekly.
- **Docs audit** (`tessl/docs-audit`): checks the docs still match the code and
  opens a pull request when they have drifted. Daily.
- **Release check** (`tessl/release-check`): walks the release checklist
  (migrations, feature flags, changelog, docs) and reports what is missing.
  Weekly.
- **Review miner** (`tessl/review-miner`): finds review feedback that keeps
  coming up and proposes a lint rule, check, or convention. Weekly. Offer
  Improve development instead when it is not on; it does this and more.
- **Test health** (`tessl/test-health`): finds flaky or repeatedly failing
  tests in CI and files a ticket for each. Daily. Its tickets are work "ship
  tickets" can then take on.

**Is it on:** a schedule in `tessl.json` runs the job's skill, as "Which
skill a schedule runs" at the top of this page describes.

**Set up:** a `schedules.<name>` entry with an `action` (`skill`,
`environment`, optional `instructions`) and a `schedule` such as
`"weekly on friday at 16:00"`; `tessl schedule validate` checks it. A job that
opens pull requests needs an environment with write access; the factory's own
can be reused.

**Costs:** each run uses credits like any other run. Docs:
https://docs.tessl.io/automations/overview/example-schedules
