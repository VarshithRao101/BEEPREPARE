# Academic Mapping Report: Database Management System (DBMS)

This technical report provides a detailed Database Management System (DBMS) analysis of the BEEPREPARE platform. It maps the architectural, relational, transactional, and storage structures of the system directly to the units of the DBMS syllabus, utilizing a strict **PostgreSQL** relational database paradigm.

---

## 1. Executive Architectural Overview

BEEPREPARE utilizes a high-security, highly-optimized data storage architecture designed around a **PostgreSQL Relational Database Management System**. The system operates on a classic Three-Tier DBMS Architecture, separating presentation logic, application middlewares, and relational database engine operations. This design ensures absolute **Physical and Logical Data Independence**, enforcing integrity constraints, granular index optimization, explicit table normalizations (1NF to 4NF), and strict ACID transactions to manage student records, questions, chapter banks, streaks, and payment requests.

---

## 2. Unit-by-Unit Syllabus Mapping

### Unit I: Introduction to Database

The structural foundation of BEEPREPARE is designed around relational database principles to ensure high data integrity and standard modelling protocols.

*   **Purpose and Applications of DBMS**: Traditional file systems present severe issues regarding data redundancy, inconsistent states, security vulnerabilities, and concurrent access anomalies. BEEPREPARE overcomes these challenges by using a central PostgreSQL database to store and serve academic preparation assets.
*   **Three-Tier DBMS Architecture**: The platform strictly implements this classic structural separation:
    *   **Presentation Tier (External View)**: Vanilla HTML5/CSS3 presentation layer displaying interactive student dashboards, exam modules, and payment gateways.
    *   **Application Tier (Conceptual View)**: Node.js and Express server executing business rules, authentication checks, and formatting data.
    *   **Data Tier (Internal/Physical View)**: The PostgreSQL DBMS storing binary heap files, indexes, transactional logs, and system tables.
*   **Data Independence**:
    *   **Logical Data Independence**: Changes to the conceptual database schema (e.g., adding a new field like `activationExpiry` to the `users` table) do not disrupt the presentation tier since the backend API acts as a logical buffer.
    *   **Physical Data Independence**: The physical storage arrangements (e.g., migrating PostgreSQL tables from a local disk to SSD blocks, or changing table partition schemes) are handled entirely by the database engine without requiring modifications to the Express application code.
*   **Data Modeling and the Entity-Relationship (ER) Model**:
    *   System data is modeled using explicit entities: `User`, `Streak`, `Bank`, `Question`, `TestSession`, `PaymentRequest`, and `ActivityLog`.
    *   The ER model enforces relations: a 1-to-1 relationship between `User` and `Streak` (mapping the user UID as a foreign key), a 1-to-many relation between `Bank` and `Question` (each question linked to a single question bank), and a 1-to-many relation between `User` and `TestSession`.
*   **Relational Model and Database Comparisons**: BEEPREPARE implements the relational model by organizing data into structured tables with strict columns, datatype constraints, and primary-foreign key relationships. Relational systems (like PostgreSQL) guarantee strict schema enforcement and transactional ACID safety, which are critical for grade aggregations and payment records.

---

### Unit II: Relational Query Language

Data definition, manipulation, control, and transactional instructions within BEEPREPARE are executed using standard SQL commands in PostgreSQL.

*   **Data Definition Language (DDL)**: DDL statements define the structure of the database. Below is the exact PostgreSQL schema representation used to create the core relational tables:
    ```sql
    -- CREATE TABLE statement for users mapping to Unit II
    CREATE TABLE users (
        google_uid VARCHAR(64) PRIMARY KEY,
        display_name VARCHAR(128) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(16) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
        class_name VARCHAR(32),
        exp_points INTEGER DEFAULT 0,
        daily_exp INTEGER DEFAULT 0,
        monthly_exp INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- CREATE TABLE statement for question banks mapping to Unit II
    CREATE TABLE banks (
        bank_id SERIAL PRIMARY KEY,
        title VARCHAR(128) NOT NULL,
        subject VARCHAR(64) NOT NULL,
        class_level VARCHAR(32) NOT NULL,
        teacher_id VARCHAR(64) REFERENCES users(google_uid) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE
    );

    -- CREATE TABLE statement for questions mapping to Unit II
    CREATE TABLE questions (
        question_id SERIAL PRIMARY KEY,
        bank_id INTEGER REFERENCES banks(bank_id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(16) CHECK (question_type IN ('MCQ', 'ShortAnswer', 'Matching')),
        marks INTEGER NOT NULL CHECK (marks > 0),
        difficulty VARCHAR(16) CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
        mcq_options JSONB, -- MCQ options stored in relational-safe JSONB format
        correct_answer TEXT NOT NULL,
        is_important BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
*   **Data Manipulation Language (DML)**: DML statements are used to query and modify records:
    *   **INSERT**: Appending new student records upon registration.
    *   **UPDATE**: Incrementing user EXP points and consecutive streaks upon successful completion of a test session.
    *   **DELETE / TRUNCATE**: Deleting temporary snapshots or resetting daily EXP counts.
*   **Integrity Constraints and Database Keys**:
    *   **Primary Key (PK)**: Enforces entity integrity. Every table has a primary key (e.g., `google_uid` in `users`, `question_id` in `questions`) that guarantees unique, non-null identification of tuples.
    *   **Foreign Key (FK)**: Enforces referential integrity. Explicit constraints (e.g., `bank_id` in `questions` referencing `bank_id` in `banks`) prevent orphaned records. The `ON DELETE CASCADE` constraint is implemented to ensure that deleting a question bank automatically removes all associated questions.
    *   **Domain Constraints**: Implemented via explicit datatypes, checking rules (`CHECK`), and nullability indicators (`NOT NULL`).

---

### Unit III: Relational Operations

To fetch, aggregate, filter, and optimize queries under high concurrent loads, BEEPREPARE utilizes standard relational operators and PostgreSQL execution optimizations.

*   **Aggregate Functions**: Aggregate computations calculate student rank metrics and performance summaries:
    ```sql
    -- Query to compute class-level EXP summaries
    SELECT class_name, COUNT(*) AS student_count, SUM(exp_points) AS total_exp, AVG(exp_points) AS average_exp
    FROM users
    WHERE role = 'student'
    GROUP BY class_name
    HAVING COUNT(*) > 1;
    ```
*   **SQL Joins**:
    *   **INNER JOIN**: Combines questions with their parent banks to fetch comprehensive metadata during test generation:
        ```sql
        SELECT q.question_id, q.question_text, b.title, b.subject
        FROM questions q
        INNER JOIN banks b ON q.bank_id = b.bank_id
        WHERE b.is_active = TRUE;
        ```
    *   **LEFT OUTER JOIN**: Used to retrieve all students alongside their active streak records, even if they have not yet logged a streak:
        ```sql
        SELECT u.display_name, s.current_streak
        FROM users u
        LEFT OUTER JOIN streaks s ON u.google_uid = s.user_id;
        ```
*   **Set Operators**: Standard operators (`UNION`, `UNION ALL`, `INTERSECT`, `EXCEPT`) coordinate access across tables, such as combining question results from public banks and teacher-owned private banks.
*   **Views**: Read-only database views are constructed to present clean, security-hardened views of the database:
    ```sql
    -- Secure View to display non-sensitive student stats
    CREATE VIEW public_leaderboard_view AS
    SELECT display_name, class_name, exp_points, daily_exp
    FROM users
    WHERE role = 'student'
    ORDER BY exp_points DESC;
    ```
*   **Indexing and Query Optimization**: 
    *   To prevent expensive Sequential Scans (COLLSCAN equivalent) on large tables, compound indexes are explicitly defined.
    *   PostgreSQL's cost-based query optimizer analyzes execution plans via **EXPLAIN ANALYZE** to verify that Index Scans (IXSCAN) are executed rather than table scans:
        ```sql
        -- Compound Index for fast hierarchical question lookup
        CREATE INDEX idx_questions_lookup ON questions(bank_id, question_type, difficulty);

        -- Checking execution stats
        EXPLAIN ANALYZE
        SELECT * FROM questions 
        WHERE bank_id = 5 AND question_type = 'MCQ' AND difficulty = 'Easy';
        ```

---

### Unit IV: Relational Database Design

BEEPREPARE adheres to standard relational database design principles to eliminate insertion, deletion, and modification anomalies.

*   **Functional Dependency (FD)**: Columns are designed so that all non-key attributes are fully functionally dependent on the primary key, avoiding multi-valued dependencies.
*   **Normalization Pipeline**:
    *   **First Normal Form (1NF)**: All attributes contain atomic values. Structured arrays like MCQ options are represented as discrete key-value items or processed via the native `JSONB` datatype.
    *   **Second Normal Form (2NF)**: All non-key attributes depend fully on the primary key, eliminating partial dependencies. In the `questions` table, all question attributes rely entirely on `question_id`, and bank metadata is separated into its own table.
    *   **Third Normal Form (3NF)**: Eliminates transitive dependencies. For instance, chapter information is separated from the `questions` table; a question references a `chapter_id`, but chapter names are stored in a dedicated `chapters` table to prevent transitively identifying chapter details through a question ID.
    *   **Boyce-Codd Normal Form (BCNF)**: Ensured by guaranteeing that for every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ is a superkey.
    *   **Fourth Normal Form (4NF)**: Prevents multi-valued dependencies. By separating student study circles, bookmarks, and test sessions into independent relation tables rather than storing them as complex nested columns in the user table, the database prevents multi-valued dependency anomalies.

---

### Unit V: Programming Constructs in Databases & Database Transaction Processing

To enforce database constraints, execute server-side data mutations, and ensure ACID integrity, BEEPREPARE utilizes PL/pgSQL constructs and transactional blocks.

*   **Stored Procedures and Functions (PL/pgSQL)**: Stored procedures automate student streak increments and grade evaluations within the database engine:
    ```sql
    -- PL/pgSQL Function to increment student streak
    CREATE OR REPLACE FUNCTION increment_student_streak(student_uid VARCHAR)
    RETURNS VOID AS $$
    DECLARE
        current_streak_val INT;
    BEGIN
        SELECT current_streak INTO current_streak_val FROM streaks WHERE user_id = student_uid;
        
        IF FOUND THEN
            UPDATE streaks 
            SET current_streak = current_streak_val + 1, last_active = CURRENT_TIMESTAMP
            WHERE user_id = student_uid;
        ELSE
            INSERT INTO streaks (user_id, current_streak, last_active)
            VALUES (student_uid, 1, CURRENT_TIMESTAMP);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to update student streak: %', SQLERRM;
    END;
    $$ LANGUAGE plpgsql;
    ```
*   **Triggers**: Database triggers maintain system activity logs automatically whenever critical tables are updated:
    ```sql
    -- Activity logging function
    CREATE OR REPLACE FUNCTION log_user_updates()
    RETURNS TRIGGER AS $$
    BEGIN
        INSERT INTO activity_logs (user_id, action_text, logged_at)
        VALUES (NEW.google_uid, 'Profile updated. EXP set to ' || NEW.exp_points, CURRENT_TIMESTAMP);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger definition
    CREATE TRIGGER trg_user_after_update
    AFTER UPDATE OF exp_points ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_user_updates();
    ```
*   **ACID Transaction Properties**: For critical state mutations (like test submission or account activation), BEEPREPARE enforces full ACID properties using PostgreSQL transactions:
    *   **Atomicity**: Creating a new test session record and deducting student activation credits must succeed together. If any statement fails, the entire transaction is rolled back.
    *   **Consistency**: Transactions move the database from one valid state to another, maintaining all referential integrity constraints and check rules.
    *   **Isolation**: Safe concurrency protocols are maintained. Transactions are executed under explicit isolation levels (`SERIALIZABLE` or `READ COMMITTED`) to prevent dirty reads, non-repeatable reads, or phantom reads.
    *   **Durability**: Committed transactions are written to PostgreSQL's Write-Ahead Log (WAL), guaranteeing that changes survive server crashes or power failures.
    ```sql
    -- Safe transactional billing script in PostgreSQL
    BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

    -- Step 1: Check and deduct student balance
    UPDATE users 
    SET exp_points = exp_points - 100 
    WHERE google_uid = 'std_alpha' AND exp_points >= 100;

    -- Step 2: Insert the test session record
    INSERT INTO test_sessions (student_id, bank_id, status, started_at)
    VALUES ('std_alpha', 3, 'started', CURRENT_TIMESTAMP);

    -- Step 3: Record transaction in logs
    INSERT INTO activity_logs (user_id, action_text)
    VALUES ('std_alpha', 'Session started for Bank 3. Credits deducted.');

    COMMIT;
    ```

---

### Unit VI: NoSQL Databases & PostgreSQL JSONB Representation

Modern database architectures often combine relational models with document schemas. This section compares standard relational databases with NoSQL systems and explains how PostgreSQL integrates both paradigms.

*   **Comparison: SQL vs. NoSQL Databases**:
    *   **SQL (PostgreSQL)**: Employs rigid schemas, strict tabular structures, foreign keys, normalization, and absolute ACID safety. Ideal for critical transaction systems, financial processing, and grade aggregation tables.
    *   **NoSQL (MongoDB / DynamoDB)**: Schema-less design where data is stored in flexible JSON-like documents. This avoids expensive JOIN operations by nesting related elements (like question options) inside a single record, making it highly effective for write-heavy workflows.
*   **PostgreSQL Native JSONB Databases**: 
    *   PostgreSQL bridges the gap by providing the **JSONB** (Binary JSON) datatype. This allows BEEPREPARE to store semi-structured data (such as variable MCQ options or dynamic system metadata) natively inside a relational column.
    *   Unlike plain text columns, `JSONB` parses the JSON data into a decompressed binary format, allowing fast index-supported queries directly on JSON keys:
        ```sql
        -- Querying directly inside a JSONB column in PostgreSQL
        SELECT question_id, question_text 
        FROM questions
        WHERE mcq_options->>'correct_key' = 'A';
        ```
*   **JSON Indexing and Performance Analysis**:
    *   To maintain high query speeds on nested JSON structures, PostgreSQL supports **GIN (Generalized Inverted Index)** indexing on `JSONB` columns.
    *   This index type indexes key-value pairs inside the JSON document, allowing rapid lookups:
        ```sql
        -- GIN Index on JSONB column
        CREATE INDEX idx_questions_options ON questions USING gin(mcq_options);
        ```
    *   Running `EXPLAIN` on these JSON queries proves that PostgreSQL executes fast index scans rather than full table scans, combining the structured safety of SQL with the schema flexibility of NoSQL.
