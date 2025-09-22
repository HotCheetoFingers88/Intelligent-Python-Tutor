# Update this file with instructions from Lab 2

# Group 7 - Lab 2

## User Stories

As a \[user type], I want \[some action/function], so that \[benefit]


## Functional Requirements

### Stakeholders and Access

**Students can sign up, log in, and reset passwords.**

* As a student I want short answer questions so that I can study efficiently.
* As a student I want a secure login so that my information is safe.
* As a student I want comprehensive questions so that I can study effectively.
* As a student I want test-like questions so that I am adequately prepared for assessments.
* As a student I want to be able to upload lecture slides so that I can cover all content.
* As a student I want to be able to receive more in depth guidance upon request so I can get extra help in areas I am unfamiliar with.
* As a student I want to be able to receive visual guides so I have a clear understanding of content.
* As a student I want a simple UI so I can easily receive guidance.
* As a student I want the ability to customize the user interface to my liking (light/dark etc).
* As a student I want quick response times so that I can spend more time studying and less time waiting.
* As a student I want to be able to easily input math equations so that I can receive quick and proper guidance for advanced math courses.
* As a student I want to change the difficulty of the questions being asked to me upon request so I can learn at my own pace.
* As a student I want to be able to correct any misunderstandings by the tutor so I can continually receive correct information in the correct contexts.
* As a student I want to be able to submit PDFs to the tutor so I can trust that I am getting correct and comprehensive help.
* As a student I want to be able to upload code snippets so that I can have help debugging.
* As a student I want to track my progress through stages and achievements in order to see how well I am doing.
* As a student I want to set daily goals so that I can stay motivated and track my progress.
* As a student I want the ability to skip any question I am struggling with so that I can use my time more efficiently.
* As a student I want a dedicated section that makes me recomplete the areas that I was stuck on and required help before moving forward (test to see if built a proper foundation).
* As a student I want to receive customized feedback that is tailored to my learning style so that I can understand concepts efficiently.
* As a student I want to be able to share my sessions with other students so that collaboration is easy.
* As a student I want random errors like missing a sign or a misspelling to be treated differently from errors that show a lack of understanding so that my subject understanding is tracked properly.
* As a student I want the ability to review a topic that I have already mastered so that I can quickly regain my familiarity with a certain subject.
* As a student I want to be able to send in any text such as an essay and have an AI tell me what my predicted grade will be, and provide suggestions of improvement.
* As a student I want in-app notifications so that I can stay on top of the tasks that I need to complete.

**Teachers can create classes, invite/enroll students, and manage rosters.**

* As a teacher I want simple UI so that I can manage classrooms easily.
* As a teacher I want good security so that student information is safe.
* As a teacher I want software that supports different file types so I can upload work easier.
* As a teacher I want tools that allow me to set daily goals or create badges to encourage students to keep learning.
* As a teacher I want the ability to organize content in different groups/sections so it’s easier to find and manage.
* As a teacher I want to be able to add items like hints to help students who are struggling on questions.
* As a teacher I want to be able to group questions with multiple pieces of content so students and teachers can easily view dependencies and prerequisites.
* As a teacher I want gated progressions so that I know students are only able to move on once they fully understand the current topic.
* As a teacher I want exercises to have the option to randomize questions or create a pool of them and choose from there so students have a variety of questions.
* As a teacher I want to have the option to seamlessly be able to sort and access the created rosters.
* As a teacher I want the ability to create flexible deadlines in order to keep students on the right track.
* As a teacher I want a mastery system so it’s easy to track how students are progressing.
* As a teacher I want the ability to contact a parent/guardian so that I can answer any questions they may have about their child’s progress.
* As a teacher I want the ability to easily track any student’s progress so that I can see where each student is at.
* As a teacher I want good content authoring UI so it’s easy to edit and create questions/problems.
* As a teacher I want to be able to post announcements related to the content students are studying to eliminate confusion.

**Admins can manage users, roles, and system settings.**

* As an admin I want the ability to manage users, roles, and system settings so that maintenance is easy.
* As an admin I want to have unrestricted access to be able to change what I need to change, that the users cannot.

**Parents/guardians can view read-only progress (if enabled).**

* As a parent/guardian, I want to view my child’s progress so that I can ensure they are on the right track.
* As a parent/guardian I want to be able to highlight issues and later show my children.
* As a parent/guardian I want to be able to find what my child did to not have to scroll through the whole project.
* As a parent/guardian I want to be able to comment (not edit) on text so that they could see where/what could be changed.
* As a parent/guardian I want to be able to see what edits my children did so I can further track their understanding.
* As a parent/guardian I want personal security so that my account is not at risk so that I do not get hacked.
* As a parent/guardian I want a hidden mode so that my children do not see that I was tracking them so they do not feel discouraged.
* As a parent/guardian I want to receive updates on my child’s progress so I can easily track their progress.
* As a parent/guardian I want to be able to view my child’s account with ease so I can make changes that I feel are necessary.
* As a parent/guardian I want to be able to contact the teacher so that I can tailor my child’s at-home study plan appropriately.

**Other Access & Controls**

* OAuth (Google) sign-in is available.
* Role-based access control enforces permissions.

---

## Domain Model

* The system stores concepts/skills with prerequisites/dependencies.
* Exercises/problems are tagged to one or more concepts.
* Concepts support metadata:

  * Difficulty, hints, examples.
* Content types: MCQ, short answer, text.
* Each problem includes solutions and explanations.
* Problem pools support variants and randomization.
* Content authoring UI for teachers: create/edit/import questions and tag skills.
* Content can be grouped into modules/units/assignments.
* Content import/export (CSV/JSON) for portability.

---

## Student Model

* Track attempts, correctness, timestamps, time on a certain task, hint usage.
* Track streaks, badges, and daily goals.
* Store engagement signals (timeouts, rapid guessing, revisit rate).
* Maintain mastery estimates per concept (beginner/intermediate/advanced).
* Allow manual teacher overrides of mastery.
* Record misconceptions/error patterns (off by one, sign error).

---

## Tutoring

* Recommend the next problem based on mastery, prerequisites, and recent performance.
* Adjust difficulty up/down based on streaks and errors.
* Provide tiered hints.
* Gate progression (unlock next concept at target mastery).
* Trigger remediation to prerequisite concepts on repeated errors.
* Schedule light review after inactivity.
* Allow teacher override/pinning of the next recommended item.

---

## Feedback

* Immediate correct/incorrect feedback after submission.
* Short “why” messages linked to the concept.
* Worked solution after an attempt.

---

## Assignments / Quizzes

* Teachers can create assignments with title, due date, and problem count.
* Support timed assignments and extra-time accommodations per student.
* Attempt policy options (best-of-N or last attempt counted).
* Export assignment scores as CSV.

---

## Analytics

* **Student dashboard:** mastery by concept, recent attempts, streaks.
* **Teacher dashboard:** class heatmap by concept.
* Class/assignment reports downloadable as CSV.

---

## UI / UX

* Clean practice flow: Next → Submit → Feedback → Next.
* Responsive on laptop/desktop.
* Light and dark mode optional.
* Progress indicators.
* Streaks and badges.
* Notifications:

  * In-app notifications for new assignments, due soon, and inactivity nudges.
  * Optional weekly summaries to students (+ Parents if enabled).

---

## Admin

* Admin and teachers can CRUD users, classes, concepts, and problems.
* Problem version note (retain current and previous version).
* Mastery override action with reason (note/reason required).

---

## Non-Functional Requirements

### Usability

* Clear and consistent screens for: login → dashboard → practice → review.
* Works on a standard laptop screen.
* Core flows keyboard-usable (tab through inputs, submit with Enter).

### Reliability

* No data loss on refresh.
* Attempts are saved when submitted.
* Basic error messages and a visible retry if save fails.

### Performance

* Main screens feel responsive on campus Wi-Fi.
* Pre-load the next problem to keep flow smooth.

### Security

* Passwords stored hashed.
* Role checks enforced in backend (Student/Teacher/Admin).
* Store minimal personal information (name + email).

### Accessibility

* Labels for form inputs, alt text for images, readable color contrast.
* Do not rely on color alone to convey correctness.

### Maintainability

* Modular code by layers: domain / student model / tutor / UI.
* README with setup, run instructions.
* `.env` example included.

### Testing

* Unit tests for mastery update rules and next-item selection.
* Small manual test checklist for core flows (login, attempt, hint, mastery change).

### Deployability

* Runs locally with one command (Docker or npm).

### Observability

* Console logs for key events (login, attempt saved, recommendation made).
* Option to download a `.log` file of recent events.




