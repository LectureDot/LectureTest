# Change Log

All notable changes to the "LectureTest" web app will be documented in this file.



### [0.1.8] - 2026-02-20

#### Added

- Warning for instructors when exiting exam editing mode without saving changes.
- Better control styling/functionality in exam editing mode.


### [0.1.7] - 2026-02-19

#### Added

- Ability to force one-at-a-time question presentation, and accompanying navigation.

#### Fixed

- Answers refreshed from DB when exam is being edited.
- Other minor bug fixes. 


### [0.1.6] - 2026-02-17

#### Fixed

- Minor bug fixes. 


### [0.1.5] - 2026-02-10

#### Added

- Extra credit allowed.
- Added ability to add prefix and postfix and template code patterns to CODE questions.

#### Fixed

- Fixed bug where coding questions with no answers were auto-graded. 


### [0.1.4] - 2026-01-26

#### Added

- Import/Export test json
- Download .zip of all student submissions
- Resize of test question cards


### [0.1.3] - 2025-12-10

#### Added

- new version of reread (no more reliance on rr, only re, better future-proofing)


### [0.1.2] - 2025-11-21

#### Fixed

- reread from regular expression (better handling of special regex chars)
- unicode regular expression testing
- removed some questionable reread patterns

#### Added

- more reread text patterns


### [0.1.1] - 2025-11-19

#### Fixed

- AutoGrader fixed so that it doesn't give points if no answers are supplied by instructor
- QuizBuilder fixed so that copying unit test from right to left doesn't refresh the entire question, just the unit tests (important for when question is not yet saved)
- QuizGrader changed to account for rr/re pattern matching answerSheet format
- localStorage cleared when user logs out
- fixed page reloads on button clicks (added type="button" to button())
- minor UI fixes, feedback toasts

#### Added

- this CHANGELOG.md
- more reread text patterns
- nicer unitTest presentation in question view in left col in QuizBuilder, with options to duplicate and delete unit tests


### [prior]

- initial version, debugging, core features
