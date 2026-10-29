# Realty CRM QA portfolio

[Русская версия](README.md)

QA documentation for a portfolio CRM: checklists, test cases, recorded execution
results, and three reproduced defects with HTTP and UI evidence.
The run started on **29 October 2026**, against application revision
[`b2c941a`](https://github.com/nurpeisovnurbolofficial/realty-crm/tree/b2c941a2843c90a5f4216fd4fffc6b4dfd8b3605).

## Start here

- [56-point checklist](checklist.md) and [56 detailed test cases](test-cases.md).
- [Excel workbook](Realty_CRM_QA_Portfolio.xlsx) with filters, editable case statuses, linked totals, and source references.
- [PDF report](Realty_CRM_QA_Report.pdf) with steps, expected and actual results, impact, and screenshots.
- [HTTP responses and UI evidence](evidence/).
- [Local reproduction scripts](reproduce/) and [instructions](README.txt).

Detailed cases and reports are in Russian. HTTP evidence and the Python
reproduction scripts can be reviewed independently of the document language.

## Execution results

| Metric | Count |
|---|---:|
| Designed scenarios | 56 |
| Executed scenarios | 51 |
| Passed | 46 |
| Failed | 5 |
| Not run | 5 |
| Unique defects | 3 |

The five failures map to three defects. BUG-001 and BUG-002 were reproduced
through both HTTP API and UI checks. BUG-003 affects how a field validation
error is displayed; server-side validation passes.
The project's existing 73 backend and 25 frontend automated tests are separate
from this QA run and are not included in these totals.

## Reproduced defects

| Report | Finding | Severity | Priority |
|---|---|---|---|
| [BUG-001](bugs/BUG-001.md) | A deal in the Contract stage accepts a zero amount through editing | Major | P1 |
| [BUG-002](bugs/BUG-002.md) | A deal in the Viewing stage can lose its property through editing | Major | P1 |
| [BUG-003](bugs/BUG-003.md) | A company-name length error is not displayed next to the field | Minor | P2 |

Reports describe the **tested revision**. Open statuses are part of this
snapshot; later application revisions need to be retested.

## Scope and environment

Authentication, CSRF, role-based access, client field boundaries, shared property
catalog, deal stages, commission limits, lost reasons, notes, tasks, search,
pagination, and team-ranking access. Selected UI checks cover RU/EN labels,
Escape and focus return, and the deal page in mobile and desktop layouts.

Execution used an isolated local SQLite database and synthetic users with
`DEMO_MODE=False`. The public demo and real data were not changed.
PostgreSQL concurrency, Firefox, Safari iOS, network failures, and token rotation
are explicitly marked **Not run**. The sequential property-conflict check does
not establish PostgreSQL row-lock behavior.

The materials and execution were prepared with AI assistance. The method,
limitations, and raw evidence are retained so the results can be reviewed and
reproduced.
