# Rubric

What the audit checks, in the order a reviewer would go down a profile. These
are rules of thumb from reviewing profiles, not LinkedIn requirements. Each row
is a rule in `packages/core/src/audit/rules.ts`.

## Core: what makes a good profile

The score is the passed weight over the checked weight of these rules.

| Rule | Passes when | Weight |
|---|---|---|
| `basics.custom_url` | The URL doesn't end in a generated code | 2 |
| `photo.present` | There is a profile photo | 3 |
| `photo.banner` | The background isn't LinkedIn's default | 2 |
| `headline.present` | There is a headline | 3 |
| `headline.length` | It uses at least 160 of its 220 characters | 2 |
| `headline.no_asks` | It doesn't ask for a job ("aspiring", "seeking", "looking for", "open to work"…) | 2 |
| `about.present` | There is an About section | 3 |
| `about.metrics_up_front` | A number appears in its first three lines, before "see more" | 2 |
| `experience.descriptions` | Every role has a description of 100+ characters | 2 |
| `experience.bullets` | Every described role is written as bullet points | 2 |
| `experience.company_pages` | Every role links to a company page, so its logo shows | 2 |
| `network.connections` | 500 or more connections | 2 |
| `activity.recent` | Some activity in the last 30 days | 2 |
| `skills.count` | 30 or more skills, so the profile is findable | 2 |

Smaller checks that round these out, weight 1 unless noted: location,
industry, verification, a photo less than five years old, a headline that is
more than the job title, an About section in short paragraphs, experience
listed (3), a current role (2), numbers in role descriptions, and education.

## Bonus: what makes it stand out

Not needed for a good profile, so they don't count toward the score. A profile
that scores 90 or more and passes every bonus rule is a standout profile.

| Rule | Passes when |
|---|---|
| `extras.sections` | It lists projects, certifications, languages and volunteering |
| `extras.recommendations` | It has a recommendation from someone else, or an endorsement |
| `extras.featured` | It has a Featured section: articles, posts, links or media |
