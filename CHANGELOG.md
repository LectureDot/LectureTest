# Change Log

All notable changes to the "LectureTest" web app will be documented in this file.


### [0.1.2] - 2024-11-21

#### Fixed

- reread from regular expression (better handling of special regex chars)
- unicode regular expression testing
- removed some questionable reread patterns

#### Added

- more reread text patterns


### [0.1.1] - 2024-11-19

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
