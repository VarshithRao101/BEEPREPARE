# 🐝 BEEPREPARE Bulk Upload Protocol (v1419)

This guide explains how to prepare Question Banks for mass injection into the BEEPREPARE Neural Core. The system supports both **Excel/CSV files** and **Direct Text Entry**.

---

## 📊 1. Excel / CSV Column Mapping

The system automatically detects the following columns. Ensure your headers match exactly.

| Column Header | Required | Description | Values |
| :--- | :--- | :--- | :--- |
| **Question** | Yes | The actual question text | String (e.g., "What is Pi?") |
| **Type** | Yes | The format of the question | `mcq`, `short`, `long`, `very_short` |
| **A** | MCQ Only | Option A text | String |
| **B** | MCQ Only | Option B text | String |
| **C** | MCQ Only | Option C text | String |
| **D** | MCQ Only | Option D text | String |
| **Correct** | MCQ Only | The correct option letter | `A`, `B`, `C`, or `D` |
| **Marks** | No | Marks for the question | Number (Defaults to 1) |
| **Difficulty** | No | Complexity level | `easy`, `medium`, `hard` |

### 💡 Example Rows:
1. **MCQ**: `What is 2+2?`, `mcq`, `3`, `4`, `5`, `6`, `B`, `1`, `easy`
2. **Theory**: `Explain Photosynthesis`, `long`, (empty), (empty)..., (empty), `5`, `hard`

---

## 📝 2. Direct Text Format (Copy-Paste)

If you are pasting questions directly into the terminal, use the **Triple-Dash (`---`) Separator**.

### MCQ Template:
```text
Q: What is the primary gas in Earth's atmosphere?
TYPE: mcq
A: Oxygen
B: Nitrogen ✓
C: Carbon Dioxide
D: Argon
MARKS: 1
DIFFICULTY: easy
---
```
*   **Note**: Use the checkmark ` ✓` next to the correct option text.

### Theory Template:
```text
Q: Describe the process of evaporation in detail.
TYPE: long
MARKS: 5
DIFFICULTY: medium
---
```

---

## ⚙️ 3. Execution Rules

1.  **Sync First**: Always enter the **Core Bank ID** (e.g., `TRNT-XXXX-...`) and click **SYNC** before uploading.
2.  **Batch Limit**: Maximum **50 questions per injection**.
3.  **Correct Symbols**: In text mode, the system looks for the ` ✓` symbol. If missing, the first option is often assumed correct for MCQs.
4.  **Chapter targeting**: Ensure you select the correct **Chapter** from the dropdown after syncing to organize your bank effectively.

---

## 🚫 4. Common Errors to Avoid

*   **Duplicate IDs**: Do not use the same question text twice in one batch.
*   **Missing Q:**: Every question block must start with `Q:`.
*   **Wrong Type**: Using `MCQ` but not providing any `A:` or `B:` lines will cause a validation failure.

**Proprietary System of TRNT BEE / BEEPREPARE Admin Core**
