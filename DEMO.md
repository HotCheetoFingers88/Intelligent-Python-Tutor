# ascend.py – Demo Walkthrough Summary

This is a short, easy-to-follow version of the three demo cases we’ll show during our presentation.  
Each one highlights how the system *learns and adapts* to the student.

---

## Case 1: Adaptive Question Selection

**Goal:**  
Show that the tutor recognizes when a student is struggling and keeps them on the same topic until they improve.

**Steps:**
1. Go to the **Practice** page.  
2. The system loads a **Loops** question (the weakest skill).  
3. Get the question wrong twice.  
   - The next question is **still a Loops question**.  
   - The system says it’s “repeating until mastered.”  
4. Get the third attempt right.  
   - Mastery for Loops increases.  
   - The next question now switches to **Functions**.

**What it proves:**  
The system tracks performance and adapts what questions you see based on your mastery level.

---

## Case 2: Feedback Personalization

**Goal:**  
Show that the tutor changes the *type of feedback* based on how the student performs.

**Steps:**
1. Stay on the **Variables** questions.  
2. Get one wrong → system gives a **hint** (“Remember to use `=` when assigning variables.”).  
3. Get another wrong → system gives a **worked example** showing the full correct answer.  
4. Get the next one right → system gives a **praise message** (“Nice job! Moving to next topic.”).

**What it proves:**  
The tutor doesn’t just mark right or wrong — it adjusts how it teaches, offering more help when needed.

---

## Case 3: Mastery Dashboard & Recommendation

**Goal:**  
Show that the system tracks overall mastery and recommends what to study next.

**Steps:**
1. Open the **Dashboard** page.  
2. You’ll see progress bars for each skill (Variables, Loops, Functions).  
3. The lowest bar (e.g., Loops) is highlighted with a message:  
   **“We recommend reviewing Loops next.”**  
4. Go back to practice and get a Loops question correct.  
5. Refresh the dashboard — Loops mastery goes up, and a new skill is recommended.

**What it proves:**  
The tutor can summarize learning progress and guide the student toward their next focus area.
