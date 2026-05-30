# Academic Mapping Report: Software Engineering (CS320)

This technical report provides a detailed software engineering analysis of the BEEPREPARE platform. It maps the architectural, procedural, and operational attributes of the platform directly to the units of the CS320 Software Engineering syllabus, using rigorous academic and professional terminology.

---

## 1. Executive Architectural Overview

BEEPREPARE is designed and developed using modern Software Engineering practices that prioritize scalability, security, and low-latency interaction. The platform utilizes a decoupled Model-View-Controller (MVC) architectural pattern, separating a modular Vanilla HTML5/CSS3 glassmorphism presentation layer from a robust Express.js API application layer, which connects to a multi-cluster cloud database tier. By adhering to strict software lifecycle models, rigorous testing techniques, and automated deployment pipelines, BEEPREPARE demonstrates institutional-grade quality standards.

---

## 2. Unit-by-Unit Syllabus Mapping

### Unit I: Software Engineering Foundations & SDLC

BEEPREPARE's creation is governed by structured software lifecycle paradigms to ensure systematic progress and architectural stability.

*   **Evolution and Life Cycle Models**: 
    *   The project rejected the traditional linear Waterfall model due to high requirement volatility in academic environments.
    *   Instead, an **Agile & Scrum DevOps Lifecycle** was adopted. Development was executed in two-week iterative sprints, with backlogs categorized by feature importance (e.g., core authentication, question paper builder, study circles, and fortress stack security).
    *   This iterative prototyping model allowed rapid rollout of minor modules (such as notes vaults) while maintaining system integrity.
*   **Requirements Gathering and Analysis**:
    *   Requirement analysis involved identifying three core human actors: Students, Teachers, and Administrators.
    *   **Functional Requirements**: Core functions include secure student login, Chapter/Bank catalog searches, dynamic test session initialization, automated credit deduction, teacher approval queues, and admin configuration controls.
    *   **Non-Functional Requirements**: Focuses on sub-second API response times, 12-layer security middleware (anti-SQLi, anti-NoSQLi, stateful CSRF), and serverless high-availability guarantees.
*   **Software Requirements Specification (SRS)**: Formulated in strict compliance with the **IEEE 830 Standard**. The SRS clearly defines system constraints, data models, validation constraints, and user-role permissions, ensuring complete traceability.

### Unit II: Software Design Principles & System Architecture

A modular system design is key to maximizing code reusability and minimizing maintenance overhead.

*   **Modularity, Cohesion, and Coupling**:
    *   **High Cohesion**: Controllers within the `beeprepare-backend/controllers` folder are strictly segregated by functional boundaries. For example, `leaderboardController.js` handles ranking calculations, while `paymentController.js` manages billing and activations.
    *   **Low Coupling**: Modules communicate strictly via standardized REST API JSON payloads, eliminating global state dependencies and ensuring that changes to frontend screens do not disrupt backend schemas.
*   **Design Trade-offs**: The system trades small database denormalization overheads (such as nesting chapter metadata in bank schemas) to gain sub-millisecond database read performance, completely avoiding expensive relational JOIN operations during peak examination hours.
*   **Data Flow Diagrams (DFD) and Structure Charts**:
    *   **Context Diagram (Level 0)**: Represents the entire BEEPREPARE system interacting with external entities (Students, Teachers, Admins, Firebase Auth, Cloudinary, and Payment gateways).
    *   **DFD Level 1 & 2**: Models transactional streams. Level 1 represents key processes (Auth Process, Paper Generation, Test Session Validation, and Payment Gateways). Level 2 details the exact data streams during test submission, mapping inputs (answers, user tokens) to validation steps, score aggregation, credit deduction, and activity logging.
    *   **Structure Charts**: Illustrate the control hierarchy of backend services. The transform analysis models how incoming raw payment receipts are validated, converted to approved states, and output as activated license keys.

### Unit III: Object-Oriented Software Development and Modeling Techniques

Object-oriented analysis translates logical requirements into standard UML structures.

*   **Unified Process and Iterative Workflows**: Development was divided into standard phases: Inception (feasibility and SRS definition), Elaboration (architectural design), Construction (coding the Express engine and HTML modules), and Transition (Vercel deployment and UAT testing).
*   **UML Modeling**:
    *   **Use Case Diagrams**: Map user interactions. Student use cases (attempt test, view streak, join study circle) are isolated from Teacher use cases (create bank, define syllabus chapters, approve student enrollments) and Admin use cases (modify system config, manage transaction queues, force server restarts).
    *   **Class Diagrams**: Structure the system's models. Logical classes (User, Streak, Bank, Question, TestSession, ActivityLog) are modeled with explicit fields, methods, and relationships (e.g., a one-to-many relationship between Bank and Questions, and a one-to-one relationship between User and Streak).
    *   **Sequence Diagrams**: Detail the message exchanges during critical operations. For instance, the sequence diagram for Payment Activation maps the step-by-step chronology: Student -> Frontend UI -> Express router -> Auth middleware -> Payment controller -> Mongoose Schema -> Admin notification.
*   **Coding Standards and Code Review Techniques**: Strict formatting rules (using ESLint and strict JS standards) ensure code cleanlines. Automated pre-commit hooks validate route structures and verify that all write requests pass through CSRF and Fortress Stack security layers.

### Unit IV: Software Testing Concepts, Techniques, and Automation

A comprehensive verification strategy ensures operational correctness under heavy concurrent loads.

*   **Testing Philosophy**: Testing was executed across multiple abstraction levels to discover both logic defects (white-box) and feature deviations (black-box).
*   **Testing Techniques**:
    *   **White-Box Testing**: Applied to security and rate-limiting middlewares. Code paths (including error branches and validation guardrails) were tested to ensure that unauthorized requests are blocked and logged.
    *   **Black-Box Testing**: Executed on API endpoints (e.g., verifying that a student cannot create a TestSession if their credit balance is zero). Equivalence partitioning and boundary value analysis verified fields like OTP keys (exactly 6 digits) and exam durations (non-negative integers).
*   **Levels of Testing**:
    *   **Unit Testing**: Isolated validation of individual controller functions (such as the `MinHeap` ranking logic inside `leaderboardController.js`).
    *   **Integration Testing**: Verified database connection reliability and successful token exchange between the Express server and Firebase Admin API.
    *   **System Testing**: Validated the complete student exam workflow (Auth -> Bank lookup -> Test start -> Question loading -> Navigation -> Answer submission -> Auto-grading -> Streak increment).
    *   **User Acceptance Testing (UAT)**: Conducted with educators to verify that question paper output formats match institutional standards.
*   **Automation Testing (Conceptual mapping)**: Setup pipelines using automated browser test scripts to perform regression testing on UI buttons, input forms, and dynamic modals. Security scanning utilities checked for XSS vulnerabilities on form submissions.

### Unit V: Software Project Management & DevOps Practices

Modern configuration management and DevOps automation guarantee rapid release cycles.

*   **Project Planning and Estimations**:
    *   **Cost Estimation**: Initial project metrics were estimated using **COCOMO** (Constructive Cost Model), evaluating software scale, complexity (Organic mode), and developer constraints.
    *   **Function Points (FP)**: Counted system inputs (forms), outputs (leaderboards, reports), queries (question search), files (logical models), and interfaces (Firebase/Cloudinary) to calculate engineering complexity.
*   **Scheduling Techniques**: Project timelines were calculated using **PERT/CPM** (Program Evaluation Review Technique / Critical Path Method) to identify critical paths in security validation, ensuring that security hardening did not delay frontend deployment.
*   **Software Configuration Management (SCM)**: Utilized Git for version control, implementing a branch-per-feature strategy. Merges to the `main` branch required pass-checks on local integration builds.
*   **DevOps and CI/CD Pipelines**: Automated pipelines are configured using **Vercel CI/CD workflows**. Every push to the main GitHub repository triggers an automated build runner that:
    1. Installs project dependencies.
    2. Runs static code analyses.
    3. Triggers environment variables injection (`MONGO_URI`, `FIREBASE_PROJECT_ID`, `JWT_SECRET`).
    4. Deploys the changes as serverless functions, assuring continuous delivery.

### Unit VI: Quality Management, Maintenance & Emerging Technologies

Quality metrics, maintenance frameworks, and cutting-edge software engineering tools ensure platform longevity.

*   **Quality Standards**: Development processes follow **SEI CMMI Level 3** guidelines, ensuring documented, standardized, and repeatable engineering processes.
*   **Software Maintenance Classification**:
    *   **Corrective Maintenance**: Immediate patching of route vulnerabilities (such as validating CSRF tokens on all state-mutating requests).
    *   **Adaptive Maintenance**: Adjusting Express and Firebase configurations to comply with newer Node.js runtime updates on cloud hosting environments.
    *   **Perfective Maintenance**: Optimization of sorting algorithms (e.g., swapping dynamic sorting with the high-performance C-based Min-Heap compiled to WebAssembly).
    *   **Preventive Maintenance**: Regular security audits, credential rotations, and schema checks to prevent data decay.
*   **Component-Based Software Development (CBSD)**: Promotes software reuse by utilizing decoupled libraries (such as npm packages for authentication, crypto helpers, and database connections), speeding up construction times.
*   **Emerging Software Engineering Techniques**: The development pipeline integrated modern generative AI tools (like GitHub Copilot and Google Gemini APIs) to accelerate structural coding, automate unit test generation, and validate CSS layout alignments, maximizing engineering velocity.
