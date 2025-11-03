#!/usr/bin/env python3
"""
Rules-Based CLI Tutor for ascend.py
Demonstrates the foundational ITS before ML integration
"""

import json
import os
from datetime import datetime
from pathlib import Path

# Load domain model
CONTENT_DIR = Path(__file__).parent.parent / "content"
STATE_FILE = Path(__file__).parent / "student_state.json"

def load_json(filename):
    """Load JSON data from content directory"""
    with open(CONTENT_DIR / filename, 'r') as f:
        return json.load(f)

def load_state():
    """Load student state or create new one"""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"attempts": {}, "correct": {}, "total_time": {}}

def save_state(state):
    """Save student state to JSON"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def check_answer(student_answer, correct_answer):
    """Simple string comparison for answer checking"""
    # Normalize whitespace
    student = ' '.join(student_answer.strip().split())
    correct = ' '.join(correct_answer.strip().split())
    return student == correct

def get_feedback(correct, difficulty):
    """Rules-based feedback generation"""
    if correct:
        if difficulty == 1:
            return "✅ Correct! Great job."
        elif difficulty == 2:
            return "✅ Excellent work! You're mastering this skill."
        else:
            return "✅ Outstanding! That was a challenging question."
    else:
        if difficulty == 1:
            return "❌ Incorrect. Hint: Review the basic syntax and try again."
        elif difficulty == 2:
            return "❌ Not quite. Hint: Think about the logic step by step."
        else:
            return "❌ Incorrect. Hint: This is advanced - consider breaking it into smaller parts."

def select_next_question(questions, state, skills):
    """Select question from lowest-performing skill"""
    # Calculate accuracy per skill
    skill_accuracy = {}
    for skill in skills:
        skill_id = skill['id']
        attempts = state['attempts'].get(skill_id, 0)
        correct = state['correct'].get(skill_id, 0)
        accuracy = correct / attempts if attempts > 0 else 0
        skill_accuracy[skill_id] = (accuracy, attempts)
    
    # Find skill with lowest accuracy (prioritize skills with attempts)
    target_skill = min(skills, key=lambda s: (
        skill_accuracy[s['id']][0],  # accuracy
        -skill_accuracy[s['id']][1]  # negative attempts (prefer practiced skills)
    ))
    
    # Get questions for this skill
    skill_questions = [q for q in questions if q['skill_id'] == target_skill['id']]
    return skill_questions[0] if skill_questions else None

def main():
    """Run the CLI tutor"""
    print("\n" + "="*60)
    print("  {ascend.py} - Rules-Based CLI Tutor")
    print("="*60 + "\n")
    
    # Load data
    skills = load_json("skills.json")
    questions = load_json("questions.json")
    state = load_state()
    
    print(f"Loaded {len(skills)} skills and {len(questions)} questions\n")
    
    # Present 5 questions
    for i in range(5):
        print(f"\n--- Question {i+1}/5 ---")
        
        # Select next question
        question = select_next_question(questions, state, skills)
        if not question:
            print("No more questions available!")
            break
        
        skill = next(s for s in skills if s['id'] == question['skill_id'])
        print(f"Skill: {skill['name']} (Difficulty: {question['difficulty']})")
        print(f"\n{question['prompt']}\n")
        
        # Get student answer
        start_time = datetime.now()
        student_answer = input("Your answer: ")
        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Check answer
        correct = check_answer(student_answer, question['answer'])
        
        # Update state
        skill_id = question['skill_id']
        state['attempts'][skill_id] = state['attempts'].get(skill_id, 0) + 1
        if correct:
            state['correct'][skill_id] = state['correct'].get(skill_id, 0) + 1
        state['total_time'][skill_id] = state['total_time'].get(skill_id, 0) + elapsed_ms
        
        # Provide feedback
        feedback = get_feedback(correct, question['difficulty'])
        print(f"\n{feedback}")
        
        if not correct:
            print(f"Expected: {question['answer']}")
    
    # Save state
    save_state(state)
    
    # Print summary
    print("\n" + "="*60)
    print("  Session Summary")
    print("="*60)
    for skill in skills:
        skill_id = skill['id']
        attempts = state['attempts'].get(skill_id, 0)
        correct = state['correct'].get(skill_id, 0)
        if attempts > 0:
            accuracy = (correct / attempts) * 100
            print(f"{skill['name']}: {correct}/{attempts} correct ({accuracy:.1f}%)")
    print("\nState saved to student_state.json")
    print("Run again to continue practicing!\n")

if __name__ == "__main__":
    main()
