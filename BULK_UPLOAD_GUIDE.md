# BEEPREPARE Bulk Upload Protocol v2.0
## Excel & Text Formatting Guide

This guide explains how to format your Excel (.xlsx) or CSV files for bulk question injection into the Matrix Core system.

---

### 1. Primary Excel Columns
Ensure your spreadsheet contains the following headers (case-insensitive):

| Column | Description | Valid Values |
| :--- | :--- | :--- |
| **Question** | The main question text | Any text (min 10 chars) |
| **Type** | The question category | `mcq`, `short`, `long`, `reading_passage`, `case_study`, `simple_matching`, `matrix_matching` |
| **A, B, C, D** | Options for MCQ | Text |
| **Correct** | The correct option letter | `A`, `B`, `C`, or `D` |
| **Marks** | Weightage of question | 1 to 10 |
| **Difficulty**| Complexity level | `Easy`, `Medium`, `Hard` |
| **Tags** | Matrix Engine Metadata | `Important`, `Repeated`, `Exam Focus`, `Formula Based`, `Conceptual`, `Tricky` |
| **Pairs** | For Simple Matching | `A-1, B-2, C-3` |
| **Subquestions** | For Composite Types | `Q1 [5] \| Q2 [10]` (Text followed by [Marks]) |

---

### 2. Complex Type Formatting

#### A. Matching (Simple Matching)
- **Column**: `Pairs`
- **Format**: `LeftItem-RightItem, LeftItem-RightItem`
- **Example**: `France-Paris, India-Delhi, Japan-Tokyo`

#### B. Composite Types (Reading Passage, Case Study, Data Interpretation)
- **Column**: `Subquestions`
- **Format**: `Question Text [Marks] | Question Text [Marks]`
- **Example**: `Who is the protagonist? [2] | What was the theme? [3]`

---

### 3. Matrix Engine Tags (Crucial for DSA Generation)
To ensure questions are recognized by the Paper Generation DSA engine, use these specific tags in the **Tags** column:

- **Important**: High-priority questions.
- **Repeated**: Questions frequently asked in previous exams.
- **Exam Focus**: Maps to `pyqs` in the engine.
- **Formula Based**: For numerical/formulaic questions.
- **Conceptual**: Theoretical/understanding based.
- **Tricky**: High-difficulty/analytical questions.

> [!IMPORTANT]
> If no tags are provided, the system defaults to **standard**.

---

### 4. Image / Diagram Injection
Images cannot be directly embedded in Excel for bulk upload. Instead:
1. Upload your Excel file to the **Bulk Upload Terminal**.
2. Once the **Staging Area** appears, locate the question card.
3. Click **ATTACH DIAGRAM** to select a photo/diagram from your device.
4. The system will automatically encode the image for Cloudinary storage upon execution.

---

### 5. Manual Text Format (Developer Mode)
If you are pasting text directly into the terminal, use the triple-dash separator `---`:

```text
Q: What is the capital of France?
TYPE: mcq
A: London
B: Paris ✓
C: Berlin
D: Madrid
MARKS: 1
DIFFICULTY: Easy
TAGS: Important
---
Q: Explain the theory of relativity.
TYPE: Long
MARKS: 10
DIFFICULTY: Hard
TAGS: Conceptual, Tricky
```
