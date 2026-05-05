# BEE Matrix Engine v1.4.19 (C/WebAssembly)

The BEE Matrix Engine is a high-performance question selection system built in C and compiled to WebAssembly for the BEEPREPARE platform. It implements a multi-stage DSA pipeline to ensure optimal paper generation.

## Architecture Overview

The engine processes questions through five distinct stages:

1.  **Stage I: Prefix Trie Filter ($O(L)$)**
    *   Uses a multi-way Trie to instantly filter thousands of questions by chapter or tag.
2.  **Stage II: Binary Max-Heap Priority Ranking ($O(n \log n)$)**
    *   Questions are ranked based on Importance, Exam Frequency, and Recency (how long ago they were used).
3.  **Stage III: Bitmask Topic Validation ($O(1)$)**
    *   Uses 64-bit bitmasks to detect and prevent "subtopic collisions" (picking multiple questions on the same niche topic).
4.  **Stage IV: 0/1 Knapsack Selection (Dynamic Programming)**
    *   An exact-sum solver that ensures the selected questions match the blueprint's mark requirements and difficulty distribution perfectly.
5.  **Stage V: Fisher-Yates Pointer Shuffle ($O(n)$)**
    *   Ensures mathematically perfect randomization of the final selection.

## Build Prerequisites

1.  Install **Emscripten SDK (emsdk)**.
    *   `git clone https://github.com/emscripten-core/emsdk.git`
    *   `./emsdk install latest`
    *   `./emsdk activate latest`
    *   `source ./emsdk_env.sh` (or `emsdk_env.ps1` on Windows)

## Build Command

```bash
cd matrix-engine
bash build.sh
```

## Data Integration

Questions in MongoDB must include:
*   `numericId`: Unique integer ID (primary key for the engine).
*   `marks`: Marks assigned to the question.
*   `difficulty`: "easy", "medium", or "hard".
*   `importance`: 1-10 scale.
*   `examFrequency`: 1-10 scale.
*   `lastUsed`: ISO Date string.
*   `subtopicBitmask`: A 64-bit integer representing the question's subtopics (bit 0 = subtopic 1, bit 1 = subtopic 2, etc.).
*   `chapterId`: String ID of the chapter.
*   `tags`: Array of strings.

## API Usage

### Generate Paper
**POST** `/api/matrix/generate`
```json
{
  "totalMarks": 80,
  "subjectId": "physics",
  "chapterIds": ["ch1", "ch2", "ch5"],
  "easyCount": 10,
  "mediumCount": 8,
  "hardCount": 4,
  "marksPerEasy": 1,
  "marksPerMedium": 2,
  "marksPerHard": 4
}
```

### Engine Status
**GET** `/api/matrix/status`
Returns current engine health and loaded question count.
