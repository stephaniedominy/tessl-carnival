# Starter automations

Offer the starters that fit how the user works. Describe each one by the job
it takes off their plate, not by its parts.

| Starter                                 | Fits                                      | Built from                              |
| --------------------------------------- | ----------------------------------------- | --------------------------------------- |
| Ship tickets                            | Any repo with GitHub issues or Linear     | `tessl-labs/factory` skills             |
| Answer reviews and fix checks           | Users who ship tickets                    | `tessl-labs/factory` skills             |
| Review pull requests                    | Repos that use pull requests              | Tessl Code Review                       |
| Review what lands on the default branch | Users who push straight to it             | Own skill                               |
| Improve development                     | Repos with merged pull requests           | `tessl-labs/improve-development` skills |
| Scheduled job                           | Anyone, for example a weekly release plan | Own skill                               |

## Ship tickets

"When you add the `tessl` label to an issue, or delegate a Linear issue to
Tessl, an agent reads it, makes the change on its own branch, runs the tests,
and opens one pull request for you to review. On GitHub, only the people
you list can start it."

- Environment: `--github-access write`. For Linear, also
  `--linear-access write`, and follow [Linear prerequisites](linear.md).
- Entries: "Issue to PR" and "Follow ticket changes" in
  [the triggers reference](triggers.md). The "Follow ticket changes" loop
  (the `follow-ticket-changes` action) comes with this starter: it cancels runs when a person takes an issue back, closes the pull
  request when an issue ends, wakes an issue when a person answers Tessl's
  question or its blocker ends, and cancels runs when a pull request closes.
- Stop it: remove the `implement-github-issue` action and
  `github-issue-labelled` trigger, or the `implement-linear` action and
  `linear-issue-delegated` trigger, and the follow-ticket-changes action and triggers,
  from `tessl.json`, and get that change onto the default branch. That
  prevents new runs; it does not cancel one already in progress.
- Stop one ticket: for GitHub, remove the `tessl` label. For Linear, remove
  Tessl delegation or move the issue to a state whose type is `backlog`,
  `triage`, `completed` or `canceled`; the agent checks the state type, not its
  name. A started state, such as Paused, does not stop it. A run already in
  progress may continue until it checks the ticket again.

## Answer reviews and fix checks

"On pull requests that Tessl opened, an agent answers review comments, fixes
failing checks, and tells you when the pull request is ready to merge."

- Only for pull requests that Tessl opened. Offer it when the user chooses
  "ship tickets", or later if they decline it.
- Environment: `--github-access write`.
- Entries: "PR shepherding" in [the triggers reference](triggers.md).
- Stop it: remove the `shepherd` action and its five triggers from
  `tessl.json`, and get that change onto the default branch. That stops new
  runs, not one already in progress. Removing the `tessl` label from a pull
  request does not stop the two triggers that start when a check finishes.

## Review pull requests

"Tessl reviews every pull request and leaves findings as review comments."

- When step 4 found the Tessl Review app not connected, or unable to see the
  repository, [check permissions](permissions.md), then give the user the
  `webUrl` it printed to install the app or
  grant it the repository, and wait until they say it is done.
- Once step 8 of the skill has confirmed the Loops, turn review on with
  `tessl code repo update <owner/repo> --review-enabled`, so the setup pull
  request is not reviewed, and confirm with
  `tessl code repo view <owner/repo> --json`. It needs an
  organization admin. If it refuses, say why and ask the user to turn review
  on under **Code reviews** in the web app.
- With "answer reviews and fix checks" also on, ask when review runs, as
  step 7 of the skill says, so the agent's later fixes are reviewed too.
- No `tessl.json` entries, and nothing to install in the repository.

## Review what lands on the default branch

"When work lands on your default branch, an agent reviews what changed since
the last run and files an issue for each real problem. Nothing waits on it,
so you keep shipping, and you check its issues before you tag a release."

- Event: a push to the default branch, if `tessl doctor --automations`
  accepts it. If not, run it on a schedule instead, for example each night.

## Improve development

"Each week, agents read the review feedback on recently merged pull
requests and the transcripts of recent agent runs, and record each mistake
that keeps recurring as a finding on your Tessl project, with the cheapest
fix. They never change the repository; you choose which findings to act on."

- Two Loops from `tessl-labs/improve-development`: Review Development
  Patterns reads pull request reviews; Agent Retro reads the runs that opened
  pull requests, so offer it once "ship tickets" is on.
- Environment: `<repo>-improve`, with
  `--github-access read --read-other-run-logs`. Only an organization admin
  can create it. If `tessl environment create` refuses, reuse an environment
  from `tessl environment list` that has both, or tell the user an admin must
  create it, and stop.
- Entries: "Improve development" in [the triggers reference](triggers.md).
- Findings appear on the project's Findings page in the web app, and in
  `tessl finding list --project <linked project id>`.
- Stop it: remove its entries from `schedules` in `tessl.json`, and get that
  change onto the default branch. That stops new runs, not one in progress.

## Scheduled job

"At a time you pick, an agent does one job, for example writes a release
plan from open issues, or checks for flaky tests."

- Use a `schedules` entry with an `action` that holds the `skill` and
  `environment`, beside the entry's `cron` and `description`.

## Write your own automation

Use this for any starter whose "Built from" is "Own skill", and for any job
the user asks for that no starter covers.

1. Write the skill at `tessl-factory/skills/<name>/SKILL.md`. Say what the
   agent reads (`.cloud-launch/trigger-events.json` holds the events that
   started it), what it does, what it must not do, and when to stop. Keep it
   short, and show it to the user.
2. Add it to `tessl-factory/.tessl-plugin/plugin.json` as in
   [Editing a factory skill](customize.md).
3. Add an action with `"skill": "file:tessl-factory#<name>"` and the
   environment. Add a trigger with the event and a `when` filter, following
   the shape in [the triggers reference](triggers.md), including a
   `concurrency` key so one ticket or one commit starts one run. For a
   schedule, add a `schedules` entry that names the action with
   `"action": "<name>"`.
4. Run `tessl doctor --automations`. If it rejects the event, tell the user
   and offer a schedule instead.
