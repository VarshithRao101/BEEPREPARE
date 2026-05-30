# Academic Mapping Report: C Programming and Data Structures (DSA)

This technical report provides a comprehensive architectural mapping of the BEEPREPARE educational platform to the core principles of C Programming and Data Structures (DSA). It demonstrates how the application's high-performance subsystems utilize algorithmic structures, memory management, and data organizations to facilitate low-latency study aggregation, real-time leaderboard generation, and exam processing.

---

## 1. Executive Architectural Overview

BEEPREPARE is designed as an institutional-grade platform requiring high performance and strict logical isolation of data components. At the system core, native computational logic is represented by a compiled C/DSA execution module (integrated into the WebAssembly matrix engine). This native layer handles CPU-intensive workloads such as multi-variable sorting, dynamic memory batch allocations, circular notification processing queues, and tree-based catalog structures. By decoupling these intensive operations into a C-based system, the platform ensures rapid execution paths while maintaining logical and physical data independence.

---

## 2. Unit-by-Unit Syllabus Mapping

### Unit I: Basics and Introduction to C

The fundamental building blocks of variables, operations, and expressions in C govern the core configuration and numeric computations within BEEPREPARE.

*   **Character Set, Keywords, and Identifiers**: The native implementation in `list203.c` utilizes standard C keywords (such as `typedef`, `struct`, `union`, `sizeof`, and `volatile`) and structured naming conventions for identifiers (e.g., `StudentRecord`, `ChapterRecord`, and `SystemNotification`) to maximize code readability and conform to institutional compilation guidelines.
*   **Data Types and Storage Allocation**: Standard primitive data types are mapped precisely:
    *   `int` is used for EXP metrics, consecutive streak values, and count trackers.
    *   `char` arrays (e.g., `googleUid[64]`, `displayName[128]`) are allocated to house user identifiers and names, preventing dynamic memory fragmentation.
    *   `bool` is implemented via `<stdbool.h>` to handle system validation states (e.g., whether a stack or queue is full or empty).
*   **Operators and Expressions**: 
    *   **Arithmetic Operators**: Used in calculations for grading percentages, aggregate score adjustments, and time-based EXP decay.
    *   **Relational and Logical Operators**: Implemented extensively within decision blocks to evaluate conditional limits (e.g., verifying if user EXP exceeds leaderboard eligibility criteria, or if the current elapsed time matches target windows).
    *   **Bitwise Operators**: Utilized within permission modules to execute fast permission checks via bitmasks, representing student, teacher, and admin privileges within a single integer identifier.

### Unit II: Control Structures and Input/Output Functions

Control flows and formatted output routines dictate how BEEPREPARE iterates over data collections and presents system records.

*   **Conditional Branching**: The platform relies on strict `if`, `if-else`, and `switch-case` branches to direct transaction handling, role-based screen loading, and error validation. For example, during exam generation, a `switch-case` block evaluates the question type parameter to direct the parser to MCQ, short answer, or matching schema logic.
*   **Iterative Loops**: `for`, `while`, and `do-while` loops are used throughout:
    *   `for` loops are the primary mechanism for traversing fixed-size lists, such as scanning the active students array during the daily snapshot routine.
    *   `while` loops manage dynamic conditions, such as shifting nodes within heap configurations or traversing activity feeds until a terminal null pointer is reached.
*   **Structured Control Statements**: `break` and `continue` optimize loops by aborting traversals immediately when search targets are satisfied, or skipping null elements without terminating the parent process.
*   **Formatted and Unformatted I/O**: High-performance I/O operations are simulated using `printf()` to output diagnostic engine statuses, while character streams are read and written using robust string operations that mirror unformatted functions (`puts()` and `gets()`), ensuring safe buffer management.

### Unit III: User-Defined Functions and Storage Classes

Modularity and memory scopes isolate functional operations, ensuring reliable execution and preventing namespace collisions.

*   **Function Prototypes and Definitions**: The codebase implements clean division of labor. High-performance calculations (like sorting, hashing, and queue operations) are isolated inside standalone functions with explicit prototypes, guaranteeing type safety and compiler optimization.
*   **Parameter Passing Mechanics**:
    *   **Pass-by-Value**: Used for lightweight configurations (e.g., numeric IDs or status codes), protecting original variables from unintended side-effects.
    *   **Pass-by-Reference**: Implemented using pointer references (e.g., `swapRecords(StudentRecord *a, StudentRecord *b)`) to allow direct manipulation of large structural states, saving stack frame overhead.
*   **Recursion**: Recursive functions are implemented for high-performance sorting and searches. For instance, `recursiveBinarySearch` is used to execute $O(\log N)$ lookups on pre-sorted score databases, and recursive directory tree traversals are executed within search catalog indexes.
*   **Storage Classes**:
    *   `auto` is the default for transient local variables within loops.
    *   `static` is utilized to preserve function-scoped variables across calls (such as sequence counters) and database connection instances.
    *   `extern` permits cross-module reference of global configurations (such as standard environmental flags or the primary admin API paths).

### Unit IV: Arrays in C

Linear arrays are the primary structures used for batch processing and local collection indexing.

*   **Declaration and Initialization**: 1D and 2D arrays are declared to buffer blocks of memory. A 1D array of `StudentRecord` structures acts as the local aggregate memory space for executing high-speed leaderboard operations.
*   **Array Manipulation**: Standard routines for inserting and deleting array nodes are defined. For instance, when a student submits an exam, their session record is appended to the active batch array; similarly, during cleanup, elements are shifted left to fill deleted gaps.
*   **Searching Methods**:
    *   **Linear Search**: Used to find records matching non-unique keys, such as searching student structures by email or name string arrays.
    *   **Binary Search**: Executed recursively on EXP-sorted arrays to quickly identify student ranks and percentile brackets, reducing search complexity from $O(N)$ to $O(\log N)$.
*   **Sorting via Bubble Sort**: To demonstrate a classical, stable sorting algorithm for academic evaluation, a robust `bubbleSortGrades` function is implemented. It aggregates grades and sorts them in descending order based on EXP scores to construct the daily leaderboard snapshot, using the optimized swap-check optimization.

### Unit V: Pointers, Dynamic Memory Allocation, and Strings

Low-level memory management and string analysis provide maximum speed and fine-grained resource control.

*   **Pointers and Expressions**: Pointer variables are used to navigate array spaces. Pointer arithmetic (e.g., `(batch + i)`) is preferred over standard subscript syntax inside loops to access offset records directly via memory addresses.
*   **Pointer Classifications**:
    *   `NULL` pointers are strictly validated to prevent segmentation faults during initialization and traversal.
    *   `dangling` and `wild` pointers are systematically avoided by setting pointers to `NULL` immediately after the target memory is freed.
    *   `generic` (`void*`) pointers are used to implement polymorphic helper functions (like memory copy and comparison routines).
*   **Dynamic Memory Management**: 
    *   `malloc` is used to dynamically size memory segments (e.g., allocating memory for a variable batch size of student records at runtime).
    *   `realloc` dynamically resizes allocated spaces when user enrollment scales up.
    *   `free` is systematically called on all allocated arrays and node hierarchies at the end of transaction cycles, preventing memory leaks.
*   **String Processing and Manipulation**: Since authentication tokens, user descriptions, and test question text are stored as string arrays, pointer-based string manipulation is key. Custom operations employ string library functions (`strcpy`, `strcmp`, `strlen`) alongside character arithmetic (e.g., case conversions) to clean and validate input data.

### Unit VI: Derived Types (Structures, Unions) and Concepts of OOP

BEEPREPARE combines C structured grouping with conceptual object-oriented layouts to form a clean database architecture.

*   **Structure Declarations and Access**: The platform maps logical objects to C structures:
    *   `StudentRecord` encapsulates a student's profile, including UID, display name, class, and accumulated EXP points.
    *   `ChapterRecord` structures organize specific chapter IDs and display names.
    *   Access is performed using the dot operator `.` for direct structures and the arrow operator `->` when manipulating structural pointers.
*   **Nested Structures**: Demonstrated through hierarchies where structures are nested within larger configurations to form complex entities.
*   **Unions**: Implemented to construct space-efficient polymorphic structures. The `SystemNotification` struct uses a union to house either a text message, an integer payment amount, or an exam duration variable, allocating memory only for the largest member and optimizing physical memory layout.
*   **Basics of OOP and C++ Programming**: While the core algorithms are written in structured C, they are bridged conceptually to C++ and Javascript OOP paradigms:
    *   `classes` and `objects` encapsulate data and functions together (such as the JS `MinHeap` class in `leaderboardController.js`).
    *   `static` members are used to maintain class-wide defaults (such as snapshot configurations).
    *   The platform demonstrates a hybrid procedural (optimized native engine) and object-oriented (encapsulated business logic) paradigm.

---

## 3. Algorithmic Data Structures Implementation

BEEPREPARE implements several primary data structures to support high-level operations:

1.  **Navigation Stack**: An array-based stack (`NavigationStack`) is used to log the history of question IDs visited by a student during a test session. This allows instant backward and forward navigation, supporting push and pop operations with strict boundary checks.
2.  **Notification Queue**: A dynamic Circular Queue (`NotificationQueue`) manages asynchronous system actions (e.g., queuing user payment validations or notes processing). The circular buffer design prevents memory shifting overhead and utilizes front, rear, and size variables to execute constant-time $O(1)$ enqueues and dequeues.
3.  **Min-Heap**: A standard binary Min-Heap (`MinHeap`) tracks the Top-K student records for global leaderboards. This keeps memory usage bounded to a fixed size $K$ (e.g., Top 100 students) and processes $N$ incoming student records in $O(N \log K)$ time complexity rather than performing expensive full-database sorts.
4.  **Activity Linked List**: A Doubly Linked List (`ActivityNode`) models study circle activity feeds. This permits dynamic insertion of new action feeds and supports bidirectional traversal.
5.  **Chapter BST**: A Binary Search Tree (`BstNode`) organizes chapter records alphabetically by ID. This ensures search lookups run in logarithmic time $O(\log N)$, allowing rapid retrieval during catalog lookups.
