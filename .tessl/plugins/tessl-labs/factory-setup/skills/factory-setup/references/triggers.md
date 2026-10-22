# Triggers reference

Replace `<env>` with the environment name and `<user-id>` with the GitHub user
ID of the person setting up (`gh api user --jq .id`). Write
`{{ linear.tesslApp.userId }}` exactly as shown: Tessl replaces it with the Tessl
agent's Linear user id from the workspace's Linear connection. Add the actions
under `actions` and the triggers under `triggers`. If a key already exists, ask
the user before you replace it.

The agents get write access to the repository, so every GitHub trigger that a
person's action starts matches `event.sender.id`: only the people listed there
can start it, even on a public repository. Use the same list in every trigger.
To let more people start them, list their IDs:
`"event.sender.id": { "in": [<user-id>, <other-id>] }`. Find someone's ID with
`gh api users/<login> --jq .id`. When Code Review is on or chosen,
`shepherd-pr-review` also lists `<review-bot-id>`, the Tessl Review bot's ID,
from `gh api 'users/tessl-reviewer[bot]' --jq .id`; leave it out otherwise.
Every trigger whose event names the pull request's head also matches
`<repo-id>`, the repository's ID from `gh api repos/<owner>/<repo> --jq .id`, so
a pull request from a fork whose branch also starts with `tessl/` starts
nothing. A PR comment's event has no head; the shepherd itself stops on a pull
request from a fork. The triggers that start implementation on an issue and
wake it on a reply match only open issues; the one for a closed issue matches
closed ones, so it can close Tessl's pull request.

New implement, shepherd, and Improve development actions use Claude Opus 5.5. The follow-ticket-changes action
does small bookkeeping jobs, so it uses Codex with GPT-6 Luna. The user can
change the model or remove it. Removing it uses the platform default instead.
Before you write a pair, confirm that `tessl launch models --json` lists it for
this workspace, as step 2 of "Write tessl.json" in the skill says.

## Issue to PR with Linear

```json
"actions": {
  "implement-linear": {
    "skill": "tessl-labs/factory#implement-linear",
    "environment": "<env>",
    "agent": "claude",
    "model": "claude-opus-5-5"
  }
},
"triggers": {
  "linear-issue-delegated": {
    "on": ["linear:Issue.create", "linear:Issue.update"],
    "when": {
      "event.data.delegateId": "{{ linear.tesslApp.userId }}",
      "event.data.state.type": "unstarted"
    },
    "concurrency": {
      "keys": [{ "key": "implement:{{ event.data.id }}", "limit": 1 }]
    },
    "action": "implement-linear"
  }
}
```

## Issue to PR with GitHub Issues

```json
"actions": {
  "implement-github-issue": {
    "skill": "tessl-labs/factory#implement-github-issue",
    "environment": "<env>",
    "agent": "claude",
    "model": "claude-opus-5-5"
  }
},
"triggers": {
  "github-issue-labelled": {
    "on": ["github:issues.labeled"],
    "when": {
      "event.label.name": "tessl",
      "event.sender.type": "User",
      "event.sender.id": <user-id>,
      "event.issue.state": "open"
    },
    "concurrency": {
      "keys": [
        {
          "key": "implement:{{ event.repository.id }}#{{ event.issue.number }}",
          "limit": 1
        }
      ]
    },
    "action": "implement-github-issue"
  }
}
```

## PR shepherding

The implement skills open pull requests with the `tessl` label on a `tessl/`
branch. `shepherd-pr-review` and `shepherd-pr-review-comment` match both the
label and the branch. `shepherd-pr-comment` matches only the label; the
shepherd then stops without acting on a pull request that is not on a `tessl/`
branch. `shepherd-checks-failed` and `shepherd-checks-passed` match only the
`tessl/` branch, not the label, so removing the label does not stop them.
To turn the shepherd off, remove the `shepherd` action and all five of its
triggers. That prevents new rounds; it does not cancel one in progress.

```json
"actions": {
  "shepherd": {
    "skill": "tessl-labs/factory#shepherd",
    "environment": "<env>",
    "agent": "claude",
    "model": "claude-opus-5-5"
  }
},
"triggers": {
  "shepherd-pr-review": {
    "on": ["github:pull_request_review.submitted"],
    "when": {
      "event.pull_request.labels.*.name": { "any": { "equals": "tessl" } },
      "event.pull_request.head.ref": { "matches": "^tessl/" },
      "event.pull_request.head.repo.id": <repo-id>,
      "event.pull_request.state": "open",
      "event.sender.id": { "in": [<user-id>, <review-bot-id>] }
    },
    "concurrency": {
      "debounce": "90s",
      "keys": [{ "key": "shepherd:{{ event.pull_request.number }}", "limit": 1 }]
    },
    "action": "shepherd"
  },
  "shepherd-pr-review-comment": {
    "on": ["github:pull_request_review_comment.created"],
    "when": {
      "event.pull_request.labels.*.name": { "any": { "equals": "tessl" } },
      "event.pull_request.head.ref": { "matches": "^tessl/" },
      "event.pull_request.head.repo.id": <repo-id>,
      "event.pull_request.state": "open",
      "event.sender.id": <user-id>
    },
    "concurrency": {
      "debounce": "90s",
      "keys": [{ "key": "shepherd:{{ event.pull_request.number }}", "limit": 1 }]
    },
    "action": "shepherd"
  },
  "shepherd-pr-comment": {
    "on": ["github:issue_comment.created"],
    "when": {
      "isPullRequest": "true",
      "event.issue.labels.*.name": { "any": { "equals": "tessl" } },
      "event.issue.state": "open",
      "event.sender.id": <user-id>
    },
    "concurrency": {
      "debounce": "90s",
      "keys": [{ "key": "shepherd:{{ event.issue.number }}", "limit": 1 }]
    },
    "action": "shepherd"
  },
  "shepherd-checks-failed": {
    "on": ["github:check_run.completed"],
    "when": {
      "event.check_run.pull_requests.0.number": { "exists": true },
      "event.check_run.pull_requests.0.head.repo.id": <repo-id>,
      "event.check_run.check_suite.head_branch": { "matches": "^tessl/" },
      "event.check_run.conclusion": {
        "in": ["failure", "timed_out", "startup_failure", "action_required"]
      }
    },
    "concurrency": {
      "debounce": "90s",
      "keys": [
        { "key": "shepherd:{{ event.check_run.pull_requests.0.number }}", "limit": 1 }
      ]
    },
    "action": "shepherd"
  },
  "shepherd-checks-passed": {
    "on": ["github:check_suite.completed"],
    "when": {
      "event.check_suite.pull_requests.0.number": { "exists": true },
      "event.check_suite.pull_requests.0.head.repo.id": <repo-id>,
      "event.check_suite.head_branch": { "matches": "^tessl/" },
      "event.check_suite.conclusion": "success"
    },
    "concurrency": {
      "debounce": "90s",
      "keys": [
        { "key": "shepherd:{{ event.check_suite.pull_requests.0.number }}", "limit": 1 }
      ]
    },
    "action": "shepherd"
  }
}
```

A Linear issue to PR setup with shepherding also needs `--linear-access` on
the environment, because the shepherd reads the Linear issue.

## Follow ticket changes

One small loop keeps the factory in step with what people do. Add it with
"Issue to PR", in the same `tessl.json` change and the same environment. Each
trigger tells the skill what happened through the `TICKET_CHANGE` input:

- `taken-back`: a person takes an issue back, so cancel its runs.
- `issue-ended`: a person ends an issue, so close its open pull request and
  wake the issues it was blocking.
- `replied`: a person answers Tessl's question, so wake the issue.
- `pr-closed`: a Tessl pull request closes, so cancel its runs.

```json
"actions": {
  "follow-ticket-changes": {
    "skill": "tessl-labs/factory#follow-ticket-changes",
    "environment": "<env>",
    "agent": "codex",
    "model": "gpt-6-luna"
  }
}
```

The `replied` triggers share the implement concurrency key, so a wake never
runs at the same time as an implement round on the same issue. The others use
their own key, so a cancellation never waits behind the run it cancels.

### With Linear

```json
"triggers": {
  "follow-ticket-changes-linear-taken-back": {
    "on": [
      "linear:Issue.update"
    ],
    "when": {
      "event.data.delegateId": "{{ linear.tesslApp.userId }}",
      "event.actor.id": {
        "not": {
          "equals": "{{ linear.tesslApp.userId }}"
        }
      },
      "event.updatedFrom.stateId": {
        "exists": true
      },
      "event.data.state.type": {
        "in": [
          "backlog",
          "triage"
        ]
      }
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.data.id }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "taken-back"
      }
    }
  },
  "follow-ticket-changes-linear-ended": {
    "on": [
      "linear:Issue.update"
    ],
    "when": {
      "event.data.delegateId": "{{ linear.tesslApp.userId }}",
      "event.actor.id": {
        "not": {
          "equals": "{{ linear.tesslApp.userId }}"
        }
      },
      "event.updatedFrom.stateId": {
        "exists": true
      },
      "event.data.state.type": {
        "in": [
          "completed",
          "canceled",
          "duplicate"
        ]
      }
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.data.id }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "issue-ended"
      }
    }
  },
  "follow-ticket-changes-linear-replied": {
    "on": [
      "linear:AgentSessionEvent.prompted"
    ],
    "when": {
      "event.appUserId": "{{ linear.tesslApp.userId }}",
      "event.agentActivity.signal": {
        "not": {
          "equals": "stop"
        }
      }
    },
    "concurrency": {
      "keys": [
        {
          "key": "implement:{{ event.agentSession.issue.id }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "replied"
      }
    }
  },
  "follow-ticket-changes-pr-closed": {
    "on": [
      "github:pull_request.closed"
    ],
    "when": {
      "event.pull_request.labels.*.name": {
        "any": {
          "equals": "tessl"
        }
      },
      "event.pull_request.head.ref": {
        "matches": "^tessl/"
      },
      "event.sender.id": <user-id>,
      "event.pull_request.head.repo.id": <repo-id>
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.repository.id }}#{{ event.pull_request.number }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "pr-closed"
      }
    }
  }
}
```

Wakes from blockers happen only when an issue delegated to Tessl ends: when a
person finishes the last open blocker themselves, the dependent waits until a
person moves it. A reply wakes an issue only through Tessl's agent session.

### With GitHub Issues

```json
"triggers": {
  "follow-ticket-changes-github-taken-back": {
    "on": [
      "github:issues.unlabeled"
    ],
    "when": {
      "event.label.name": "tessl",
      "event.sender.id": <user-id>
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.repository.id }}#{{ event.issue.number }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "taken-back"
      }
    }
  },
  "follow-ticket-changes-github-ended": {
    "on": [
      "github:issues.closed"
    ],
    "when": {
      "event.issue.labels.*.name": {
        "any": {
          "equals": "tessl"
        }
      },
      "event.sender.id": <user-id>
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.repository.id }}#{{ event.issue.number }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "issue-ended"
      }
    }
  },
  "follow-ticket-changes-github-replied": {
    "on": [
      "github:issue_comment.created"
    ],
    "when": {
      "isPullRequest": "false",
      "event.issue.state": "open",
      "event.issue.labels.*.name": {
        "any": {
          "equals": "tessl"
        }
      },
      "event.sender.id": <user-id>
    },
    "concurrency": {
      "keys": [
        {
          "key": "implement:{{ event.repository.id }}#{{ event.issue.number }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "replied"
      }
    }
  },
  "follow-ticket-changes-pr-closed": {
    "on": [
      "github:pull_request.closed"
    ],
    "when": {
      "event.pull_request.labels.*.name": {
        "any": {
          "equals": "tessl"
        }
      },
      "event.pull_request.head.ref": {
        "matches": "^tessl/"
      },
      "event.sender.id": <user-id>,
      "event.pull_request.head.repo.id": <repo-id>
    },
    "concurrency": {
      "keys": [
        {
          "key": "follow-ticket-changes:{{ event.repository.id }}#{{ event.pull_request.number }}",
          "limit": 1
        }
      ]
    },
    "action": {
      "use": "follow-ticket-changes",
      "inputs": {
        "TICKET_CHANGE": "pr-closed"
      }
    }
  }
}
```

Tessl removes and adds the label itself to wake an issue. The `event.sender.id`
filter keeps those changes from starting `follow-ticket-changes-github-taken-back`.

To turn the follow-ticket-changes loop off, remove its action and triggers. Without it,
Tessl still stops at its next round when a person takes an issue back, but
runs in progress finish, open pull requests stay open, and a blocked or
waiting issue stays put until a person moves it.

## Improve development

Replace `<org-id>` with the organization's `id` from `tessl org list --json`
and `<project-id>` with `linkedProject.id` from `tessl project repair --json`.
Both run weekly, on different days, with the environment from
[Improve development](starters.md#improve-development).

```json
"schedules": {
  "review-development-patterns": {
    "cron": "0 6 * * 1",
    "description": "Find review feedback that agent context or a verifier could prevent",
    "action": {
      "skill": "tessl-labs/improve-development#review-development-patterns",
      "environment": "<env>",
      "agent": "claude",
      "model": "claude-opus-5-5",
      "inputs": { "orgId": "<org-id>", "projectId": "<project-id>" }
    }
  },
  "agent-retro": {
    "cron": "0 6 * * 3",
    "description": "Find problems that recur across recent agent runs",
    "action": {
      "skill": "tessl-labs/improve-development#agent-retro",
      "environment": "<env>",
      "agent": "claude",
      "model": "claude-opus-5-5",
      "inputs": { "orgId": "<org-id>", "projectId": "<project-id>", "windowDays": "7" }
    }
  }
}
```

`windowDays` is how many days of runs Agent Retro reads, from 1 to 30. Keep it
equal to the days between runs.
