# ADR 0001: dependency-free prototype and pure rule planner

Status: accepted for foundation; production architecture remains proposed.

Context: empty repository, cross-platform goal, no selected hosting or provider credentials. We need a reviewable workflow and domain semantics without pretending that integration exists.

Decision: use browser-standard UI, ECMAScript modules, Node's built-in development server and test runner. Separate rule planning from execution. Keep the first UI on synthetic data. Do not choose a desktop shell or production backend solely to ship a mock.

Consequences: easy local setup and shared domain tests; no bundler or dependency installation required. This is not a production rendering stack, authentication solution or desktop distribution. Revisit UI tooling when accessibility, component complexity or packaging justify it; preserve domain contracts and tests.
